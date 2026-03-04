import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck, Archive, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityType, getActivityIcon, getActivityColor } from './TypingIndicator';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';

interface TikTokConversationItemProps {
  id: string;
  avatarUrl?: string | null;
  displayName: string;
  username?: string | null;
  userId?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageSenderId?: string;
  currentUserId?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  activityType?: ActivityType;
  isSelected?: boolean;
  isMuted?: boolean;
  onClick: () => void;
  onArchive?: () => void;
  index?: number;
  hasStoryRing?: boolean;
}

export const TikTokConversationItem = ({
  id,
  avatarUrl,
  displayName,
  username,
  userId,
  lastMessage,
  lastMessageTime,
  lastMessageSenderId,
  currentUserId,
  unreadCount = 0,
  isOnline = false,
  isTyping = false,
  activityType = 'typing',
  isSelected = false,
  isMuted = false,
  onClick,
  onArchive,
  hasStoryRing = false,
}: TikTokConversationItemProps) => {
  const isOwnMessage = lastMessageSenderId === currentUserId;
  const hasUnread = unreadCount > 0;
  const [swipeX, setSwipeX] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = touchStartX - e.touches[0].clientX;
    if (diff > 10) {
      setIsSwiping(true);
      setSwipeX(Math.min(diff, 80));
    } else if (diff < -10 && swipeX > 0) {
      setSwipeX(Math.max(0, swipeX + (touchStartX - e.touches[0].clientX)));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX > 50 && onArchive) {
      onArchive();
    }
    setSwipeX(0);
    setIsSwiping(false);
  };

  const handleClick = () => {
    if (!isSwiping) onClick();
  };
  
  return (
    <div className="relative overflow-hidden rounded-2xl -mx-2">
      {/* Archive action behind */}
      {swipeX > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-amber-500 text-white px-4 rounded-r-2xl"
          style={{ width: swipeX }}
        >
          <Archive className="w-5 h-5" />
        </div>
      )}
      
      <button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "flex items-center gap-4 py-3 group cursor-pointer px-2 transition-colors w-full relative",
          isSelected 
            ? "bg-primary/10" 
            : "hover:bg-accent/50 active:bg-accent"
        )}
        style={{
          transform: swipeX > 0 ? `translateX(-${swipeX}px)` : undefined,
          transition: swipeX === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {/* Avatar with story ring and online indicator */}
        <div className="relative shrink-0">
          <div className={cn(
            "rounded-full",
            hasStoryRing 
              ? "p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" 
              : ""
          )}>
            <div className={cn(
              "rounded-full overflow-hidden border-2 border-background shadow-sm ring-1 ring-muted",
              hasStoryRing ? "w-[52px] h-[52px]" : "w-[56px] h-[56px]"
            )}>
              <Avatar className="w-full h-full">
                <AvatarImage src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`} />
                <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-500 text-white">
                  {displayName?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          
          {/* Online indicator */}
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-background shadow-sm" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 flex justify-between items-center min-w-0">
          <div className="max-w-[70%] text-left">
            <h5 className={cn(
              "font-bold truncate flex items-center gap-1",
              hasUnread ? "text-foreground" : "text-foreground"
            )}>
              <span className="truncate">{displayName}</span>
              {userId && <VerifiedBadge userId={userId} size="sm" />}
              {isMuted && <BellOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </h5>
            
            {/* Last message or typing indicator */}
            {isTyping ? (
              <div className="flex items-center gap-1.5">
                <span className={getActivityColor(activityType)}>
                  {getActivityIcon(activityType)}
                </span>
                <span className={cn("text-sm", getActivityColor(activityType))}>
                  {activityType === 'typing' ? 'typing...' :
                   activityType === 'emoji' ? 'choosing emoji...' :
                   activityType === 'sticker' ? 'picking sticker...' :
                   activityType === 'voice_recording' ? 'recording voice...' :
                   activityType === 'uploading_image' ? 'sending image...' :
                   activityType === 'uploading_video' ? 'sending video...' :
                   activityType === 'uploading_file' ? 'sending file...' :
                   activityType === 'focused' ? 'composing...' :
                   'typing...'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {/* Message status for own messages */}
                {isOwnMessage && lastMessage && (
                  <span className="flex-shrink-0">
                    {hasUnread ? (
                      <Check className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 text-primary" />
                    )}
                  </span>
                )}
                <p className={cn(
                  "text-sm truncate",
                  hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"
                )}>
                  {lastMessage || 'Start a conversation'}
                </p>
              </div>
            )}
          </div>
          
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            {lastMessageTime && (
              <p className="text-[10px] text-muted-foreground">{lastMessageTime}</p>
            )}
            
            {/* Unread badge */}
            {hasUnread && (
              <div className="w-5 h-5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md shadow-pink-200/50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

export default TikTokConversationItem;
