import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompactNotificationProps {
  senderName: string;
  senderAvatar: string | null;
  message: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export const CompactNotification = ({
  senderName,
  senderAvatar,
  message,
  onOpen,
  onDismiss,
}: CompactNotificationProps) => {
  return (
    <div 
      className="fixed bottom-20 right-4 z-50 bg-background border border-border rounded-lg shadow-lg p-3 max-w-sm animate-in slide-in-from-bottom-5 cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={senderAvatar || ''} />
          <AvatarFallback>{senderName[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{senderName}</p>
          <p className="text-xs text-muted-foreground truncate">{message}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="h-6 w-6 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
