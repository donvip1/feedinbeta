/**
 * Secure Key Storage Library
 * 
 * Manages encrypted storage of E2E encryption keys using IndexedDB.
 * Private keys are encrypted with a PIN-derived key before storage.
 * Sessions persist for 7 days before requiring PIN re-entry.
 */

import { E2ECrypto, type KeyPair } from './e2e-crypto';

interface StoredKeyData {
  encrypted: string;
  iv: string;
  salt: string;
  keyVersion: number;
  createdAt: string;
}

interface SessionData {
  encryptedPin: string;      // PIN encrypted with device key
  iv: string;
  deviceKey: string;         // Device-specific key (stored in IndexedDB)
  unlockedAt: string;        // ISO timestamp
  expiresAt: string;         // 7 days from unlockedAt
}

const DB_NAME = 'feedin_e2e_keys';
const STORE_NAME = 'encryption_keys';
const DB_VERSION = 1;

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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
   * Convert ArrayBuffer to Base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  /**
   * Encrypt data with a device-specific key (for session persistence)
   */
  private static async encryptWithDeviceKey(
    data: string,
    deviceKey: Uint8Array
  ): Promise<{ encrypted: string; iv: string }> {
    // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
    const keyBuffer = new ArrayBuffer(deviceKey.length);
    new Uint8Array(keyBuffer).set(deviceKey);
    
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ivBuffer = new ArrayBuffer(iv.length);
    new Uint8Array(ivBuffer).set(iv);
    
    const encoded = new TextEncoder().encode(data);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      encoded
    );
    
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer)
    };
  }

  /**
   * Decrypt data with a device-specific key
   */
  private static async decryptWithDeviceKey(
    encryptedData: string,
    iv: string,
    deviceKey: ArrayBuffer
  ): Promise<string> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      deviceKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToArrayBuffer(iv) },
      key,
      this.base64ToArrayBuffer(encryptedData)
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  /**
   * Generate and store a new key pair using 8-digit PIN
   * Returns the public key (to be stored on server)
   */
  static async generateAndStoreKeyPair(
    userId: string,
    pinCode: string
  ): Promise<{ publicKeyJwk: JsonWebKey }> {
    const keyPair = await E2ECrypto.generateKeyPair();
    
    // Encrypt private key with PIN
    const encryptedPrivateKey = await E2ECrypto.encryptWithPassword(
      JSON.stringify(keyPair.privateKeyJwk),
      pinCode
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
    
    // Save session for 7 days
    await this.saveSession(userId, pinCode);
    
    return {
      publicKeyJwk: keyPair.publicKeyJwk
    };
  }
  
  /**
   * Retrieve the private key (decrypted)
   */
  static async getPrivateKey(
    userId: string,
    pinCode: string
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
        pinCode
      );
      
      return JSON.parse(decrypted);
    } catch {
      throw new Error('Invalid PIN or corrupted key');
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
   * Save unlock session (called when user enters PIN)
   * Session persists for 7 days
   */
  static async saveSession(userId: string, pinCode: string): Promise<void> {
    // Generate a random device key
    const deviceKey = window.crypto.getRandomValues(new Uint8Array(32));
    
    // Encrypt the PIN with device key
    const encrypted = await this.encryptWithDeviceKey(pinCode, deviceKey);
    
    const session: SessionData = {
      encryptedPin: encrypted.encrypted,
      iv: encrypted.iv,
      deviceKey: this.arrayBufferToBase64(deviceKey.buffer),
      unlockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    };
    
    await this.set(`session_${userId}`, session);
  }

  /**
   * Check if session is still valid and return PIN if so
   */
  static async getValidSession(userId: string): Promise<string | null> {
    const session = await this.get<SessionData>(`session_${userId}`);
    
    if (!session) return null;
    
    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.delete(`session_${userId}`);
      return null;
    }
    
    // Decrypt and return PIN
    try {
      const deviceKey = this.base64ToArrayBuffer(session.deviceKey);
      const pin = await this.decryptWithDeviceKey(
        session.encryptedPin,
        session.iv,
        deviceKey
      );
      return pin;
    } catch {
      return null;
    }
  }

  /**
   * Get session expiry date
   */
  static async getSessionExpiry(userId: string): Promise<Date | null> {
    const session = await this.get<SessionData>(`session_${userId}`);
    if (!session) return null;
    return new Date(session.expiresAt);
  }

  /**
   * Clear session (manual lock or logout)
   */
  static async clearSession(userId: string): Promise<void> {
    await this.delete(`session_${userId}`);
  }

  /**
   * Extend session (refresh the 7 days)
   */
  static async extendSession(userId: string): Promise<void> {
    const session = await this.get<SessionData>(`session_${userId}`);
    if (session) {
      session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
      await this.set(`session_${userId}`, session);
    }
  }
  
  /**
   * Update PIN for existing keys
   */
  static async updatePin(
    userId: string,
    oldPin: string,
    newPin: string
  ): Promise<void> {
    const privateKey = await this.getPrivateKey(userId, oldPin);
    
    if (!privateKey) {
      throw new Error('No keys found or invalid PIN');
    }
    
    const storedData = await this.get<StoredKeyData>(`private_key_${userId}`);
    
    // Re-encrypt with new PIN
    const encryptedPrivateKey = await E2ECrypto.encryptWithPassword(
      JSON.stringify(privateKey),
      newPin
    );
    
    const newStoredData: StoredKeyData = {
      encrypted: encryptedPrivateKey.encrypted,
      iv: encryptedPrivateKey.iv,
      salt: encryptedPrivateKey.salt,
      keyVersion: storedData?.keyVersion || 1,
      createdAt: storedData?.createdAt || new Date().toISOString()
    };
    
    await this.set(`private_key_${userId}`, newStoredData);
    
    // Update session with new PIN
    await this.saveSession(userId, newPin);
  }
  
  /**
   * Delete all keys for a user
   */
  static async clearKeys(userId: string): Promise<void> {
    await this.delete(`private_key_${userId}`);
    await this.delete(`session_${userId}`);
  }
}
