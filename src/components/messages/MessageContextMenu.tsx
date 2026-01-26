import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Reply, Copy, Forward, Pin, Edit2, Trash2, Flag, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AnimatedEmojiButton, REACTION_TYPES } from '@/components/shared/AnimatedEmojiButton';

// Core 4 reactions shown by default
const QUICK_REACTIONS = REACTION_TYPES.slice(0, 4);

// Extended emojis shown in dropdown
const EXTENDED_EMOJIS = [
  '🎉', '🏆', '😂', '😢', '😮', '🥳', '😎',
  '🤔', '😡', '💯', '👍', '👎', '🙏', '💪',
  '🤝', '😘', '🥰', '😭', '🤣', '😱', '💀',
];

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
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
  position,
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

          {/* Compact Menu - Positioned at tap location */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="fixed z-[101] w-[240px] max-h-[80vh] overflow-y-auto"
            style={{
              left: position ? Math.min(Math.max(position.x - 120, 8), window.innerWidth - 248) : '50%',
              top: position ? Math.min(Math.max(position.y - 20, 8), window.innerHeight - 300) : '50%',
              transform: position ? 'none' : 'translate(-50%, -50%)',
            }}
          >
            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              {/* Quick Reactions Row */}
              <div className="p-2.5 border-b border-border">
                <div className="flex items-center justify-center gap-2">
                  {QUICK_REACTIONS.map((reaction) => (
                    <AnimatedEmojiButton
                      key={reaction.id}
                      reaction={reaction}
                      onClick={(_, emoji) => handleReact(emoji)}
                      size="sm"
                      variant="ghost"
                      showLabel
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
