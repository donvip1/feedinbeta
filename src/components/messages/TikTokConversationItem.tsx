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
  isLive?: boolean;
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
  isLive = false,
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
    <div className="relative overflow-hidden rounded-[24px] mb-1.5">
      {/* Archive action behind */}
      {swipeX > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-amber-500 text-white px-4 rounded-r-[28px]"
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
          "flex items-center gap-3 p-3.5 group cursor-pointer transition-all w-full relative rounded-[24px] border",
          isSelected 
            ? "bg-primary/10 border-primary/20" 
            : "bg-muted/20 hover:bg-card border-border/40 active:scale-[0.98]"
        )}
        style={{
          transform: swipeX > 0 ? `translateX(-${swipeX}px)` : undefined,
          transition: swipeX === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {/* Avatar with online/live indicator */}
        <div className="relative shrink-0">
          <div className={cn(
            "rounded-[20px] overflow-hidden",
            hasStoryRing 
              ? "p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" 
              : ""
          )}>
            <Avatar className={cn(
              "shadow-sm",
              hasStoryRing ? "w-[48px] h-[48px]" : "w-12 h-12"
            )} style={{ borderRadius: '16px' }}>
              <AvatarImage 
                src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`} 
                className="rounded-[20px]"
              />
              <AvatarFallback className="bg-gradient-to-br from-primary/60 to-primary text-primary-foreground rounded-[20px]">
                {displayName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          
          {/* Online indicator */}
          {isOnline && !isLive && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-background shadow-sm" />
          )}
          
          {/* Live badge */}
          {isLive && (
            <div className="absolute -top-1 -right-1 bg-destructive text-[7px] text-destructive-foreground px-1 font-black rounded border-2 border-background animate-bounce">
              LIVE
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <h5 className="font-bold text-[16px] truncate flex items-center gap-1 tracking-tight text-foreground">
              <span className="truncate">{displayName}</span>
              {userId && <VerifiedBadge userId={userId} size="sm" />}
              {isMuted && <BellOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </h5>
            {lastMessageTime && (
              <span className="text-[10px] text-muted-foreground font-medium shrink-0 ml-2">{lastMessageTime}</span>
            )}
          </div>
          
          {/* Last message or typing indicator */}
          {isTyping ? (
            <div className="flex items-center gap-1.5">
              <span className={getActivityColor(activityType)}>
                {getActivityIcon(activityType)}
              </span>
              <span className={cn("text-[13px]", getActivityColor(activityType))}>
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
            <div className="flex items-center gap-1.5">
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
                "text-[13px] truncate",
                hasUnread ? "text-foreground font-bold" : "text-muted-foreground"
              )}>
                {lastMessage || 'Start a conversation'}
              </p>
            </div>
          )}
        </div>
        
        {/* Unread badge */}
        {hasUnread && (
          <div className="bg-primary text-primary-foreground text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
};

export default TikTokConversationItem;
