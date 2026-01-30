/**
 * React hook for End-to-End Encryption operations
 * 
 * Provides easy access to E2E encryption with 8-digit PIN and weekly session persistence
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { E2ECrypto, type EncryptedData } from '@/lib/e2e-crypto';
import { KeyStorage } from '@/lib/key-storage';
import { toast } from 'sonner';

interface EncryptionState {
  isInitialized: boolean;
  hasKeys: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiry: Date | null;
}

export function useE2EEncryption() {
  const { user } = useAuth();
  const [state, setState] = useState<EncryptionState>({
    isInitialized: false,
    hasKeys: false,
    isLoading: true,
    error: null,
    sessionExpiry: null
  });
  const [sessionPinCode, setSessionPinCode] = useState<string | null>(null);

  // Check if user has existing keys and restore session
  useEffect(() => {
    const checkKeysAndRestoreSession = async () => {
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

        const hasKeys = hasLocalKeys && !!serverKey;
        let sessionExpiry: Date | null = null;

        // Try to restore session if keys exist
        if (hasKeys) {
          const savedPin = await KeyStorage.getValidSession(user.id);
          
          if (savedPin) {
            // Verify the PIN still works by testing decryption
            try {
              const privateKey = await KeyStorage.getPrivateKey(user.id, savedPin);
              if (privateKey) {
                setSessionPinCode(savedPin);
                // Extend session on each app open
                await KeyStorage.extendSession(user.id);
              }
            } catch {
              // Invalid session, clear it
              await KeyStorage.clearSession(user.id);
            }
          }
          
          sessionExpiry = await KeyStorage.getSessionExpiry(user.id);
        }

        setState({
          isInitialized: true,
          hasKeys,
          isLoading: false,
          error: null,
          sessionExpiry
        });
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to check encryption keys'
        }));
      }
    };

    checkKeysAndRestoreSession();
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
    mutationFn: async (pinCode: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Validate PIN format
      if (!E2ECrypto.validate8DigitCode(pinCode)) {
        throw new Error('PIN must be exactly 8 digits');
      }

      // Generate and store key pair
      const { publicKeyJwk } = await KeyStorage.generateAndStoreKeyPair(user.id, pinCode);

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

      setSessionPinCode(pinCode);
      
      const sessionExpiry = await KeyStorage.getSessionExpiry(user.id);
      
      return { sessionExpiry };
    },
    onSuccess: ({ sessionExpiry }) => {
      setState(prev => ({ ...prev, hasKeys: true, sessionExpiry }));
      toast.success('Encryption enabled! Your messages are now protected.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to initialize encryption');
    }
  });

  // Unlock keys with PIN
  const unlockKeys = useCallback(async (pinCode: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const privateKey = await KeyStorage.getPrivateKey(user.id, pinCode);
      if (privateKey) {
        setSessionPinCode(pinCode);
        // Save session for 7 days
        await KeyStorage.saveSession(user.id, pinCode);
        
        const sessionExpiry = await KeyStorage.getSessionExpiry(user.id);
        setState(prev => ({ ...prev, sessionExpiry }));
        
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
    if (!user?.id || !sessionPinCode) {
      toast.error('Please unlock your encryption first');
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
      const myPrivateKey = await KeyStorage.getPrivateKey(user.id, sessionPinCode);
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
  }, [user?.id, sessionPinCode, fetchPublicKey]);

  // Decrypt a message from a sender
  const decryptMessage = useCallback(async (
    encryptedData: EncryptedData,
    senderId: string
  ): Promise<string | null> => {
    if (!user?.id || !sessionPinCode) {
      return null;
    }

    try {
      // Get sender's public key
      const senderPublicKey = await fetchPublicKey(senderId);
      if (!senderPublicKey) {
        return null;
      }

      // Get my private key
      const myPrivateKey = await KeyStorage.getPrivateKey(user.id, sessionPinCode);
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
  }, [user?.id, sessionPinCode, fetchPublicKey]);

  // Change PIN
  const changePin = useMutation({
    mutationFn: async ({ oldPin, newPin }: { oldPin: string; newPin: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      if (!E2ECrypto.validate8DigitCode(newPin)) {
        throw new Error('New PIN must be exactly 8 digits');
      }

      await KeyStorage.updatePin(user.id, oldPin, newPin);
      setSessionPinCode(newPin);
      
      const sessionExpiry = await KeyStorage.getSessionExpiry(user.id);
      return { sessionExpiry };
    },
    onSuccess: ({ sessionExpiry }) => {
      setState(prev => ({ ...prev, sessionExpiry }));
      toast.success('PIN changed successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change PIN');
    }
  });

  // Check if recipient supports E2EE
  const supportsE2EE = useCallback(async (userId: string): Promise<boolean> => {
    const publicKey = await fetchPublicKey(userId);
    return publicKey !== null;
  }, [fetchPublicKey]);

  // Lock keys (clear session)
  const lockKeys = useCallback(async () => {
    if (user?.id) {
      await KeyStorage.clearSession(user.id);
    }
    setSessionPinCode(null);
    setState(prev => ({ ...prev, sessionExpiry: null }));
  }, [user?.id]);

  return {
    // State
    isInitialized: state.isInitialized,
    hasKeys: state.hasKeys,
    isLoading: state.isLoading,
    isUnlocked: sessionPinCode !== null,
    error: state.error,
    sessionExpiry: state.sessionExpiry,

    // Actions
    initializeEncryption: initializeEncryption.mutate,
    isInitializing: initializeEncryption.isPending,
    unlockKeys,
    lockKeys,
    encryptMessage,
    decryptMessage,
    changePin: changePin.mutate,
    isChangingPin: changePin.isPending,
    supportsE2EE,
  };
}
