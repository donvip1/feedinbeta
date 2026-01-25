import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Reply, Copy, Forward, Pin, Star, Edit2, Trash2, Flag, Plus, X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Default quick reaction emojis (7 emojis)
const QUICK_EMOJIS = ['❤️', '🔥', '😍', '👏', '😂', '😮', '😢'];

// Extended emoji set for the "+" picker
const EXTENDED_EMOJIS = [
  '🎉', '🥳', '😎', '🤔', '😡', '💯', '👍',
  '👎', '🙏', '💪', '🤝', '😘', '🥰', '😭',
  '🤣', '😱', '😳', '🤯', '💀', '🙄', '👀',
  '💕', '✨', '🌟', '💖', '🫶', '🤩', '😇',
];

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string;
    senderId: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    isPinned?: boolean;
  };
  isOwn: boolean;
  isGroup?: boolean;
  isAdmin?: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onPin?: () => void;
  onStar?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

export const MessageContextMenu = ({
  isOpen,
  onClose,
  message,
  isOwn,
  isGroup = false,
  isAdmin = false,
  onReact,
  onReply,
  onCopy,
  onForward,
  onPin,
  onStar,
  onEdit,
  onDelete,
  onReport,
}: MessageContextMenuProps) => {
  const [showExtendedEmojis, setShowExtendedEmojis] = useState(false);

  const handleReact = (emoji: string) => {
    onReact(emoji);
    onClose();
  };

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied to clipboard');
    onClose();
  };

  // Show report for:
  // - Group messages from others
  // - DM messages from others
  const showReport = !isOwn;

  // Show delete for own messages OR admin in groups
  const showDelete = isOwn || (isGroup && isAdmin);

  // Show edit only for own text messages
  const showEdit = isOwn && message.content && !message.mediaUrl;

  // Show pin for admins in groups, or always in DMs
  const showPin = isGroup ? isAdmin : true;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Menu Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[280px] max-w-[90vw]"
          >
            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
              {/* Quick Reactions Row */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between gap-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReact(emoji)}
                      className="text-2xl p-1.5 rounded-full hover:bg-muted active:scale-90 transition-all duration-150"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowExtendedEmojis(!showExtendedEmojis)}
                    className={cn(
                      "p-1.5 rounded-full transition-all duration-150",
                      showExtendedEmojis 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {showExtendedEmojis ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>

                {/* Extended Emoji Picker */}
                <AnimatePresence>
                  {showExtendedEmojis && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-7 gap-1 pt-3 mt-3 border-t border-border">
                        {EXTENDED_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReact(emoji)}
                            className="text-xl p-1.5 rounded-lg hover:bg-muted active:scale-90 transition-all duration-150"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Items */}
              <div className="py-1">
                {/* Reply */}
                <button
                  type="button"
                  onClick={() => handleAction(onReply)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <Reply className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Reply</span>
                </button>

                {/* Copy */}
                {message.content && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                  >
                    <Copy className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Copy</span>
                  </button>
                )}

                {/* Forward */}
                <button
                  type="button"
                  onClick={() => handleAction(onForward)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <Forward className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Forward</span>
                </button>

                {/* Pin */}
                {showPin && onPin && (
                  <button
                    type="button"
                    onClick={() => handleAction(onPin)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                  >
                    <Pin className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {message.isPinned ? 'Unpin' : 'Pin'}
                    </span>
                  </button>
                )}

                {/* Star */}
                {onStar && (
                  <button
                    type="button"
                    onClick={() => handleAction(onStar)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                  >
                    <Star className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Star</span>
                  </button>
                )}

                {/* Edit - own messages only */}
                {showEdit && onEdit && (
                  <>
                    <div className="h-px bg-border mx-3 my-1" />
                    <button
                      type="button"
                      onClick={() => handleAction(onEdit)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                    >
                      <Edit2 className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Edit</span>
                    </button>
                  </>
                )}

                {/* Delete - own messages or admin */}
                {showDelete && onDelete && (
                  <>
                    {!showEdit && <div className="h-px bg-border mx-3 my-1" />}
                    <button
                      type="button"
                      onClick={() => handleAction(onDelete)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-destructive"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </>
                )}

                {/* Report - others' messages */}
                {showReport && onReport && (
                  <>
                    <div className="h-px bg-border mx-3 my-1" />
                    <button
                      type="button"
                      onClick={() => handleAction(onReport)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-destructive"
                    >
                      <Flag className="w-5 h-5" />
                      <span className="text-sm font-medium">Report</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MessageContextMenu;
