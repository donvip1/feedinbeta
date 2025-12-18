import React from 'react';
import { Smile, ImageIcon, Pencil } from 'lucide-react';

interface TypingIndicatorProps {
  activityType?: 'typing' | 'emoji' | 'media_upload';
  userName?: string;
}

export const TypingIndicator = ({ activityType = 'typing', userName }: TypingIndicatorProps) => {
  return (
    <div className="flex gap-2 items-center">
      <div className="flex gap-1 px-4 py-3 rounded-2xl bg-accent">
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export const getActivityText = (activityType: 'typing' | 'emoji' | 'media_upload' = 'typing'): string => {
  switch (activityType) {
    case 'emoji':
      return 'finding emoji...';
    case 'media_upload':
      return 'uploading media...';
    case 'typing':
    default:
      return 'typing...';
  }
};

export const getActivityIcon = (activityType: 'typing' | 'emoji' | 'media_upload' = 'typing') => {
  switch (activityType) {
    case 'emoji':
      return <Smile className="w-3 h-3" />;
    case 'media_upload':
      return <ImageIcon className="w-3 h-3" />;
    case 'typing':
    default:
      return <Pencil className="w-3 h-3" />;
  }
};
