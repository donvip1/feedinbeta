import React from 'react';
import { Smile, ImageIcon, Pencil, Mic, Sticker, Video, FileText, MessageCircle } from 'lucide-react';

export type ActivityType = 
  | 'typing' 
  | 'emoji' 
  | 'sticker'
  | 'voice_recording' 
  | 'uploading_image'
  | 'uploading_video'
  | 'uploading_file'
  | 'focused';

interface TypingIndicatorProps {
  activityType?: ActivityType;
  userName?: string;
  compact?: boolean;
}

export const TypingIndicator = ({ activityType = 'typing', userName, compact = false }: TypingIndicatorProps) => {
  const Icon = getActivityIcon(activityType);
  const text = getActivityText(activityType);
  const color = getActivityColor(activityType);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 animate-pulse">
        <span className={`${color}`}>{Icon}</span>
        <span className={`text-[10px] ${color} font-medium`}>{text}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-muted/80 backdrop-blur-sm border border-border/50">
        {/* Activity icon with animation */}
        <div className={`${color} ${activityType === 'voice_recording' ? 'animate-pulse' : ''}`}>
          {Icon}
        </div>
        
        {/* Animated dots */}
        <div className="flex gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} animate-bounce`} style={{ animationDelay: '0ms' }} />
          <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} animate-bounce`} style={{ animationDelay: '150ms' }} />
          <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} animate-bounce`} style={{ animationDelay: '300ms' }} />
        </div>
        
        <span className="text-xs text-muted-foreground ml-1">
          {userName && <span className="font-medium text-foreground">{userName}</span>}
          {' '}{text}
        </span>
      </div>
    </div>
  );
};

// Compact indicator for conversation list
export const ActivityBadge = ({ activityType, userName }: { activityType: ActivityType; userName?: string }) => {
  const Icon = getActivityIcon(activityType);
  const text = getActivityText(activityType);
  const color = getActivityColor(activityType);

  return (
    <div className="flex items-center gap-1 animate-pulse">
      <span className={color}>{Icon}</span>
      <span className={`text-xs ${color}`}>
        {userName ? `${userName} ${text}` : text}
      </span>
    </div>
  );
};

export const getActivityText = (activityType: ActivityType = 'typing'): string => {
  switch (activityType) {
    case 'emoji':
      return 'choosing emoji...';
    case 'sticker':
      return 'picking sticker...';
    case 'voice_recording':
      return 'recording voice...';
    case 'uploading_image':
      return 'sending image...';
    case 'uploading_video':
      return 'sending video...';
    case 'uploading_file':
      return 'sending file...';
    case 'focused':
      return 'composing...';
    case 'typing':
    default:
      return 'is typing...';
  }
};

export const getActivityIcon = (activityType: ActivityType = 'typing') => {
  switch (activityType) {
    case 'emoji':
      return <Smile className="w-3.5 h-3.5" />;
    case 'sticker':
      return <Sticker className="w-3.5 h-3.5" />;
    case 'voice_recording':
      return <Mic className="w-3.5 h-3.5" />;
    case 'uploading_image':
      return <ImageIcon className="w-3.5 h-3.5" />;
    case 'uploading_video':
      return <Video className="w-3.5 h-3.5" />;
    case 'uploading_file':
      return <FileText className="w-3.5 h-3.5" />;
    case 'focused':
      return <MessageCircle className="w-3.5 h-3.5" />;
    case 'typing':
    default:
      return <Pencil className="w-3.5 h-3.5" />;
  }
};

export const getActivityColor = (activityType: ActivityType = 'typing'): string => {
  switch (activityType) {
    case 'emoji':
      return 'text-yellow-500';
    case 'sticker':
      return 'text-pink-500';
    case 'voice_recording':
      return 'text-red-500';
    case 'uploading_image':
      return 'text-blue-500';
    case 'uploading_video':
      return 'text-purple-500';
    case 'uploading_file':
      return 'text-orange-500';
    case 'focused':
      return 'text-emerald-500';
    case 'typing':
    default:
      return 'text-primary';
  }
};
