import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format, isToday, isYesterday } from 'date-fns';
import { Reply, Smile, MoreVertical, Download, Forward, Copy, Trash2, Check, CheckCheck, FileText, Edit2, Pin, Star, Flag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WaveformPlayer } from './WaveformPlayer';
import { MediaMessageBubble } from './MediaMessageBubble';
import { ReportMessageModal } from './ReportMessageModal';
import { MessageReactionsDisplay } from '@/components/groups/MessageReactionsDisplay';
import { cn } from '@/lib/utils';
import { DEFAULT_EMOJIS } from '@/components/shared/EmojiReactions';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    media_url?: string | null;
    media_type?: string | null;
    file_size?: number | null;
    reply_to_id?: string | null;
    reply_to_message?: {
      content: string;
      sender: {
        display_name: string;
      };
      media_url?: string | null;
      media_type?: string | null;
    } | null;
    reply_metadata?: {
      type?: string;
      story_id?: string;
      story_media_url?: string;
      story_media_type?: string;
    } | null;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    };
    reactions?: Array<{
      emoji: string;
      user_id: string;
      user: {
        display_name: string;
        avatar_url?: string | null;
      };
    }>;
    read_receipts?: Array<{
      user_id: string;
      read_at: string;
    }>;
    status?: 'sending' | 'sent' | 'delivered' | 'read';
    is_pinned?: boolean;
    edited_at?: string | null;
  };
  isOwn: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onReply: (messageId: string, content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onPin?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
}

// Using the system-wide DEFAULT_EMOJIS

