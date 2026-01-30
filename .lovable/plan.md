
# Plan: Weekly PIN Unlock with Persistent Session

## Overview

Modify the E2E encryption system so users only need to enter their 8-digit PIN **once per week** instead of every session. The unlocked state persists across browser sessions, page refreshes, and app reopens.

---

## Current Behavior vs. New Behavior

| Current | New (Weekly) |
|---------|--------------|
| PIN required every page refresh | PIN required once per week |
| Session stored in React state (lost on reload) | Session persisted in IndexedDB with expiry |
| User must unlock constantly | Seamless experience like WhatsApp |

---

## How It Will Work

```
User Flow:
┌─────────────────────────────────────────┐
│  First Time Setup                       │
│  → Enter 8-digit PIN                    │
│  → Keys generated & session saved       │
│  → Unlocked for 7 days                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Normal Usage (within 7 days)           │
│  → Open app                             │
│  → Automatically unlocked               │
│  → Send/receive encrypted messages      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  After 7 Days                           │
│  → Session expired                      │
│  → Prompt for PIN                       │
│  → Re-unlock for another 7 days         │
└─────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Add Session Persistence to Key Storage

**File:** `src/lib/key-storage.ts`

Add new methods and data structure for persistent sessions:

```typescript
// New interface for session data
interface SessionData {
  encryptedPin: string;      // PIN encrypted with device key
  iv: string;
  deviceKey: string;         // Device-specific key (stored in IndexedDB)
  unlockedAt: string;        // ISO timestamp
  expiresAt: string;         // 7 days from unlockedAt
}

// Constants
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// New methods:

// Save unlock session (called when user enters PIN)
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

// Check if session is still valid
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

// Clear session (manual lock or logout)
static async clearSession(userId: string): Promise<void> {
  await this.delete(`session_${userId}`);
}

// Extend session (refresh the 7 days)
static async extendSession(userId: string): Promise<void> {
  const session = await this.get<SessionData>(`session_${userId}`);
  if (session) {
    session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await this.set(`session_${userId}`, session);
  }
}
```

---

### 2. Update E2E Encryption Hook

**File:** `src/hooks/useE2EEncryption.ts`

Modify to auto-restore session on load:

```typescript
// Add to state
const [sessionPinCode, setSessionPinCode] = useState<string | null>(null);

// Auto-restore session on mount
useEffect(() => {
  const restoreSession = async () => {
    if (!user?.id) return;
    
    try {
      // Check for valid saved session
      const savedPin = await KeyStorage.getValidSession(user.id);
      
      if (savedPin) {
        // Verify the PIN still works by testing decryption
        const privateKey = await KeyStorage.getPrivateKey(user.id, savedPin);
        if (privateKey) {
          setSessionPinCode(savedPin);
          // Optionally extend session on each app open
          await KeyStorage.extendSession(user.id);
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
  };
  
  restoreSession();
}, [user?.id]);

// Update unlock to save session
const unlockKeys = useCallback(async (pinCode: string): Promise<boolean> => {
  if (!user?.id) return false;

  try {
    const privateKey = await KeyStorage.getPrivateKey(user.id, pinCode);
    if (privateKey) {
      setSessionPinCode(pinCode);
      // Save session for 7 days
      await KeyStorage.saveSession(user.id, pinCode);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}, [user?.id]);

// Update lock to clear session
const lockKeys = useCallback(async () => {
  if (user?.id) {
    await KeyStorage.clearSession(user.id);
  }
  setSessionPinCode(null);
}, [user?.id]);
```

---

### 3. Update Encryption Settings UI

**File:** `src/components/settings/EncryptionSettings.tsx`

Add visual session info:

```tsx
// Show session expiry
{isUnlocked && (
  <div className="text-sm text-muted-foreground">
    Session expires in X days
  </div>
)}

// Lock button clears the persistent session
<Button onClick={handleLock}>
  <Lock className="w-4 h-4 mr-2" />
  Lock Now (Will require PIN again)
</Button>
```

---

### 4. Handle Logout/Sign Out

**File:** `src/hooks/useAuth.tsx` or relevant auth handler

Clear encryption session on logout:

```typescript
const signOut = async () => {
  // Clear E2E session
  if (user?.id) {
    await KeyStorage.clearSession(user.id);
  }
  
  // Existing signout logic...
};
```

---

## Security Considerations

### How PIN is Protected in Persistent Session

1. **Device Key**: A random 256-bit key is generated per device
2. **PIN Encryption**: The PIN is encrypted with AES-GCM using the device key
3. **Storage**: Both encrypted PIN and device key stored in IndexedDB
4. **Expiry**: Automatic expiration after 7 days
5. **Manual Lock**: User can lock anytime, which clears the session

### Attack Scenarios

| Attack | Protection |
|--------|------------|
| Someone accesses browser | PIN encrypted in IndexedDB (not plaintext) |
| Stolen device | 7-day auto-expiry limits exposure |
| Browser extension access | IndexedDB is origin-locked |
| User logs out | Session cleared on signout |

### Trade-offs

- **Convenience**: Users don't re-enter PIN constantly
- **Security**: Slightly lower than requiring PIN every time
- **Similar to**: WhatsApp, Signal (which stay unlocked on device)

---

## Files to Modify

1. **`src/lib/key-storage.ts`** - Add session persistence methods
2. **`src/hooks/useE2EEncryption.ts`** - Auto-restore session on mount
3. **`src/components/settings/EncryptionSettings.tsx`** - Show session info
4. **`src/lib/e2e-crypto.ts`** - Update to use 8-digit PIN instead of phrases (from previous plan)

---

## User Experience Summary

```
Week 1, Day 1:
  → User enables E2E encryption
  → Enters 8-digit PIN: 1234-5678
  → Keys generated, session saved
  → ✅ Unlocked

Week 1, Days 2-7:
  → User opens app each day
  → Automatically unlocked (no PIN needed)
  → ✅ Seamless experience

Week 2, Day 1:
  → Session expired
  → "Enter your PIN to unlock messages"
  → User enters 1234-5678
  → ✅ Unlocked for another 7 days

Manual Lock:
  → User taps "Lock Now"
  → Session cleared immediately
  → Must enter PIN to unlock again
```

This gives WhatsApp-level convenience while maintaining strong encryption.
