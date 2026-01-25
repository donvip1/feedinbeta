import React, { useState, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Reply, Check, CheckCheck, FileText, Pin, Flame, EyeOff, Forward } from 'lucide-react';
import { WaveformPlayer } from '@/components/messages/WaveformPlayer';
import { MediaMessageBubble } from '@/components/messages/MediaMessageBubble';
import { MessageReactionsDisplay } from './MessageReactionsDisplay';
import { ReportMessageModal } from './ReportMessageModal';
import { MessageContextMenu } from '@/components/messages/MessageContextMenu';
import { cn } from '@/lib/utils';
import { getEmojiSizeClass, isEmojiOnly } from '@/lib/emoji-utils';

interface GroupMessage {
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
  sender: {
    id: string;
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
  is_pinned?: boolean;
  edited_at?: string | null;
  is_secret?: boolean;
  view_once_timer?: number;
  poll_id?: string | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  forwarded_from?: {
    original_sender_id: string;
    original_sender_name: string;
    original_timestamp: string;
    source_type: 'dm' | 'group';
    source_id: string;
  } | null;
}

interface GroupMessageBubbleProps {
  message: GroupMessage;
  isOwn: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isAdmin?: boolean;
  secretMode?: boolean;
  currentUserId?: string;
  onReply: (messageId: string, content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onPin?: (messageId: string) => void;
  onForward?: (messageId: string, content: string, mediaUrl?: string | null) => void;
}

export const GroupMessageBubble = ({
  message,
  isOwn,
  isFirstInGroup = true,
  isLastInGroup = true,
  isAdmin = false,
  secretMode = false,
  currentUserId,
  onReply,
  onReact,
  onDelete,
  onEdit,
  onPin,
  onForward,
}: GroupMessageBubbleProps) => {
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

  const renderMedia = () => {
    if (!message.media_url) return null;

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

    return (
      <MediaMessageBubble
        mediaUrl={message.media_url}
        mediaType={message.media_type || 'application/octet-stream'}
        fileSize={message.file_size || undefined}
        isOwn={isOwn}
      />
    );
  };

  const isViewOnce = message.view_once_timer === 1;

  return (
    <>
      <div
        className={cn(
          "flex gap-2 group relative transition-transform duration-150 animate-in slide-in-from-bottom-2",
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

        {/* Avatar - Show for other users only */}
        {!isOwn && isLastInGroup && (
          <Avatar
            className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all flex-shrink-0 mt-auto border border-border"
            onClick={() => window.location.href = `/profile/${message.sender_id}`}
          >
            <AvatarImage src={message.sender.avatar_url || ''} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
              {message.sender.display_name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        {!isOwn && !isLastInGroup && <div className="w-8 flex-shrink-0" />}

        <div className={cn(
          "flex flex-col max-w-[75%] relative",
          isOwn ? 'items-end' : 'items-start'
        )}>
          {/* Forwarded Label */}
          {message.forwarded_from && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Forward className="w-3 h-3" />
              <span>Forwarded</span>
            </div>
          )}
          
          {/* Sender Name - Show for first message in group from others */}
          {!isOwn && isFirstInGroup && (
            <span className="text-xs text-primary font-medium mb-0.5 ml-1">
              {message.sender.display_name || 'Unknown User'}
            </span>
          )}

          {/* Pinned Badge */}
          {message.is_pinned && (
            <div className="flex items-center gap-1 text-xs text-primary mb-1">
              <Pin className="w-3 h-3" />
              <span>Pinned</span>
            </div>
          )}

          {/* Reply Indicator */}
          {message.reply_to_message && (
            <div className={cn(
              "flex items-start gap-2 p-2 mb-1 rounded-xl border-l-2 border-primary/50",
              isOwn ? "bg-white/10" : "bg-primary/10"
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
                      <FileText className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs text-primary">{message.reply_to_message.sender.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">{message.reply_to_message.content}</p>
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
                "px-3 py-2 rounded-2xl transition-all duration-200 cursor-pointer active:scale-[0.98] select-none",
                isOwn
                  ? 'bg-primary text-primary-foreground'
                  : secretMode 
                    ? 'bg-destructive/10 border border-destructive/30 text-destructive' 
                    : 'bg-card border border-border text-card-foreground'
              )}
            >
              {/* View Once indicator for own messages */}
              {isViewOnce && isOwn ? (
                <div className="flex items-center gap-2 italic text-sm opacity-80">
                  <EyeOff size={16}/> View Once Sent
                </div>
              ) : (
              <>
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
              </>
              )}

              {/* Inline Time & Status */}
              <div className={cn(
                "flex items-center gap-1 mt-0.5 -mb-0.5",
                isOwn ? 'justify-end' : 'justify-start'
              )}>
                {/* Secret/ViewOnce Badge */}
                {message.is_secret && (
                  <span className={cn(
                    "flex items-center gap-0.5 text-[10px] px-1 rounded",
                    isViewOnce ? 'text-primary bg-primary/10' : 'text-destructive bg-destructive/10'
                  )}>
                    {isViewOnce ? <EyeOff size={8} /> : <Flame size={8} />}
                    {isViewOnce ? '1x' : `${message.view_once_timer || 30}s`}
                  </span>
                )}
                {message.edited_at && (
                  <span className="text-[10px] opacity-50">edited</span>
                )}
                <span className={cn(
                  "text-[10px]",
                  isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                )}>
                  {formatTime(message.created_at)}
                </span>
                {isOwn && (
                  <span className={cn(
                    "transition-colors",
                    message.status === 'read' ? 'text-[hsl(199,89%,70%)]' : 'text-primary-foreground/50'
                  )}>
                    {message.status === 'sending' && <Check size={12} />}
                    {message.status === 'sent' && <Check size={12} />}
                    {(message.status === 'delivered' || !message.status) && <CheckCheck size={12} />}
                    {message.status === 'read' && <CheckCheck size={12} />}
                  </span>
                )}
              </div>
            </div>

            {/* Telegram-style Reactions Display with Avatars */}
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
        isGroup={true}
        isAdmin={isAdmin}
        onReact={(emoji) => onReact(message.id, emoji)}
        onReply={() => onReply(message.id, message.content)}
        onCopy={() => navigator.clipboard.writeText(message.content)}
        onForward={() => onForward?.(message.id, message.content, message.media_url)}
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

export default GroupMessageBubble;