export const ModernMessageBubble = ({ 
  message, 
  isOwn, 
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  onReply, 
  onReact, 
  onDelete,
  onEdit,
  onPin,
  onForward,
}: MessageBubbleProps) => {
  const [showReactions, setShowReactions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.targetTouches[0].clientX;
    const diff = isOwn ? touchStart - currentX : currentX - touchStart;
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 80));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 50) {
      onReply(message.id, message.content);
    }
    setSwipeOffset(0);
    setTouchStart(0);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  };

  const renderMedia = () => {
    if (!message.media_url) return null;

    // Use MediaMessageBubble for images and videos (tap to download like WhatsApp)
    if (message.media_type?.startsWith('image') || message.media_type?.startsWith('video')) {
      return (
        <MediaMessageBubble
          mediaUrl={message.media_url}
          mediaType={message.media_type}
          fileSize={message.file_size || undefined}
          isOwn={isOwn}
        />
      );
    }

    if (message.media_type?.startsWith('audio')) {
      return (
        <div className="mb-1 min-w-[200px]">
          <WaveformPlayer audioUrl={message.media_url} isOwn={isOwn} />
        </div>
      );
    }

    // Generic file attachment
    return (
      <MediaMessageBubble
        mediaUrl={message.media_url}
        mediaType={message.media_type || 'application/octet-stream'}
        fileSize={message.file_size || undefined}
        isOwn={isOwn}
      />
    );
  };

  // Remove old reaction grouping - now using MessageReactionsDisplay component

  const bubbleRadius = cn(
    isOwn ? (
      isFirstInGroup && isLastInGroup ? 'rounded-2xl rounded-br-md' :
      isFirstInGroup ? 'rounded-2xl rounded-br-md' :
      isLastInGroup ? 'rounded-2xl rounded-tr-md' :
      'rounded-2xl rounded-r-md'
    ) : (
      isFirstInGroup && isLastInGroup ? 'rounded-2xl rounded-bl-md' :
      isFirstInGroup ? 'rounded-2xl rounded-bl-md' :
      isLastInGroup ? 'rounded-2xl rounded-tl-md' :
      'rounded-2xl rounded-l-md'
    )
  );

  return (
    <div 
      className={cn(
        "flex gap-2 group relative transition-transform duration-150",
        isOwn ? 'flex-row-reverse' : 'flex-row',
        !isLastInGroup && 'mb-0.5'
      )}
      style={{ 
        transform: swipeOffset > 0 
          ? `translateX(${isOwn ? -swipeOffset : swipeOffset}px)` 
          : undefined 
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Swipe Reply Indicator */}
      {swipeOffset > 30 && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 animate-pulse",
          isOwn ? "right-0" : "left-0"
        )}>
          <Reply className="w-5 h-5 text-primary" />
        </div>
      )}

      {/* Avatar */}
      {showAvatar && isLastInGroup && !isOwn && (
        <Avatar 
          className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all flex-shrink-0 mt-auto"
          onClick={() => window.location.href = `/profile/${message.sender_id}`}
        >
          <AvatarImage src={message.profiles.avatar_url || ''} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-xs font-medium">
            {message.profiles.display_name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      {showAvatar && !isLastInGroup && !isOwn && <div className="w-8 flex-shrink-0" />}

      <div className={cn(
        "flex flex-col max-w-[75%] relative",
        isOwn ? 'items-end' : 'items-start'
      )}>
        {/* Pinned Badge */}
        {message.is_pinned && (
          <div className="flex items-center gap-1 text-xs text-primary mb-1">
            <Pin className="w-3 h-3" />
            <span>Pinned message</span>
          </div>
        )}

        {/* Story Reply/Reaction Indicator - Enhanced with larger thumbnail */}
        {(message.reply_metadata?.type === 'story_reply' || message.reply_metadata?.type === 'story_reaction') && (
          <div className={cn(
            "flex items-center gap-3 p-2 mb-1.5 rounded-xl backdrop-blur-sm border",
            isOwn ? "bg-white/10 border-white/20" : "bg-primary/10 border-primary/20"
          )}>
            {message.reply_metadata.story_media_url && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-primary/40 shadow-md">
                {message.reply_metadata.story_media_type?.startsWith('video') ? (
                  <video 
                    src={message.reply_metadata.story_media_url} 
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img 
                    src={message.reply_metadata.story_media_url} 
                    alt="Story" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium opacity-90">
                {message.reply_metadata?.type === 'story_reaction' ? 'Reacted to story' : 'Replied to story'}
              </span>
              <span className="text-[10px] opacity-60">Tap to view</span>
            </div>
          </div>
        )}

        {/* Regular Reply Indicator */}
        {message.reply_to_message && (
          <div className={cn(
            "flex items-start gap-2 p-2 mb-1 rounded-xl border-l-2 border-primary/50",
            isOwn ? "bg-white/10" : "bg-primary/5"
          )}>
            {message.reply_to_message.media_url && (
              <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0">
                {message.reply_to_message.media_type?.startsWith('video') ? (
                  <video 
                    src={message.reply_to_message.media_url} 
                    className="w-full h-full object-cover"
                  />
                ) : message.reply_to_message.media_type?.startsWith('image') ? (
                  <img 
                    src={message.reply_to_message.media_url} 
                    alt="Reply" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <FileText className="w-3 h-3" />
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs text-primary">{message.reply_to_message.sender.display_name}</p>
              <p className="truncate text-xs opacity-70">{message.reply_to_message.content}</p>
            </div>
          </div>
        )}

        <div className="relative">
          {/* Message Bubble */}
          <div
            className={cn(
              "px-3 py-2 transition-all duration-200",
              bubbleRadius,
              isOwn
                ? 'bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-card text-card-foreground shadow-sm border border-border/50'
            )}
          >
            {renderMedia()}
            {message.content && !message.media_type?.includes('file') && (
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
            )}
            
            {/* Inline Time and Status */}
            <div className={cn(
              "flex items-center gap-1 mt-0.5 -mb-0.5",
              isOwn ? 'justify-end' : 'justify-start'
            )}>
              {message.edited_at && (
                <span className="text-[10px] opacity-50">edited</span>
              )}
              <span className={cn(
                "text-[10px]",
                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {formatTime(message.created_at)}
              </span>
              {isOwn && (
                <span className={cn(
                  "transition-colors",
                  message.status === 'read' ? 'text-sky-300' : 'text-primary-foreground/50'
                )}>
                  {message.status === 'sending' && <Check className="w-3.5 h-3.5" />}
                  {message.status === 'sent' && <Check className="w-3.5 h-3.5" />}
                  {message.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5" />}
                  {message.status === 'read' && <CheckCheck className="w-3.5 h-3.5" />}
                </span>
              )}
            </div>
          </div>

          {/* Floating Action Buttons */}
          <div className={cn(
            "absolute top-0 flex items-center gap-0.5 transition-all duration-200",
            isOwn ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1",
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}>
            <Popover open={showReactions} onOpenChange={setShowReactions}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-primary/10"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1.5 rounded-full bg-background/95 backdrop-blur-xl border-border/50" side={isOwn ? "left" : "right"}>
                <div className="flex gap-0.5">
                  {DEFAULT_EMOJIS.map((emoji, index) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => {
                        onReact(message.id, emoji);
                        setShowReactions(false);
                      }}
                      className="emoji-reaction-btn text-xl p-1.5 rounded-full hover:bg-muted/50 hover:scale-125 active:scale-90 transition-all duration-200"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <span className="emoji-pop">{emoji}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full hover:bg-primary/10"
              onClick={() => onReply(message.id, message.content)}
            >
              <Reply className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-primary/10">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-48 rounded-xl">
                <DropdownMenuItem onClick={handleCopy} className="gap-2">
                  <Copy className="w-4 h-4" />
                  Copy text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onForward?.(message.id)} className="gap-2">
                  <Forward className="w-4 h-4" />
                  Forward
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPin?.(message.id)} className="gap-2">
                  <Pin className="w-4 h-4" />
                  {message.is_pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                {!isOwn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowReportModal(true)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Flag className="w-4 h-4" />
                      Report
                    </DropdownMenuItem>
                  </>
                )}
                {isOwn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onEdit?.(message.id, message.content)}
                      className="gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete?.(message.id)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Telegram-style Reactions Display */}
          {message.reactions && message.reactions.length > 0 && (
            <MessageReactionsDisplay
              reactions={message.reactions}
              isOwn={isOwn}
              onReact={(emoji) => onReact(message.id, emoji)}
            />
          )}
        </div>
      </div>

      {/* Report Modal */}
      <ReportMessageModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        messageId={message.id}
        senderId={message.sender_id}
        messageContent={message.content}
      />
    </div>
  );
};
