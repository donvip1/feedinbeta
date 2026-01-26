import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Telegram-style default emoji set - synced with REACTION_TYPES
export const DEFAULT_EMOJIS = ['❤️', '🔥', '😂', '👍', '🎉', '🏆', '😍', '👏'];

interface EmojiReactionsProps {
  onReact: (emoji: string) => void;
  isVisible: boolean;
  onClose?: () => void;
  selectedEmoji?: string | null;
  className?: string;
  position?: 'top' | 'bottom';
  emojis?: string[];
}

export const EmojiReactions = ({
  onReact,
  isVisible,
  onClose,
  selectedEmoji,
  className,
  position = 'bottom',
  emojis = DEFAULT_EMOJIS,
}: EmojiReactionsProps) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      className={cn(
        'flex justify-center',
        className
      )}
    >
      <div className="flex gap-1 bg-background/90 dark:bg-black/70 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-lg border border-border/50">
        {emojis.map((emoji, index) => (
          <motion.button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.03, type: 'spring', stiffness: 500 }}
            whileHover={{ scale: 1.25, y: -2 }}
            whileTap={{ scale: 0.85 }}
            className={cn(
              'text-xl sm:text-2xl p-1.5 rounded-full transition-colors duration-150',
              'hover:bg-muted/50',
              selectedEmoji === emoji && 'bg-primary/20 ring-2 ring-primary/30',
            )}
          >
            {emoji}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// Floating emoji animation component for sent reactions
interface FloatingEmojiProps {
  emoji: string;
  onComplete?: () => void;
}

export const FloatingEmoji = ({ emoji, onComplete }: FloatingEmojiProps) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="text-8xl"
        initial={{ scale: 0, rotate: -10 }}
        animate={{ 
          scale: [0, 1.5, 1.2],
          rotate: [0, 15, -15, 0],
          y: [0, -30, -50]
        }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        {emoji}
      </motion.div>
    </motion.div>
  );
};

// Quick reaction button that expands to show all emojis
interface QuickReactionButtonProps {
  onReact: (emoji: string) => void;
  selectedEmoji?: string | null;
  triggerEmoji?: string;
  className?: string;
}

export const QuickReactionButton = ({
  onReact,
  selectedEmoji,
  triggerEmoji = '😊',
  className,
}: QuickReactionButtonProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReact = (emoji: string) => {
    onReact(emoji);
    setIsExpanded(false);
  };

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
          >
            <EmojiReactions
              onReact={handleReact}
              isVisible={true}
              selectedEmoji={selectedEmoji}
              position="top"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          'text-xl p-2 rounded-full transition-colors duration-150',
          'hover:bg-muted/50',
          isExpanded && 'bg-muted/50'
        )}
      >
        {selectedEmoji || triggerEmoji}
      </motion.button>
    </div>
  );
};

// Inline emoji picker for message input
interface InlineEmojiPickerProps {
  onSelect: (emoji: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InlineEmojiPicker = ({
  onSelect,
  isOpen,
  onOpenChange,
}: InlineEmojiPickerProps) => {
  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!isOpen)}
        className="text-xl p-2 hover:scale-110 transition-transform"
      >
        😊
      </button>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 z-10">
          <EmojiReactions
            onReact={handleSelect}
            isVisible={true}
            position="top"
          />
        </div>
      )}
    </div>
  );
};
