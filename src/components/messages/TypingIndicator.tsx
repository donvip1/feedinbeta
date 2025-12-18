import React from 'react';
import { Smile, ImageIcon, Pencil } from 'lucide-react';

interface TypingIndicatorProps {
  activityType?: 'typing' | 'emoji' | 'media_upload';
  userName?: string;
}

export const TypingIndicator = ({ activityType = 'typing', userName }: TypingIndicatorProps) => {
  return (
    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-muted/80 backdrop-blur-sm border border-border/50">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-muted-foreground ml-1">
          {userName && <span className="font-medium text-foreground">{userName}</span>}
          {' '}{getActivityText(activityType)}
        </span>
      </div>
    </div>
  );
};

export const getActivityText = (activityType: 'typing' | 'emoji' | 'media_upload' = 'typing'): string => {
  switch (activityType) {
    case 'emoji':
      return 'choosing emoji...';
    case 'media_upload':
      return 'uploading media...';
    case 'typing':
    default:
      return 'is typing...';
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
