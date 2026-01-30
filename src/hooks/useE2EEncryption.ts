/**
 * React hook for End-to-End Encryption operations
 * 
 * Provides easy access to E2E encryption for messaging components
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { E2ECrypto, type EncryptedData } from '@/lib/e2e-crypto';
import { KeyStorage } from '@/lib/key-storage';
import { toast } from 'sonner';

interface PublicKeyRecord {
  user_id: string;
  public_key_jwk: JsonWebKey;
  key_version: number;
}

interface EncryptionState {
  isInitialized: boolean;
  hasKeys: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useE2EEncryption() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<EncryptionState>({
    isInitialized: false,
    hasKeys: false,
    isLoading: true,
    error: null
  });
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[] | null>(null);
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);

  // Check if user has existing keys
  useEffect(() => {
    const checkKeys = async () => {
      if (!user?.id) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const hasLocalKeys = await KeyStorage.hasKeys(user.id);
        
        // Check if public key exists on server
        const { data: serverKey } = await supabase
          .from('user_public_keys')
          .select('user_id')
          .eq('user_id', user.id)
          .single();

        setState({
          isInitialized: true,
          hasKeys: hasLocalKeys && !!serverKey,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to check encryption keys'
        }));
      }
    };

    checkKeys();
  }, [user?.id]);

  // Fetch recipient's public key
  const fetchPublicKey = useCallback(async (userId: string): Promise<JsonWebKey | null> => {
    const { data, error } = await supabase
      .from('user_public_keys')
      .select('public_key_jwk, key_version')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    
    return data.public_key_jwk as unknown as JsonWebKey;
  }, []);

  // Initialize encryption (generate keys)
  const initializeEncryption = useMutation({
    mutationFn: async (password: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Generate and store key pair
      const { publicKeyJwk, recoveryPhrase: phrase } = 
        await KeyStorage.generateAndStoreKeyPair(user.id, password);

      // Store public key on server (upsert to handle existing keys)
      const { data: existingKey } = await supabase
        .from('user_public_keys')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let error: { message: string } | null = null;
      
      // Convert to plain JSON to avoid type issues
      const keyData = JSON.parse(JSON.stringify(publicKeyJwk));
      
      if (existingKey) {
        // Update existing
        const result = await supabase
          .from('user_public_keys')
          .update({
            public_key_jwk: keyData,
            key_version: 1
          })
          .eq('user_id', user.id);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('user_public_keys')
          .insert({
            user_id: user.id,
            public_key_jwk: keyData,
            key_version: 1
          });
        error = result.error;
      }

      if (error) throw error;

      setRecoveryPhrase(phrase);
      setSessionPassword(password);
      
      return { recoveryPhrase: phrase };
    },
    onSuccess: () => {
      setState(prev => ({ ...prev, hasKeys: true }));
      toast.success('Encryption enabled! Save your recovery phrase.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to initialize encryption');
    }
  });

  // Unlock keys with password
  const unlockKeys = useCallback(async (password: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const privateKey = await KeyStorage.getPrivateKey(user.id, password);
      if (privateKey) {
        setSessionPassword(password);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [user?.id]);

  // Encrypt a message for a recipient
  const encryptMessage = useCallback(async (
    message: string,
    recipientId: string
  ): Promise<EncryptedData | null> => {
    if (!user?.id || !sessionPassword) {
      toast.error('Please unlock your encryption keys first');
      return null;
    }

    try {
      // Get recipient's public key
      const recipientPublicKey = await fetchPublicKey(recipientId);
      if (!recipientPublicKey) {
        // Recipient doesn't have E2EE enabled
        return null;
      }

      // Get my private key
      const myPrivateKey = await KeyStorage.getPrivateKey(user.id, sessionPassword);
      if (!myPrivateKey) {
        throw new Error('Failed to retrieve private key');
      }

      const keyVersion = await KeyStorage.getKeyVersion(user.id);

      return await E2ECrypto.encryptMessage(
        message,
        recipientPublicKey,
        myPrivateKey,
        keyVersion || 1
      );
    } catch (error) {
      console.error('Encryption failed:', error);
      toast.error('Failed to encrypt message');
      return null;
    }
  }, [user?.id, sessionPassword, fetchPublicKey]);

  // Decrypt a message from a sender
  const decryptMessage = useCallback(async (
    encryptedData: EncryptedData,
    senderId: string
  ): Promise<string | null> => {
    if (!user?.id || !sessionPassword) {
      return null;
    }

    try {
      // Get sender's public key
      const senderPublicKey = await fetchPublicKey(senderId);
      if (!senderPublicKey) {
        return null;
      }

      // Get my private key
      const myPrivateKey = await KeyStorage.getPrivateKey(user.id, sessionPassword);
      if (!myPrivateKey) {
        return null;
      }

      return await E2ECrypto.decryptMessage(
        encryptedData,
        senderPublicKey,
        myPrivateKey
      );
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }, [user?.id, sessionPassword, fetchPublicKey]);

  // Recover keys with recovery phrase
  const recoverKeys = useMutation({
    mutationFn: async ({ 
      recoveryPhrase: phrase, 
      newPassword 
    }: { 
      recoveryPhrase: string[]; 
      newPassword: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const result = await KeyStorage.recoverWithPhrase(
        user.id,
        phrase,
        newPassword
      );

      if (!result) {
        throw new Error('Recovery failed - invalid phrase');
      }

      setSessionPassword(newPassword);
      return result;
    },
    onSuccess: () => {
      setState(prev => ({ ...prev, hasKeys: true }));
      toast.success('Keys recovered successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to recover keys');
    }
  });

  // Check if recipient supports E2EE
  const supportsE2EE = useCallback(async (userId: string): Promise<boolean> => {
    const publicKey = await fetchPublicKey(userId);
    return publicKey !== null;
  }, [fetchPublicKey]);

  // Clear recovery phrase from memory (after user has saved it)
  const clearRecoveryPhrase = useCallback(() => {
    setRecoveryPhrase(null);
  }, []);

  // Lock keys (clear session password)
  const lockKeys = useCallback(() => {
    setSessionPassword(null);
  }, []);

  return {
    // State
    isInitialized: state.isInitialized,
    hasKeys: state.hasKeys,
    isLoading: state.isLoading,
    isUnlocked: sessionPassword !== null,
    error: state.error,
    recoveryPhrase,

    // Actions
    initializeEncryption: initializeEncryption.mutate,
    isInitializing: initializeEncryption.isPending,
    unlockKeys,
    lockKeys,
    encryptMessage,
    decryptMessage,
    recoverKeys: recoverKeys.mutate,
    isRecovering: recoverKeys.isPending,
    supportsE2EE,
    clearRecoveryPhrase
  };
}
