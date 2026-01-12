import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, X } from 'lucide-react';

interface CancelOrderModalProps {
  onConfirm: (reason: string) => Promise<void>;
  isProcessing: boolean;
  cancellationCount: number;
  children: React.ReactNode;
}

export const CancelOrderModal = ({ 
  onConfirm, 
  isProcessing, 
  cancellationCount,
  children 
}: CancelOrderModalProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (reason.trim().length < 10) {
      setError('Please provide a reason (minimum 10 characters)');
      return;
    }
    
    setError('');
    await onConfirm(reason);
    setOpen(false);
    setReason('');
  };

  const warningsRemaining = 3 - cancellationCount;
  const isLastWarning = cancellationCount === 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Cancel Order
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for cancelling this order.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Banner */}
        <div className={`p-3 rounded-lg ${isLastWarning ? 'bg-destructive/10 border border-destructive/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-4 h-4 mt-0.5 ${isLastWarning ? 'text-destructive' : 'text-amber-500'}`} />
            <div className="text-sm">
              {isLastWarning ? (
                <p className="text-destructive font-medium">
                  ⚠️ This is your last warning! Cancelling this order will result in a 2-week ban from buying credits.
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400">
                  You have <span className="font-bold">{warningsRemaining}</span> cancellation{warningsRemaining !== 1 ? 's' : ''} remaining before you are banned for 2 weeks.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for cancellation *</Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you're cancelling this order (minimum 10 characters)..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              rows={4}
              className="resize-none"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 characters minimum
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isProcessing}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isProcessing || reason.trim().length < 10}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Cancelling...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <X className="w-4 h-4" />
                Cancel Order
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
