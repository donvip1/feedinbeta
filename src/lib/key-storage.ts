/**
 * Secure Key Storage Library
 * 
 * Manages encrypted storage of E2E encryption keys using IndexedDB.
 * Private keys are encrypted with a password-derived key before storage.
 */

import { E2ECrypto, type KeyPair } from './e2e-crypto';

interface StoredKeyData {
  encrypted: string;
  iv: string;
  salt: string;
  keyVersion: number;
  createdAt: string;
}

interface RecoveryData {
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
  publicKeyJwk: JsonWebKey;
  keyVersion: number;
}

const DB_NAME = 'feedin_e2e_keys';
const STORE_NAME = 'encryption_keys';
const DB_VERSION = 1;

export class KeyStorage {
  private static db: IDBDatabase | null = null;
  
  /**
   * Initialize IndexedDB for key storage
   */
  private static async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(new Error('Failed to open key database'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  
  /**
   * Store a value in IndexedDB
   */
  private static async set(key: string, value: unknown): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put({ id: key, value });
      
      request.onerror = () => reject(new Error('Failed to store key'));
      request.onsuccess = () => resolve();
    });
  }
  
  /**
   * Get a value from IndexedDB
   */
  private static async get<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(key);
      
      request.onerror = () => reject(new Error('Failed to retrieve key'));
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
    });
  }
  
  /**
   * Delete a value from IndexedDB
   */
  private static async delete(key: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(key);
      
      request.onerror = () => reject(new Error('Failed to delete key'));
      request.onsuccess = () => resolve();
    });
  }
  
  /**
   * Generate and store a new key pair
   * Returns the public key (to be stored on server) and recovery phrase
   */
  static async generateAndStoreKeyPair(
    userId: string,
    password: string
  ): Promise<{ publicKeyJwk: JsonWebKey; recoveryPhrase: string[] }> {
    const keyPair = await E2ECrypto.generateKeyPair();
    const recoveryPhrase = E2ECrypto.generateRecoveryPhrase();
    
    // Encrypt private key with password
    const encryptedPrivateKey = await E2ECrypto.encryptWithPassword(
      JSON.stringify(keyPair.privateKeyJwk),
      password
    );
    
    // Store encrypted private key
    const storedData: StoredKeyData = {
      encrypted: encryptedPrivateKey.encrypted,
      iv: encryptedPrivateKey.iv,
      salt: encryptedPrivateKey.salt,
      keyVersion: 1,
      createdAt: new Date().toISOString()
    };
    
    await this.set(`private_key_${userId}`, storedData);
    
    // Also store with recovery phrase as backup
    const recoveryPassword = recoveryPhrase.join(' ');
    const recoveryEncrypted = await E2ECrypto.encryptWithPassword(
      JSON.stringify(keyPair.privateKeyJwk),
      recoveryPassword
    );
    
    await this.set(`recovery_${userId}`, {
      encryptedPrivateKey: recoveryEncrypted.encrypted,
      iv: recoveryEncrypted.iv,
      salt: recoveryEncrypted.salt,
      publicKeyJwk: keyPair.publicKeyJwk,
      keyVersion: 1
    } as RecoveryData);
    
    return {
      publicKeyJwk: keyPair.publicKeyJwk,
      recoveryPhrase
    };
  }
  
  /**
   * Retrieve the private key (decrypted)
   */
  static async getPrivateKey(
    userId: string,
    password: string
  ): Promise<JsonWebKey | null> {
    const storedData = await this.get<StoredKeyData>(`private_key_${userId}`);
    
    if (!storedData) return null;
    
    try {
      const decrypted = await E2ECrypto.decryptWithPassword(
        {
          encrypted: storedData.encrypted,
          iv: storedData.iv,
          salt: storedData.salt
        },
        password
      );
      
      return JSON.parse(decrypted);
    } catch {
      throw new Error('Invalid password or corrupted key');
    }
  }
  
  /**
   * Check if user has stored keys
   */
  static async hasKeys(userId: string): Promise<boolean> {
    const storedData = await this.get<StoredKeyData>(`private_key_${userId}`);
    return storedData !== null;
  }
  
  /**
   * Get the key version for the stored private key
   */
  static async getKeyVersion(userId: string): Promise<number | null> {
    const storedData = await this.get<StoredKeyData>(`private_key_${userId}`);
    return storedData?.keyVersion || null;
  }
  
  /**
   * Recover keys using recovery phrase
   */
  static async recoverWithPhrase(
    userId: string,
    recoveryPhrase: string[],
    newPassword: string
  ): Promise<{ publicKeyJwk: JsonWebKey } | null> {
    const recoveryData = await this.get<RecoveryData>(`recovery_${userId}`);
    
    if (!recoveryData) return null;
    
    try {
      const recoveryPassword = recoveryPhrase.join(' ');
      
      // Decrypt private key with recovery phrase
      const decrypted = await E2ECrypto.decryptWithPassword(
        {
          encrypted: recoveryData.encryptedPrivateKey,
          iv: recoveryData.iv,
          salt: recoveryData.salt
        },
        recoveryPassword
      );
      
      const privateKeyJwk = JSON.parse(decrypted);
      
      // Re-encrypt with new password
      const encryptedPrivateKey = await E2ECrypto.encryptWithPassword(
        JSON.stringify(privateKeyJwk),
        newPassword
      );
      
      // Store with new password
      const storedData: StoredKeyData = {
        encrypted: encryptedPrivateKey.encrypted,
        iv: encryptedPrivateKey.iv,
        salt: encryptedPrivateKey.salt,
        keyVersion: recoveryData.keyVersion,
        createdAt: new Date().toISOString()
      };
      
      await this.set(`private_key_${userId}`, storedData);
      
      return { publicKeyJwk: recoveryData.publicKeyJwk };
    } catch {
      throw new Error('Invalid recovery phrase');
    }
  }
  
  /**
   * Update password for existing keys
   */
  static async updatePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const privateKey = await this.getPrivateKey(userId, oldPassword);
    
    if (!privateKey) {
      throw new Error('No keys found or invalid password');
    }
    
    const storedData = await this.get<StoredKeyData>(`private_key_${userId}`);
    
    // Re-encrypt with new password
    const encryptedPrivateKey = await E2ECrypto.encryptWithPassword(
      JSON.stringify(privateKey),
      newPassword
    );
    
    const newStoredData: StoredKeyData = {
      encrypted: encryptedPrivateKey.encrypted,
      iv: encryptedPrivateKey.iv,
      salt: encryptedPrivateKey.salt,
      keyVersion: storedData?.keyVersion || 1,
      createdAt: storedData?.createdAt || new Date().toISOString()
    };
    
    await this.set(`private_key_${userId}`, newStoredData);
  }
  
  /**
   * Delete all keys for a user
   */
  static async clearKeys(userId: string): Promise<void> {
    await this.delete(`private_key_${userId}`);
    await this.delete(`recovery_${userId}`);
  }
  
  /**
   * Export recovery data (for backup)
   */
  static async exportRecoveryData(userId: string): Promise<RecoveryData | null> {
    return this.get<RecoveryData>(`recovery_${userId}`);
  }
  
  /**
   * Import recovery data (for restore on new device)
   */
  static async importRecoveryData(
    userId: string,
    recoveryData: RecoveryData,
    recoveryPhrase: string[],
    newPassword: string
  ): Promise<void> {
    // Store the recovery data
    await this.set(`recovery_${userId}`, recoveryData);
    
    // Recover with the phrase
    await this.recoverWithPhrase(userId, recoveryPhrase, newPassword);
  }
}
