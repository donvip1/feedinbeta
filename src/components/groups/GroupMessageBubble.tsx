import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { 
  Reply, Smile, MoreVertical, Copy, Trash2, Check, CheckCheck, 
  FileText, Edit2, Pin, Flame, EyeOff, Forward, Flag 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WaveformPlayer } from '@/components/messages/WaveformPlayer';
import { MediaMessageBubble } from '@/components/messages/MediaMessageBubble';
import { MessageReactionsDisplay } from './MessageReactionsDisplay';
import { ReportMessageModal } from './ReportMessageModal';
import { cn } from '@/lib/utils';
import { DEFAULT_EMOJIS } from '@/components/shared/EmojiReactions';
import { toast } from 'sonner';

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
}

interface GroupMessageBubbleProps {
  message: GroupMessage;
  isOwn: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isAdmin?: boolean;
  secretMode?: boolean;
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
  onReply,
  onReact,
  onDelete,
  onEdit,
  onPin,
  onForward,
}: GroupMessageBubbleProps) => {
  const [showReactions, setShowReactions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleForward = () => {
    if (onForward) {
      onForward(message.id, message.content, message.media_url);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message.content || message.media_url || '');
      toast.success('Message copied to clipboard');
    }
  };

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

  const reactionGroups = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, typeof message.reactions>);

  const isViewOnce = message.view_once_timer === 1;

  return (
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Swipe Reply Indicator */}
      {swipeOffset > 30 && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 animate-pulse",
          isOwn ? "right-0" : "left-0"
        )}>
          <Reply className="w-5 h-5 text-purple-400" />
        </div>
      )}

      {/* Avatar - Show for other users only */}
      {!isOwn && isLastInGroup && (
        <Avatar
          className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-purple-500/30 transition-all flex-shrink-0 mt-auto border border-slate-700"
          onClick={() => window.location.href = `/profile/${message.sender_id}`}
        >
          <AvatarImage src={message.sender.avatar_url || ''} />
          <AvatarFallback className="bg-slate-800 text-slate-300 text-xs font-medium">
            {message.sender.display_name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !isLastInGroup && <div className="w-8 flex-shrink-0" />}

      <div className={cn(
        "flex flex-col max-w-[75%] relative",
        isOwn ? 'items-end' : 'items-start'
      )}>
        {/* Sender Name - Show for first message in group from others */}
        {!isOwn && isFirstInGroup && (
          <span className="text-xs text-purple-400 font-medium mb-0.5 ml-1">
            {message.sender.display_name || 'Unknown User'}
          </span>
        )}

        {/* Pinned Badge */}
        {message.is_pinned && (
          <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
            <Pin className="w-3 h-3" />
            <span>Pinned</span>
          </div>
        )}

        {/* Reply Indicator */}
        {message.reply_to_message && (
          <div className={cn(
            "flex items-start gap-2 p-2 mb-1 rounded-xl border-l-2 border-purple-500/50",
            isOwn ? "bg-white/10" : "bg-purple-500/10"
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
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-slate-400" />
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs text-purple-400">{message.reply_to_message.sender.display_name}</p>
              <p className="truncate text-xs text-slate-400">{message.reply_to_message.content}</p>
            </div>
          </div>
        )}

        <div className="relative">
          {/* Message Bubble */}
          <div
            className={cn(
              "px-3 py-2 rounded-2xl transition-all duration-200",
              isOwn
                ? 'bg-blue-600 text-white'
                : secretMode 
                  ? 'bg-slate-900 border border-red-900 text-red-100' 
                  : 'bg-slate-800 text-slate-100'
            )}
          >
            {/* View Once indicator for own messages */}
            {isViewOnce && isOwn ? (
              <div className="flex items-center gap-2 italic text-sm text-white/80">
                <EyeOff size={16}/> View Once Sent
              </div>
            ) : (
              <>
                {renderMedia()}
                {message.content && !message.media_type?.includes('file') && (
                  <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
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
                  isViewOnce ? 'text-purple-300 bg-purple-900/30' : 'text-red-300 bg-red-900/30'
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
                isOwn ? "text-white/60" : "text-slate-500"
              )}>
                {formatTime(message.created_at)}
              </span>
              {isOwn && <CheckCheck size={12} className="text-white/60" />}
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
                  className="h-7 w-7 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-1.5 rounded-full bg-slate-800/95 backdrop-blur-xl border-slate-700" 
                side={isOwn ? "left" : "right"}
              >
                <div className="flex gap-0.5">
                  {DEFAULT_EMOJIS.map((emoji, index) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => {
                        onReact(message.id, emoji);
                        setShowReactions(false);
                      }}
                      className="text-xl p-1.5 rounded-full hover:bg-slate-700 hover:scale-125 active:scale-90 transition-all duration-200"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <span>{emoji}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
              onClick={() => onReply(message.id, message.content)}
            >
              <Reply className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align={isOwn ? 'end' : 'start'} 
                className="w-48 rounded-xl bg-background border-border"
              >
                <DropdownMenuItem onClick={handleCopy} className="gap-2">
                  <Copy className="w-4 h-4" />
                  Copy text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleForward} className="gap-2">
                  <Forward className="w-4 h-4" />
                  Forward
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem 
                    onClick={() => onPin?.(message.id)} 
                    className="gap-2"
                  >
                    <Pin className="w-4 h-4" />
                    {message.is_pinned ? 'Unpin' : 'Pin'}
                  </DropdownMenuItem>
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
                  </>
                )}
                <DropdownMenuSeparator />
                {!isOwn && (
                  <DropdownMenuItem
                    onClick={() => setShowReportModal(true)}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Flag className="w-4 h-4" />
                    Report
                  </DropdownMenuItem>
                )}
                {(isOwn || isAdmin) && (
                  <DropdownMenuItem
                    onClick={() => onDelete?.(message.id)}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Telegram-style Reactions Display with Avatars */}
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

export default GroupMessageBubble;
