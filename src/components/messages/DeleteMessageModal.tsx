import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Trash2, Users, User, EyeOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeleteOption = 'for_me' | 'for_everyone' | 'for_everyone_silent';

interface DeleteMessageModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: (option: DeleteOption) => void;
  isOwnMessage: boolean;
  messageContent: string;
  canDeleteForEveryone: boolean; // Within time limit (e.g., 24 hours)
}

export const DeleteMessageModal = ({
  open,
  onClose,
  onDelete,
  isOwnMessage,
  messageContent,
  canDeleteForEveryone,
}: DeleteMessageModalProps) => {
  const [selectedOption, setSelectedOption] = useState<DeleteOption>('for_me');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(selectedOption);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const options = [
    {
      value: 'for_me' as DeleteOption,
      icon: User,
      label: 'Delete for me',
      description: 'This message will be removed from your chat only',
      available: true,
    },
    {
      value: 'for_everyone' as DeleteOption,
      icon: Users,
      label: 'Delete for everyone',
      description: 'This message will be deleted for all participants. They\'ll see "This message was deleted"',
      available: isOwnMessage && canDeleteForEveryone,
    },
    {
      value: 'for_everyone_silent' as DeleteOption,
      icon: EyeOff,
      label: 'Delete silently',
      description: 'Message disappears without any notification (only if unread)',
      available: isOwnMessage && canDeleteForEveryone,
    },
  ];

  const availableOptions = options.filter((opt) => opt.available);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete Message
          </DialogTitle>
          <DialogDescription>
            Choose how you want to delete this message
          </DialogDescription>
        </DialogHeader>

        {/* Message Preview */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {messageContent.length > 100 
              ? messageContent.slice(0, 100) + '...' 
              : messageContent}
          </p>
        </div>

        {/* Delete Options */}
        <RadioGroup
          value={selectedOption}
          onValueChange={(value) => setSelectedOption(value as DeleteOption)}
          className="space-y-3"
        >
          {availableOptions.map((option) => {
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  selectedOption === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <RadioGroupItem value={option.value} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{option.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </label>
            );
          })}
        </RadioGroup>

        {/* Warning for silent delete */}
        {selectedOption === 'for_everyone_silent' && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Silent delete only works if the recipient hasn't seen the message yet. 
              If they've already read it, they'll still see "message deleted".
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
