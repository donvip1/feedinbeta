/**
 * Encryption Settings Component
 * 
 * Allows users to enable, manage, and unlock E2E encryption with an 8-digit PIN
 */

import { useState, useRef, useEffect } from 'react';
import { useE2EEncryption } from '@/hooks/useE2EEncryption';
import { E2ECrypto } from '@/lib/e2e-crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Lock, Unlock, Shield, ShieldCheck, RefreshCw, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { differenceInDays, differenceInHours } from 'date-fns';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showPin?: boolean;
}

const PinInput = ({ value, onChange, disabled, showPin }: PinInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 8);
    onChange(newValue);
  };

  const handleBoxClick = () => {
    inputRef.current?.focus();
  };
  
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="absolute opacity-0 w-full h-full"
        maxLength={8}
        autoComplete="off"
      />
      <div 
        className="flex items-center justify-center gap-1 cursor-text"
        onClick={handleBoxClick}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-10 h-12 border-2 rounded-lg flex items-center justify-center text-lg font-mono transition-colors ${
              value.length === i ? 'border-primary' : 'border-border'
            } ${disabled ? 'bg-muted' : 'bg-background'}`}
          >
            {value[i] ? (showPin ? value[i] : '●') : ''}
          </div>
        ))}
        <span className="text-2xl mx-1 text-muted-foreground">-</span>
        {[4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className={`w-10 h-12 border-2 rounded-lg flex items-center justify-center text-lg font-mono transition-colors ${
              value.length === i ? 'border-primary' : 'border-border'
            } ${disabled ? 'bg-muted' : 'bg-background'}`}
          >
            {value[i] ? (showPin ? value[i] : '●') : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export const EncryptionSettings = () => {
  const {
    hasKeys,
    isLoading,
    isUnlocked,
    isInitializing,
    isChangingPin,
    sessionExpiry,
    initializeEncryption,
    unlockKeys,
    lockKeys,
    changePin
  } = useE2EEncryption();

  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showChangePinDialog, setShowChangePinDialog] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [confirmPinCode, setConfirmPinCode] = useState('');
  const [oldPinCode, setOldPinCode] = useState('');
  const [newPinCode, setNewPinCode] = useState('');
  const [confirmNewPinCode, setConfirmNewPinCode] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Reset form when dialogs close
  useEffect(() => {
    if (!showSetupDialog) {
      setPinCode('');
      setConfirmPinCode('');
      setError('');
      setShowPin(false);
    }
  }, [showSetupDialog]);

  useEffect(() => {
    if (!showUnlockDialog) {
      setPinCode('');
      setError('');
      setShowPin(false);
    }
  }, [showUnlockDialog]);

  useEffect(() => {
    if (!showChangePinDialog) {
      setOldPinCode('');
      setNewPinCode('');
      setConfirmNewPinCode('');
      setError('');
      setShowPin(false);
    }
  }, [showChangePinDialog]);

  const handleSetup = () => {
    if (pinCode.length !== 8) {
      setError('Please enter all 8 digits');
      return;
    }
    if (pinCode !== confirmPinCode) {
      setError('PINs do not match');
      return;
    }
    
    initializeEncryption(pinCode, {
      onSuccess: () => {
        setShowSetupDialog(false);
      }
    });
  };

  const handleUnlock = async () => {
    if (pinCode.length !== 8) {
      setError('Please enter all 8 digits');
      return;
    }
    
    setUnlocking(true);
    setError('');
    
    const success = await unlockKeys(pinCode);
    
    if (success) {
      setShowUnlockDialog(false);
    } else {
      setError('Incorrect PIN. Please try again.');
    }
    
    setUnlocking(false);
  };

  const handleChangePin = () => {
    if (oldPinCode.length !== 8) {
      setError('Please enter your current PIN');
      return;
    }
    if (newPinCode.length !== 8) {
      setError('Please enter all 8 digits for new PIN');
      return;
    }
    if (newPinCode !== confirmNewPinCode) {
      setError('New PINs do not match');
      return;
    }
    
    changePin(
      { oldPin: oldPinCode, newPin: newPinCode },
      {
        onSuccess: () => {
          setShowChangePinDialog(false);
        },
        onError: () => {
          setError('Incorrect current PIN');
        }
      }
    );
  };

  const handleLock = async () => {
    await lockKeys();
  };

  const getSessionExpiryText = () => {
    if (!sessionExpiry) return null;
    
    const now = new Date();
    const daysLeft = differenceInDays(sessionExpiry, now);
    const hoursLeft = differenceInHours(sessionExpiry, now);
    
    if (daysLeft > 0) {
      return `Session expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
    } else if (hoursLeft > 0) {
      return `Session expires in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
    } else {
      return 'Session expires soon';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-full bg-primary/10">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">End-to-End Encryption</h3>
          <p className="text-sm text-muted-foreground">
            Protect your private messages
          </p>
        </div>
      </div>

      {/* Not Enabled State */}
      {!hasKeys && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">
              Enable end-to-end encryption to protect your private messages. 
              Only you and the recipient can read encrypted messages - not even FEEDIN can decrypt them.
            </p>
          </div>
          
          <Button 
            onClick={() => setShowSetupDialog(true)}
            className="w-full bg-gradient-primary"
          >
            <Lock className="w-4 h-4 mr-2" />
            Enable Message Encryption
          </Button>
        </div>
      )}

      {/* Enabled but Locked State */}
      {hasKeys && !isUnlocked && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <Lock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              Messages locked - Enter your PIN to read encrypted messages
            </span>
          </div>
          
          <Button 
            onClick={() => setShowUnlockDialog(true)}
            className="w-full"
            variant="outline"
          >
            <Unlock className="w-4 h-4 mr-2" />
            Unlock Messages
          </Button>
        </div>
      )}

      {/* Enabled and Unlocked State */}
      {hasKeys && isUnlocked && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <div className="flex-1">
              <span className="text-sm text-green-600 dark:text-green-400">
                Encryption active
              </span>
              {sessionExpiry && (
                <p className="text-xs text-muted-foreground">
                  {getSessionExpiryText()}
                </p>
              )}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Your messages are encrypted. Not even FEEDIN can read your private chats.
          </p>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleLock}
              variant="outline"
              className="flex-1"
            >
              <Lock className="w-4 h-4 mr-2" />
              Lock Now
            </Button>
            <Button 
              onClick={() => setShowChangePinDialog(true)}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Change PIN
            </Button>
          </div>
        </div>
      )}

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Create Your Secret Code
            </DialogTitle>
            <DialogDescription>
              Create an 8-digit secret code that only you will know. 
              This protects your private messages.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Enter your 8-digit code</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <PinInput 
                value={pinCode} 
                onChange={(v) => { setPinCode(v); setError(''); }}
                disabled={isInitializing}
                showPin={showPin}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Confirm your code</Label>
              <PinInput 
                value={confirmPinCode} 
                onChange={(v) => { setConfirmPinCode(v); setError(''); }}
                disabled={isInitializing}
                showPin={showPin}
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Remember this code! We cannot recover it if you forget.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSetupDialog(false)}
              disabled={isInitializing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSetup}
              disabled={isInitializing || pinCode.length !== 8 || confirmPinCode.length !== 8}
              className="bg-gradient-primary"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enabling...
                </>
              ) : (
                'Enable Encryption'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Enter Your Code
            </DialogTitle>
            <DialogDescription>
              Enter your 8-digit code to unlock encrypted messages
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your 8-digit code</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <PinInput 
                value={pinCode} 
                onChange={(v) => { setPinCode(v); setError(''); }}
                disabled={unlocking}
                showPin={showPin}
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUnlockDialog(false)}
              disabled={unlocking}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUnlock}
              disabled={unlocking || pinCode.length !== 8}
            >
              {unlocking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unlocking...
                </>
              ) : (
                'Unlock'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change PIN Dialog */}
      <Dialog open={showChangePinDialog} onOpenChange={setShowChangePinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Change Your Code
            </DialogTitle>
            <DialogDescription>
              Enter your current code and choose a new one
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Current code</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <PinInput 
                value={oldPinCode} 
                onChange={(v) => { setOldPinCode(v); setError(''); }}
                disabled={isChangingPin}
                showPin={showPin}
              />
            </div>
            
            <div className="space-y-2">
              <Label>New code</Label>
              <PinInput 
                value={newPinCode} 
                onChange={(v) => { setNewPinCode(v); setError(''); }}
                disabled={isChangingPin}
                showPin={showPin}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Confirm new code</Label>
              <PinInput 
                value={confirmNewPinCode} 
                onChange={(v) => { setConfirmNewPinCode(v); setError(''); }}
                disabled={isChangingPin}
                showPin={showPin}
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowChangePinDialog(false)}
              disabled={isChangingPin}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleChangePin}
              disabled={isChangingPin || oldPinCode.length !== 8 || newPinCode.length !== 8 || confirmNewPinCode.length !== 8}
            >
              {isChangingPin ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Code'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EncryptionSettings;
