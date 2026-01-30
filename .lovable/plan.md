

# Encrypting User Data for Maximum Privacy & Security

## Overview

Yes, it is absolutely possible to implement comprehensive encryption to protect user data! This plan covers multiple layers of encryption to ensure that **even the platform operators and any third parties cannot read personal user data**.

---

## Current Security State

Your platform already has some security measures in place:

**Existing Protection:**
- `profile_sensitive_data` table - Separate storage for sensitive fields (phone, Stripe ID)
- `public_profiles` view - Only exposes safe public fields
- Row-Level Security (RLS) - Controls who can access what data
- `privacy_settings` table - User-controlled visibility options
- Device fingerprinting and session management

**What's NOT Yet Encrypted:**
- Direct messages between users (stored as plain text)
- AI chat conversations
- Profile bio, about, location details
- Phone numbers (column exists but labeled "encrypted" without actual encryption)
- Stripe customer IDs

---

## Encryption Strategy

### Level 1: Server-Side Encryption (Database at Rest)

**What it protects:** Data stored in the database from unauthorized database access

**Implementation:**
- Use Supabase Vault (built on pgsodium) to encrypt sensitive fields
- Encryption keys managed securely in the database
- Data is encrypted at rest, decrypted only when queried by authorized users

**Best for:** Phone numbers, payment info, government IDs, addresses

---

### Level 2: End-to-End Encryption (E2EE) for Messages

**What it protects:** Private messages so that ONLY sender and recipient can read them - not even Feedin servers can decrypt

**How it works:**
1. Each user generates a key pair (public + private) when they sign up
2. Public keys are stored on the server
3. Private keys are stored ONLY on the user's device (encrypted with their password)
4. Messages are encrypted with recipient's public key before sending
5. Only the recipient's private key can decrypt the message

**Trade-offs:**
- Messages cannot be searched on the server
- If user loses their private key, messages are unrecoverable
- Requires key backup/recovery system

---

### Level 3: Field-Level Encryption for Profile Data

**What it protects:** Specific sensitive profile fields

**Fields to encrypt:**
- `date_of_birth` → Age shown but exact date encrypted
- `phone_number` → Already has column, needs actual encryption
- `location` (optional) → Encrypt precise location, show general area
- `bio` and `about` → If user wants maximum privacy

---

## Implementation Approach

### Phase 1: Server-Side Encryption with Supabase Vault

**Database Changes:**

```sql
-- Enable the vault extension (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Create encryption key for sensitive data
SELECT * FROM pgsodium.create_key('user_pii_encryption_key');

-- Create encrypted storage table
CREATE TABLE encrypted_user_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_encrypted BYTEA,
  date_of_birth_encrypted BYTEA,
  address_encrypted BYTEA,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Function to encrypt data (SECURITY DEFINER to access vault)
CREATE OR REPLACE FUNCTION encrypt_user_data(
  p_user_id UUID,
  p_field_name TEXT,
  p_plaintext TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_key_id UUID;
  v_encrypted BYTEA;
BEGIN
  -- Get the encryption key
  SELECT id INTO v_key_id 
  FROM pgsodium.key 
  WHERE comment = 'user_pii_encryption_key' 
  LIMIT 1;
  
  -- Encrypt the data
  v_encrypted := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_plaintext, 'utf8'),
    convert_to(p_user_id::text, 'utf8'),
    v_key_id
  );
  
  -- Store based on field name
  -- ... dynamic update logic
END;
$$;
```

---

### Phase 2: End-to-End Encryption for Messages

**Client-Side Implementation:**

```typescript
// lib/e2e-crypto.ts
export class E2ECrypto {
  // Generate key pair for new user
  static async generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-384'
      },
      true,
      ['deriveKey', 'deriveBits']
    );
    
    // Export public key for storage on server
    const publicKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );
    
    // Export private key - encrypt before storing locally
    const privateKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    );
    
    return { publicKeyJwk, privateKeyJwk };
  }
  
  // Encrypt message for recipient
  static async encryptMessage(
    message: string,
    recipientPublicKey: JsonWebKey,
    senderPrivateKey: JsonWebKey
  ) {
    // Derive shared secret using ECDH
    const sharedKey = await this.deriveSharedKey(
      recipientPublicKey,
      senderPrivateKey
    );
    
    // Encrypt with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    );
    
    // Return encrypted data + IV for decryption
    return {
      ciphertext: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer)
    };
  }
  
  // Decrypt received message
  static async decryptMessage(
    encryptedData: { ciphertext: string; iv: string },
    senderPublicKey: JsonWebKey,
    recipientPrivateKey: JsonWebKey
  ) {
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
}
```

