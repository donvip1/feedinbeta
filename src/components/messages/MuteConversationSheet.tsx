import React from 'react';
import { BellOff, Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MuteConversationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  onMute: (durationMs: number | null) => void;
  onUnmute: () => void;
}

const MUTE_OPTIONS = [
  { label: '1 hour', duration: 60 * 60 * 1000 },
  { label: '8 hours', duration: 8 * 60 * 60 * 1000 },
  { label: '1 week', duration: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Forever', duration: null },
] as const;

export const MuteConversationSheet = ({
  isOpen,
  onClose,
  isMuted,
  onMute,
  onUnmute,
}: MuteConversationSheetProps) => {
  const handleMute = (durationMs: number | null) => {
    onMute(durationMs);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BellOff className="w-5 h-5" />
            {isMuted ? 'Mute notifications' : 'Mute notifications'}
          </SheetTitle>
        </SheetHeader>

        {isMuted ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This conversation is currently muted.
            </p>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 rounded-xl"
              onClick={() => {
                onUnmute();
                onClose();
              }}
            >
              <BellOff className="w-4 h-4" />
              Unmute conversation
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Choose how long to mute this conversation.
            </p>
            {MUTE_OPTIONS.map((option) => (
              <Button
                key={option.label}
                variant="outline"
                className="w-full justify-start gap-3 h-12 rounded-xl"
                onClick={() => handleMute(option.duration)}
              >
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{option.label}</span>
              </Button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
