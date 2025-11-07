import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Reply, Smile, MoreVertical, Download, Forward, Copy, Trash2, Check, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    edited_at?: string | null;
    is_read?: boolean;
    read_at?: string;
    media_url?: string | null;
    media_type?: string | null;
    reply_to_id?: string | null;
    reply_to_message?: {
      content: string;
      sender: {
        display_name: string;
      };
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
      };
    }>;
    read_receipts?: Array<{
      user_id: string;
      read_at: string;
    }>;
  };
  isOwn: boolean;
  onReply: (messageId: string, content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onForward?: (message: any) => void;
  onImageClick?: (imageUrl: string) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🙏'];

export const EnhancedMessageBubble = ({ 
  message, 
  isOwn, 
  onReply, 
  onReact, 
  onDelete,
  onEdit,
  onForward,
  onImageClick,
  onSwipeStart,
  onSwipeEnd
}: MessageBubbleProps) => {
  const [showReactions, setShowReactions] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    onSwipeStart?.();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStart - touchEnd;
    const threshold = 50;

    if (!isOwn && swipeDistance < -threshold) {
      onReply(message.id, message.content);
    } else if (isOwn && swipeDistance > threshold) {
      onReply(message.id, message.content);
    }

    setTouchStart(0);
    setTouchEnd(0);
    onSwipeEnd?.();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleEditSave = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const renderMedia = () => {
    if (!message.media_url) return null;

    if (message.media_type?.startsWith('image')) {
      return (
        <img 
          src={message.media_url} 
          alt="Shared" 
          className="rounded-lg max-w-xs max-h-64 object-cover mb-2 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onImageClick?.(message.media_url!);
          }}
        />
      );
    }

    if (message.media_type?.startsWith('video')) {
      return (
        <video 
          src={message.media_url} 
          controls 
          className="rounded-lg max-w-xs max-h-64 mb-2"
        />
      );
    }

    if (message.media_type?.startsWith('audio')) {
      return (
        <audio 
          src={message.media_url} 
          controls 
          className="mb-2"
        />
      );
    }

    return (
      <a 
        href={message.media_url} 
        download 
        className="flex items-center gap-2 p-2 border rounded-lg mb-2 hover:bg-accent"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm">Download File</span>
      </a>
    );
  };

  const reactionGroups = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, typeof message.reactions>);

  return (
    <div 
      className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Avatar 
        className="w-8 h-8 cursor-pointer hover:opacity-80 flex-shrink-0"
        onClick={() => window.location.href = `/profile/${message.sender_id}`}
      >
        <AvatarImage src={message.profiles.avatar_url || ''} />
        <AvatarFallback>{message.profiles.display_name?.[0] || 'U'}</AvatarFallback>
      </Avatar>

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%] relative`}>
        {/* Reply Indicator */}
        {message.reply_to_message && (
          <div className={`text-xs p-2 mb-1 rounded border-l-2 ${
            isOwn ? 'bg-white/10 border-white/30' : 'bg-accent/50 border-primary/30'
          }`}>
            <p className="font-semibold">{message.reply_to_message.sender.display_name}</p>
            <p className="truncate">{message.reply_to_message.content}</p>
          </div>
        )}

        <div className="relative">
          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white'
                : 'bg-accent'
            }`}
          >
            {renderMedia()}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 rounded bg-background/20 text-sm resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEditSave}
                    className="px-3 py-1 bg-background/30 rounded text-xs hover:bg-background/40"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="px-3 py-1 bg-background/30 rounded text-xs hover:bg-background/40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                {message.edited_at && (
                  <p className="text-xs opacity-70 mt-1">edited</p>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
            <Popover open={showReactions} onOpenChange={setShowReactions}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="flex gap-1">
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(message.id, emoji);
                        setShowReactions(false);
                      }}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onReply(message.id, message.content)}
            >
              <Reply className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                {isOwn && onEdit && !message.media_url && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onForward && (
                  <DropdownMenuItem onClick={() => onForward(message)}>
                    <Forward className="w-4 h-4 mr-2" />
                    Forward
                  </DropdownMenuItem>
                )}
                {isOwn && onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(message.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Reactions */}
          {reactionGroups && Object.keys(reactionGroups).length > 0 && (
            <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(reactionGroups).map(([emoji, reactions]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-background border rounded-full text-xs hover:scale-110 transition-transform"
                  title={reactions.map(r => r.user.display_name).join(', ')}
                >
                  <span>{emoji}</span>
                  <span>{reactions.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 px-1">
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {isOwn && (
            message.read_receipts && message.read_receipts.length > 0 ? (
              <CheckCheck className="w-3 h-3 text-blue-500" />
            ) : message.is_read ? (
              <CheckCheck className="w-3 h-3 text-blue-500" />
            ) : (
              <Check className="w-3 h-3" />
            )
          )}
        </div>
      </div>
    </div>
  );
};