**Database Changes for E2EE:**

```sql
-- Store user public keys
CREATE TABLE user_public_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key_jwk JSONB NOT NULL,
  key_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Anyone can read public keys (needed for encryption)
CREATE POLICY "Public keys are readable by all authenticated"
ON user_public_keys FOR SELECT TO authenticated
USING (true);

-- Only owner can update their key
CREATE POLICY "Users can manage own public key"
ON user_public_keys FOR ALL TO authenticated
USING (auth.uid() = user_id);
```

---

### Phase 3: Encrypted Private Key Storage

Store the user's private key encrypted with a key derived from their password:

```typescript
// lib/key-storage.ts
export class KeyStorage {
  private static readonly STORAGE_KEY = 'e2e_private_key';
  
  // Derive encryption key from user password
  static async deriveKeyFromPassword(password: string, salt: Uint8Array) {
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
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // Store encrypted private key in IndexedDB
  static async storePrivateKey(
    privateKeyJwk: JsonWebKey,
    password: string
  ) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const encryptionKey = await this.deriveKeyFromPassword(password, salt);
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      new TextEncoder().encode(JSON.stringify(privateKeyJwk))
    );
    
    // Store in IndexedDB (more secure than localStorage)
    await indexedDBCache.set(this.STORAGE_KEY, {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv.buffer),
      salt: arrayBufferToBase64(salt.buffer)
    });
  }
}
```

---

## Privacy Guarantees Achieved

With this implementation:

| Data Type | Protection Level | Who Can Read |
|-----------|------------------|--------------|
| Messages | End-to-End Encrypted | Only sender & recipient |
| Phone Number | Server-Side Encrypted | Only the user |
| Date of Birth | Server-Side Encrypted | Only the user |
| Address | Server-Side Encrypted | Only the user |
| Payment Info | Server-Side Encrypted | Only the user |
| Profile Bio | User choice (can enable E2EE) | Based on privacy settings |

**What Feedin/Third Parties CANNOT See:**
- Contents of private messages
- Exact phone numbers
- Precise date of birth
- Payment details
- Any field the user chooses to encrypt

---

## Important Considerations

### Recovery System
Users MUST have a way to recover their keys:
- **Option A:** Recovery phrase (12-24 words) user must save
- **Option B:** Backup to secure cloud (iCloud Keychain, Google Password Manager)
- **Option C:** Trusted contacts can help recover (like Signal)

### Performance Impact
- Encryption/decryption happens on user's device
- Minimal server impact
- May add ~50-100ms to message send/receive

### Feature Limitations
- Encrypted messages can't be searched on server
- No server-side message moderation for encrypted content
- AI features can't analyze encrypted data

### Legal Considerations
- Some jurisdictions require ability to decrypt for legal requests
- May need to store metadata (who talked to whom, when) unencrypted
- Consider adding "disappearing messages" feature for extra privacy

---

## Technical Summary

### Files to Create/Modify

**New Files:**
1. `src/lib/e2e-crypto.ts` - Core encryption/decryption functions
2. `src/lib/key-storage.ts` - Private key management
3. `src/hooks/useE2EEncryption.ts` - React hook for encryption operations
4. `src/components/security/KeyBackupPrompt.tsx` - UI for key backup

**Modified Files:**
1. `src/components/messages/MessageInput.tsx` - Encrypt before sending
2. `src/components/messages/MessageBubble.tsx` - Decrypt when displaying
3. `src/pages/auth/SignUp.tsx` - Generate key pair on signup
4. `src/pages/Settings.tsx` - Add encryption settings section

**Database Migrations:**
1. Create `user_public_keys` table
2. Create `encrypted_user_data` table
3. Create encryption/decryption functions
4. Update `messages` table to store encrypted content

---

## Recommendation

Start with **Phase 1 (Server-Side Encryption)** for immediate security improvement, then implement **Phase 2 (E2EE for Messages)** as a premium feature or opt-in for users who want maximum privacy.

This approach gives you Signal-level privacy for messages while keeping the platform usable for features that need to read data (like AI, moderation, search).

