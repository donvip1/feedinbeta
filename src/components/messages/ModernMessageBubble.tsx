import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Reply, Forward, Check, CheckCheck, FileText, Pin } from 'lucide-react';
import { WaveformPlayer } from './WaveformPlayer';
import { MediaMessageBubble } from './MediaMessageBubble';
import { ReportMessageModal } from './ReportMessageModal';
import { MessageReactionsDisplay } from '@/components/groups/MessageReactionsDisplay';
import { MessageContextMenu } from './MessageContextMenu';
import { cn } from '@/lib/utils';
import { getEmojiSizeClass, isEmojiOnly } from '@/lib/emoji-utils';
import { LinkPreviewCard } from './LinkPreviewCard';

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
    forwarded_from?: {
      original_sender_id: string;
      original_sender_name: string;
      original_timestamp: string;
      source_type: 'dm' | 'group';
      source_id: string;
    } | null;
  };
  isOwn: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  currentUserId?: string;
  onReply: (messageId: string, content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onPin?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
}

export const ModernMessageBubble = ({ 
  message, 
  isOwn, 
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  currentUserId,
  onReply, 
  onReact, 
  onDelete,
  onEdit,
  onPin,
  onForward,
}: MessageBubbleProps) => {
  const navigate = useNavigate();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  
  // Long press detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const longPressThreshold = 500; // ms

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.targetTouches[0].clientX;
    const diff = isOwn ? touchStart - currentX : currentX - touchStart;
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 80));
    }
  };

  const handleSwipeTouchEnd = () => {
    if (swipeOffset > 50) {
      onReply(message.id, message.content);
    }
    setSwipeOffset(0);
    setTouchStart(0);
  };

  const openContextMenu = useCallback((clientX: number, clientY: number) => {
    setMenuPosition({ x: clientX, y: clientY });
    setShowContextMenu(true);
  }, []);

  // Long press handlers for touch
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, video, img, button')) return;
    
    isLongPress.current = false;
    const touch = e.touches[0];
    
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      openContextMenu(touch.clientX, touch.clientY);
    }, longPressThreshold);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Click handler (for desktop tap)
  const handleBubbleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, video, img, button')) return;
    
    openContextMenu(e.clientX, e.clientY);
  };

  // Context menu handler (right-click on desktop)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.closest('a, video, img, button')) return;
    
    openContextMenu(e.clientX, e.clientY);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  };

  // Extract first URL from message content
  const extractUrl = (text: string): string | null => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const firstUrl = message.content ? extractUrl(message.content) : null;

  const renderMedia = () => {
    if (!message.media_url) return null;

    if (message.media_type?.startsWith('image') || message.media_type?.startsWith('video')) {
      return (
        <MediaMessageBubble
          mediaUrl={message.media_url}
          mediaType={message.media_type}
          fileSize={message.file_size || undefined}
          isOwn={isOwn}
          senderName={message.profiles?.display_name || (isOwn ? 'You' : 'Unknown')}
          timestamp={format(new Date(message.created_at), 'MMM d, h:mm a')}
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

    return (
      <MediaMessageBubble
        mediaUrl={message.media_url}
        mediaType={message.media_type || 'application/octet-stream'}
        fileSize={message.file_size || undefined}
        isOwn={isOwn}
        senderName={message.profiles?.display_name || (isOwn ? 'You' : 'Unknown')}
        timestamp={format(new Date(message.created_at), 'MMM d, h:mm a')}
      />
    );
  };

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
    <>
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
        onTouchStart={handleSwipeTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleSwipeTouchEnd}
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
            className="w-7 h-7 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all flex-shrink-0 mt-auto"
            onClick={() => navigate(`/profile/${message.sender_id}`)}
          >
            <AvatarImage src={message.profiles.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-xs font-medium">
              {message.profiles.display_name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        {showAvatar && !isLastInGroup && !isOwn && <div className="w-7 flex-shrink-0" />}

        <div className={cn(
          "flex flex-col max-w-[78%] relative",
          isOwn ? 'items-end' : 'items-start'
        )}>
          {/* Forwarded Label */}
          {message.forwarded_from && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Forward className="w-3 h-3" />
              <span>Forwarded</span>
            </div>
          )}

          {/* Pinned Badge */}
          {message.is_pinned && (
            <div className="flex items-center gap-1 text-xs text-primary mb-1">
              <Pin className="w-3 h-3" />
              <span>Pinned message</span>
            </div>
          )}

          {/* Story Reply/Reaction Indicator */}
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
            {/* Message Bubble - Tap or long-press to open context menu */}
            <div
              onClick={handleBubbleClick}
              onContextMenu={handleContextMenu}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className={cn(
                "px-2.5 py-1.5 transition-all duration-200 cursor-pointer active:scale-[0.98] select-none",
                bubbleRadius,
                isOwn
                  ? 'bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-card text-card-foreground shadow-sm border border-border/50'
              )}
            >
              {renderMedia()}
              {message.content && !message.media_type?.includes('file') && (
                (() => {
                  const emojiSize = getEmojiSizeClass(message.content);
                  const isEmoji = isEmojiOnly(message.content);
                  return (
                    <p className={cn(
                      "break-words whitespace-pre-wrap",
                      emojiSize ? emojiSize : "text-[15px] leading-relaxed",
                      isEmoji && "text-center py-1"
                    )}>
                      {message.content}
                    </p>
                  );
                })()
              )}
              
              {/* Link Preview */}
              {firstUrl && !message.media_url && (
                <LinkPreviewCard url={firstUrl} isOwn={isOwn} />
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

            {/* Telegram-style Reactions Display */}
            {message.reactions && message.reactions.length > 0 && (
              <MessageReactionsDisplay
                reactions={message.reactions}
                isOwn={isOwn}
                currentUserId={currentUserId}
                onReact={(emoji) => onReact(message.id, emoji)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <MessageContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        position={menuPosition}
        message={{
          id: message.id,
          content: message.content,
          senderId: message.sender_id,
          mediaUrl: message.media_url,
          mediaType: message.media_type,
          isPinned: message.is_pinned,
        }}
        isOwn={isOwn}
        isGroup={false}
        onReact={(emoji) => onReact(message.id, emoji)}
        onReply={() => onReply(message.id, message.content)}
        onCopy={() => navigator.clipboard.writeText(message.content)}
        onForward={() => onForward?.(message.id)}
        onPin={() => onPin?.(message.id)}
        onEdit={() => onEdit?.(message.id, message.content)}
        onDelete={() => onDelete?.(message.id)}
        onReport={() => setShowReportModal(true)}
      />

      {/* Report Modal */}
      <ReportMessageModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        messageId={message.id}
        senderId={message.sender_id}
        messageContent={message.content}
      />
    </>
  );
};
