import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Copy, Check, AlertTriangle, Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface KeyBackupPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recoveryPhrase: string[];
  onConfirm: () => void;
}

export function KeyBackupPrompt({
  open,
  onOpenChange,
  recoveryPhrase,
  onConfirm
}: KeyBackupPromptProps) {
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryPhrase.join(' '));
      setCopied(true);
      toast.success('Recovery phrase copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleConfirm = () => {
    if (!confirmed || !understood) {
      toast.error('Please confirm you have saved your recovery phrase');
      return;
    }
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Save Your Recovery Phrase
          </DialogTitle>
          <DialogDescription>
            This phrase is the ONLY way to recover your encrypted messages if you lose access to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Important!</p>
              <p className="text-muted-foreground">
                If you lose this phrase, your encrypted messages will be <strong>permanently unrecoverable</strong>.
              </p>
            </div>
          </div>

          {/* Recovery Phrase Display */}
          <div className="relative">
            <div className="p-4 bg-muted rounded-lg border">
              <AnimatePresence mode="wait">
                {showPhrase ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-3 gap-2"
                  >
                    {recoveryPhrase.map((word, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-background rounded text-sm"
                      >
                        <span className="text-muted-foreground text-xs w-4">
                          {index + 1}.
                        </span>
                        <span className="font-mono">{word}</span>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-8 gap-2"
                  >
                    <Lock className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">
                      Click to reveal your recovery phrase
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Toggle visibility */}
            <div className="flex justify-between mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPhrase(!showPhrase)}
              >
                {showPhrase ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Reveal
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!showPhrase}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Confirmation checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <span className="text-sm">
                I have saved my recovery phrase in a safe place
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked === true)}
              />
              <span className="text-sm">
                I understand that if I lose this phrase, my encrypted messages cannot be recovered
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!confirmed || !understood}
            >
              I've Saved My Phrase
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
