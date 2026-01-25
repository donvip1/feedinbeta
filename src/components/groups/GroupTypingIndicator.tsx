import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Mic, ImageIcon, Video, FileText, Smile, Sticker } from 'lucide-react';

interface TypingUser {
  userId: string;
  displayName: string;
  activityType?: string;
  avatarUrl?: string | null;
}

interface GroupTypingIndicatorProps {
  typingUsers: TypingUser[];
  className?: string;
  compact?: boolean;
}

const getActivityIcon = (activityType: string = 'typing') => {
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
    default:
      return <Pencil className="w-3.5 h-3.5" />;
  }
};

const getActivityText = (users: TypingUser[]): string => {
  if (users.length === 0) return '';
  
  // Group users by activity type
  const typingUsers = users.filter(u => !u.activityType || u.activityType === 'typing');
  const recordingUsers = users.filter(u => u.activityType === 'voice_recording');
  const uploadingUsers = users.filter(u => 
    u.activityType === 'uploading_image' || 
    u.activityType === 'uploading_video' || 
    u.activityType === 'uploading_file'
  );
  
  const parts: string[] = [];
  
  if (typingUsers.length > 0) {
    const names = formatNames(typingUsers.map(u => u.displayName));
    parts.push(`${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing`);
  }
  
  if (recordingUsers.length > 0) {
    const names = formatNames(recordingUsers.map(u => u.displayName));
    parts.push(`${names} ${recordingUsers.length === 1 ? 'is' : 'are'} recording`);
  }
  
  if (uploadingUsers.length > 0) {
    const names = formatNames(uploadingUsers.map(u => u.displayName));
    parts.push(`${names} ${uploadingUsers.length === 1 ? 'is' : 'are'} uploading`);
  }
  
  return parts.join(', ');
};

const formatNames = (names: string[]): string => {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others`;
};

// Get just the typing text for header display
export const getTypingHeaderText = (users: TypingUser[]): string | null => {
  if (users.length === 0) return null;
  return getActivityText(users) + '...';
};

export const GroupTypingIndicator = ({ typingUsers, className, compact = false }: GroupTypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;
  
  // Get the primary activity type (most common)
  const activityType = typingUsers[0]?.activityType || 'typing';
  const Icon = getActivityIcon(activityType);
  const text = getActivityText(typingUsers);
  
  // Limit avatars to show
  const maxAvatars = 3;
  const visibleUsers = typingUsers.slice(0, maxAvatars);
  const extraCount = typingUsers.length - maxAvatars;
  
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-xs text-primary animate-pulse",
        className
      )}>
        <div className="flex -space-x-1.5">
          {visibleUsers.map((user, i) => (
            <Avatar key={user.userId} className="h-4 w-4 border border-background">
              <AvatarImage src={user.avatarUrl || ''} />
              <AvatarFallback className="text-[8px] bg-primary/20">
                {user.displayName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span>{text}...</span>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "flex gap-2 items-center animate-in fade-in slide-in-from-bottom-2 duration-300 px-4 py-2 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800",
      className
    )}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-800/80 backdrop-blur-sm border border-slate-700">
        {/* User avatars */}
        <div className="flex -space-x-2">
          {visibleUsers.map((user, i) => (
            <Avatar 
              key={user.userId} 
              className={cn(
                "h-6 w-6 border-2 border-slate-800 ring-1 ring-slate-700",
                i > 0 && "-ml-2"
              )}
            >
              <AvatarImage src={user.avatarUrl || ''} />
              <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary/30 to-primary/50">
                {user.displayName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          ))}
          {extraCount > 0 && (
            <div className="h-6 w-6 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center -ml-2">
              <span className="text-[10px] text-slate-300">+{extraCount}</span>
            </div>
          )}
        </div>
        
        {/* Activity icon */}
        <div className={cn(
          "text-purple-400",
          activityType === 'voice_recording' && 'animate-pulse text-red-400'
        )}>
          {Icon}
        </div>
        
        {/* Animated dots */}
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        
        {/* Text */}
        <span className="text-xs text-slate-400">{text}...</span>
      </div>
    </div>
  );
};

export default GroupTypingIndicator;
