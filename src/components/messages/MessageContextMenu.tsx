import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Reply, Copy, Forward, Pin, Edit2, Trash2, Flag, ChevronDown, ChevronUp,
  ThumbsUp, Heart, Smile, Trophy, Flame, PartyPopper
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Core 4 reactions shown by default
const QUICK_REACTIONS = [
  { id: 'heart', icon: Heart, color: 'bg-red-500', textColor: 'text-red-500', emoji: '❤️' },
  { id: 'fire', icon: Flame, color: 'bg-orange-500', textColor: 'text-orange-500', emoji: '🔥' },
  { id: 'laugh', icon: Smile, color: 'bg-yellow-500', textColor: 'text-yellow-500', emoji: '😍' },
  { id: 'clap', icon: ThumbsUp, color: 'bg-blue-500', textColor: 'text-blue-500', emoji: '👏' },
];

// Extended emojis shown in dropdown
const EXTENDED_EMOJIS = [
  '🎉', '🏆', '😂', '😢', '😮', '🥳', '😎',
  '🤔', '😡', '💯', '👍', '👎', '🙏', '💪',
  '🤝', '😘', '🥰', '😭', '🤣', '😱', '💀',
];

// Compact Emoji Button
const QuickEmojiButton = ({ 
  reaction, 
  onSelect 
}: { 
  reaction: typeof QUICK_REACTIONS[0];
  onSelect: (emoji: string) => void;
}) => {
  const Icon = reaction.icon;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(reaction.emoji)}
      className={cn(
        "p-2 rounded-full transition-colors duration-150",
        "bg-muted/60 hover:bg-muted active:scale-90",
        reaction.textColor
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.85 }}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  );
};

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
  onEdit,
  onDelete,
  onReport,
}: MessageContextMenuProps) => {
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);

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

  const showReport = !isOwn;
  const showDelete = isOwn || (isGroup && isAdmin);
  const showEdit = isOwn && message.content && !message.mediaUrl;
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
            transition={{ duration: 0.1 }}
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={onClose}
          />

          {/* Compact Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[240px]"
          >
            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              {/* Quick Reactions Row */}
              <div className="p-2.5 border-b border-border">
                <div className="flex items-center justify-center gap-2">
                  {QUICK_REACTIONS.map((reaction) => (
                    <QuickEmojiButton
                      key={reaction.id}
                      reaction={reaction}
                      onSelect={handleReact}
                    />
                  ))}
                  <motion.button
                    type="button"
                    onClick={() => setShowMoreEmojis(!showMoreEmojis)}
                    className="p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.85 }}
                  >
                    {showMoreEmojis ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>

                {/* Extended Emoji Picker */}
                <AnimatePresence>
                  {showMoreEmojis && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-7 gap-1 pt-2 mt-2 border-t border-border">
                        {EXTENDED_EMOJIS.map((emoji) => (
                          <motion.button
                            key={emoji}
                            type="button"
                            onClick={() => handleReact(emoji)}
                            className="text-base p-1.5 rounded hover:bg-muted active:scale-90 transition-all"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.8 }}
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Compact Action Items */}
              <div className="py-0.5">
                <ActionButton icon={Reply} label="Reply" onClick={() => handleAction(onReply)} />
                
                {message.content && (
                  <ActionButton icon={Copy} label="Copy" onClick={handleCopy} />
                )}
                
                <ActionButton icon={Forward} label="Forward" onClick={() => handleAction(onForward)} />
                
                {showPin && onPin && (
                  <ActionButton 
                    icon={Pin} 
                    label={message.isPinned ? 'Unpin' : 'Pin'} 
                    onClick={() => handleAction(onPin)} 
                  />
                )}

                {showEdit && onEdit && (
                  <>
                    <div className="h-px bg-border mx-2 my-0.5" />
                    <ActionButton icon={Edit2} label="Edit" onClick={() => handleAction(onEdit)} />
                  </>
                )}

                {showDelete && onDelete && (
                  <>
                    {!showEdit && <div className="h-px bg-border mx-2 my-0.5" />}
                    <ActionButton 
                      icon={Trash2} 
                      label="Delete" 
                      onClick={() => handleAction(onDelete)} 
                      destructive 
                    />
                  </>
                )}

                {showReport && onReport && (
                  <>
                    <div className="h-px bg-border mx-2 my-0.5" />
                    <ActionButton 
                      icon={Flag} 
                      label="Report" 
                      onClick={() => handleAction(onReport)} 
                      destructive 
                    />
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

// Compact Action Button Component
const ActionButton = ({ 
  icon: Icon, 
  label, 
  onClick, 
  destructive = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors text-left",
      destructive ? "text-destructive" : ""
    )}
  >
    <Icon className="w-4 h-4 text-muted-foreground" />
    <span className="text-sm">{label}</span>
  </button>
);

export default MessageContextMenu;
