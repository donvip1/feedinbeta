/**
 * End-to-End Encryption Library
 * 
 * Provides ECDH key exchange and AES-GCM encryption for secure messaging.
 * Only the sender and recipient can decrypt messages - not even the server.
 */

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  senderKeyVersion?: number;
}

export interface KeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export class E2ECrypto {
  private static readonly CURVE = 'P-384';
  private static readonly AES_KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  
  /**
   * Generate a new ECDH key pair for a user
   * Public key is stored on server, private key stays on device
   */
  static async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: this.CURVE
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );
    
    const publicKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );
    
    const privateKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    );
    
    return { publicKeyJwk, privateKeyJwk };
  }
  
  /**
   * Generate a recovery phrase (12 words) from entropy
   * This can be used to derive a master key for key backup
   */
  static generateRecoveryPhrase(): string[] {
    // BIP39-style word list (simplified - in production use full BIP39)
    const wordList = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'action', 'actor', 'actress', 'actual', 'adapt',
      'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance', 'advice',
      'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree',
      'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol',
      'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha',
      'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among', 'amount',
      'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry', 'animal',
      'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety',
      'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch',
      'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army',
      'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist',
      'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma',
      'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audit',
      'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid',
      'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby',
      'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo',
      'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base', 'basic',
      'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become', 'beef',
      'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench',
      'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid',
      'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black', 'blade',
      'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood', 'blossom',
      'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body', 'boil',
      'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow',
      'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand',
      'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright',
      'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother', 'brown',
      'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk',
      'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business',
      'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus'
    ];
    
    const entropy = window.crypto.getRandomValues(new Uint8Array(16)); // 128 bits
    const words: string[] = [];
    
    for (let i = 0; i < 12; i++) {
      const index = (entropy[i] + (entropy[(i + 1) % 16] << 8)) % wordList.length;
      words.push(wordList[index]);
    }
    
    return words;
  }
  
  /**
   * Import a JWK public key for ECDH operations
   */
  private static async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: this.CURVE
      },
      false,
      []
    );
  }
  
  /**
   * Import a JWK private key for ECDH operations
   */
  private static async importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: this.CURVE
      },
      false,
      ['deriveKey', 'deriveBits']
    );
  }
  
  /**
   * Derive a shared AES key from ECDH key exchange
   */
  private static async deriveSharedKey(
    theirPublicKey: JsonWebKey,
    myPrivateKey: JsonWebKey
  ): Promise<CryptoKey> {
    const publicKey = await this.importPublicKey(theirPublicKey);
    const privateKey = await this.importPrivateKey(myPrivateKey);
    
    return window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: this.AES_KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Encrypt a message for a recipient
   * Uses ECDH to derive shared secret, then AES-GCM for encryption
   */
  static async encryptMessage(
    message: string,
    recipientPublicKey: JsonWebKey,
    senderPrivateKey: JsonWebKey,
    senderKeyVersion?: number
  ): Promise<EncryptedData> {
    const sharedKey = await this.deriveSharedKey(
      recipientPublicKey,
      senderPrivateKey
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const encoded = new TextEncoder().encode(message);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    );
    
    return {
      ciphertext: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer),
      senderKeyVersion
    };
  }
  
  /**
   * Decrypt a received message
   * Uses ECDH to derive shared secret, then AES-GCM for decryption
   */
  static async decryptMessage(
    encryptedData: EncryptedData,
    senderPublicKey: JsonWebKey,
    recipientPrivateKey: JsonWebKey
  ): Promise<string> {
    const sharedKey = await this.deriveSharedKey(
      senderPublicKey,
      recipientPrivateKey
    );
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.base64ToArrayBuffer(encryptedData.iv)
      },
      sharedKey,
      this.base64ToArrayBuffer(encryptedData.ciphertext)
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  /**
   * Encrypt data using a password-derived key
   * Used for encrypting the private key for local storage
   */
  static async encryptWithPassword(
    data: string,
    password: string
  ): Promise<{ encrypted: string; iv: string; salt: string }> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKeyFromPassword(password, salt);
    
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const encoded = new TextEncoder().encode(data);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer),
      salt: this.arrayBufferToBase64(salt.buffer)
    };
  }
  
  /**
   * Decrypt data using a password-derived key
   */
  static async decryptWithPassword(
    encryptedData: { encrypted: string; iv: string; salt: string },
    password: string
  ): Promise<string> {
    const salt = new Uint8Array(this.base64ToArrayBuffer(encryptedData.salt));
    const key = await this.deriveKeyFromPassword(password, salt);
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.base64ToArrayBuffer(encryptedData.iv)
      },
      key,
      this.base64ToArrayBuffer(encryptedData.encrypted)
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  /**
   * Derive an AES key from a password using PBKDF2
   */
  private static async deriveKeyFromPassword(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt) as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.AES_KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Convert ArrayBuffer to Base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
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
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Create a new ArrayBuffer and copy data to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }
  
  /**
   * Hash data using SHA-256
   * Useful for creating deterministic IDs without exposing original data
   */
  static async hash(data: string): Promise<string> {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Convert Uint8Array to ArrayBuffer safely
   */
  private static uint8ArrayToArrayBuffer(array: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(array.length);
    new Uint8Array(buffer).set(array);
    return buffer;
  }
}
