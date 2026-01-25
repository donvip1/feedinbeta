import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Reply, Copy, Forward, Pin, Star, Edit2, Trash2, Flag, Plus, X,
  ThumbsUp, Heart, Smile, Trophy, Flame, PartyPopper
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Animated emoji reaction types with Lucide icons
const REACTION_TYPES = [
  { id: 'heart', icon: Heart, color: 'bg-red-500', textColor: 'text-red-500', emoji: '❤️', label: 'Love' },
  { id: 'fire', icon: Flame, color: 'bg-orange-500', textColor: 'text-orange-500', emoji: '🔥', label: 'Fire' },
  { id: 'laugh', icon: Smile, color: 'bg-yellow-500', textColor: 'text-yellow-500', emoji: '😍', label: 'Wow' },
  { id: 'clap', icon: ThumbsUp, color: 'bg-blue-500', textColor: 'text-blue-500', emoji: '👏', label: 'Clap' },
  { id: 'party', icon: PartyPopper, color: 'bg-purple-500', textColor: 'text-purple-500', emoji: '🎉', label: 'Party' },
  { id: 'trophy', icon: Trophy, color: 'bg-amber-500', textColor: 'text-amber-500', emoji: '🏆', label: 'Win' },
];

// Extended emoji set for the "+" picker
const EXTENDED_EMOJIS = [
  '😂', '😢', '😮', '🥳', '😎', '🤔', '😡',
  '💯', '👍', '👎', '🙏', '💪', '🤝', '😘',
  '🥰', '😭', '🤣', '😱', '😳', '🤯', '💀',
  '🙄', '👀', '💕', '✨', '🌟', '💖', '🫶',
];

// Particle burst component for reaction feedback
const ParticleBurst = ({ color }: { color: string }) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className={cn("absolute w-1.5 h-1.5 rounded-full", color)}
          initial={{ 
            x: 0, 
            y: 0, 
            opacity: 1, 
            scale: 1 
          }}
          animate={{ 
            x: Math.cos((i * 60) * Math.PI / 180) * 30,
            y: Math.sin((i * 60) * Math.PI / 180) * 30,
            opacity: 0,
            scale: 0
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
};

// Animated Emoji Button Component
const AnimatedEmojiButton = ({ 
  reaction, 
  onSelect,
  isHovered,
  setHoveredId 
}: { 
  reaction: typeof REACTION_TYPES[0];
  onSelect: (emoji: string) => void;
  isHovered: boolean;
  setHoveredId: (id: string | null) => void;
}) => {
  const [showBurst, setShowBurst] = useState(false);
  const Icon = reaction.icon;

  const handleClick = () => {
    setShowBurst(true);
    setTimeout(() => {
      onSelect(reaction.emoji);
    }, 150);
    setTimeout(() => setShowBurst(false), 400);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHoveredId(reaction.id)}
      onMouseLeave={() => setHoveredId(null)}
      className={cn(
        "relative p-2.5 rounded-full transition-colors duration-200 flex items-center justify-center",
        isHovered ? `${reaction.color} text-white shadow-lg` : 'bg-muted/50 hover:bg-muted'
      )}
      whileHover={{ scale: 1.15, y: -4 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <motion.div
        animate={isHovered ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <Icon className={cn("w-5 h-5", isHovered ? 'text-white' : reaction.textColor)} />
      </motion.div>
      
      {showBurst && <ParticleBurst color={reaction.color} />}
      
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.span
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.8 }}
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-popover text-popover-foreground px-1.5 py-0.5 rounded whitespace-nowrap shadow-md"
          >
            {reaction.label}
          </motion.span>
        )}
      </AnimatePresence>
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
  onStar,
  onEdit,
  onDelete,
  onReport,
}: MessageContextMenuProps) => {
  const [showExtendedEmojis, setShowExtendedEmojis] = useState(false);
  const [hoveredReactionId, setHoveredReactionId] = useState<string | null>(null);

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

  // Show report for others' messages
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Menu Container - Centered with proper constraints */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[320px] max-w-[92vw]"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Animated Emoji Reactions Row */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between gap-2 pb-2">
                  {REACTION_TYPES.map((reaction) => (
                    <AnimatedEmojiButton
                      key={reaction.id}
                      reaction={reaction}
                      onSelect={handleReact}
                      isHovered={hoveredReactionId === reaction.id}
                      setHoveredId={setHoveredReactionId}
                    />
                  ))}
                  <motion.button
                    type="button"
                    onClick={() => setShowExtendedEmojis(!showExtendedEmojis)}
                    className={cn(
                      "p-2.5 rounded-full transition-colors duration-200",
                      showExtendedEmojis 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted/50 hover:bg-muted text-muted-foreground"
                    )}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {showExtendedEmojis ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </motion.button>
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
                      <div className="grid grid-cols-7 gap-1.5 pt-3 mt-2 border-t border-border">
                        {EXTENDED_EMOJIS.map((emoji, index) => (
                          <motion.button
                            key={emoji}
                            type="button"
                            onClick={() => handleReact(emoji)}
                            className="text-xl p-2 rounded-lg hover:bg-muted active:scale-90 transition-all duration-150"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.02 }}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.85 }}
                          >
                            {emoji}
                          </motion.button>
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
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <Reply className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Reply</span>
                </button>

                {/* Copy */}
                {message.content && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <Copy className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Copy</span>
                  </button>
                )}

                {/* Forward */}
                <button
                  type="button"
                  onClick={() => handleAction(onForward)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <Forward className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Forward</span>
                </button>

                {/* Pin */}
                {showPin && onPin && (
                  <button
                    type="button"
                    onClick={() => handleAction(onPin)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
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
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
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
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
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
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-destructive"
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
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-destructive"
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
