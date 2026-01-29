import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityType, getActivityIcon, getActivityColor } from './TypingIndicator';

interface TikTokConversationItemProps {
  id: string;
  avatarUrl?: string | null;
  displayName: string;
  username?: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageSenderId?: string;
  currentUserId?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  activityType?: ActivityType;
  isSelected?: boolean;
  onClick: () => void;
  index?: number;
  hasStoryRing?: boolean;
}

export const TikTokConversationItem = ({
  id,
  avatarUrl,
  displayName,
  username,
  lastMessage,
  lastMessageTime,
  lastMessageSenderId,
  currentUserId,
  unreadCount = 0,
  isOnline = false,
  isTyping = false,
  activityType = 'typing',
  isSelected = false,
  onClick,
  index = 0,
  hasStoryRing = false,
}: TikTokConversationItemProps) => {
  const isOwnMessage = lastMessageSenderId === currentUserId;
  const hasUnread = unreadCount > 0;
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
        isSelected 
          ? "bg-primary/10 border border-primary/20" 
          : "hover:bg-accent/50"
      )}
    >
      {/* Avatar with story ring and online indicator */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "rounded-full p-[2.5px]",
            hasStoryRing 
              ? "bg-gradient-to-tr from-pink-500 via-rose-500 to-orange-400" 
              : "bg-transparent"
          )}
        >
          <div className={cn(
            "rounded-full",
            hasStoryRing && "bg-background p-[2px]"
          )}>
            <Avatar className={cn(hasStoryRing ? "w-11 h-11" : "w-12 h-12")}>
              <AvatarImage src={avatarUrl || ''} />
              <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-500 text-white font-semibold">
                {displayName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        
        {/* Online indicator */}
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background shadow-sm" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              "font-semibold truncate",
              hasUnread && "text-foreground"
            )}>
              {displayName}
            </span>
            {isOnline && (
              <span className="text-[9px] text-emerald-500 font-medium flex-shrink-0">
                online
              </span>
            )}
          </div>
          
          {lastMessageTime && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {lastMessageTime}
            </span>
          )}
        </div>
        
        {/* Last message or typing indicator */}
        <div className="flex items-center gap-1.5 mt-0.5">
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
            <>
              {/* Message status for own messages */}
              {isOwnMessage && (
                <span className="flex-shrink-0">
                  {hasUnread ? (
                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5 text-primary" />
                  )}
                </span>
              )}
              
              <span className={cn(
                "text-sm truncate",
                hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {lastMessage || 'Start a conversation'}
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Unread badge */}
      {hasUnread && (
        <Badge 
          className="h-5 min-w-[20px] flex items-center justify-center text-[10px] font-bold px-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </motion.button>
  );
};

export default TikTokConversationItem;
