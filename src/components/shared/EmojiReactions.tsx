import React, { useState } from 'react';
import { cn } from '@/lib/utils';

// Telegram-style default emoji set
export const DEFAULT_EMOJIS = ['❤️', '🔥', '😍', '👏', '😂', '😮', '😢', '🎉'];

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
    <div
      className={cn(
        'flex justify-center animate-in fade-in zoom-in-95 duration-200',
        position === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2',
        className
      )}
    >
      <div className="flex gap-1 bg-background/90 dark:bg-black/70 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-lg border border-border/50">
        {emojis.map((emoji, index) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className={cn(
              'emoji-reaction-btn text-xl sm:text-2xl p-1.5 rounded-full transition-all duration-200',
              'hover:scale-125 hover:bg-muted/50 active:scale-90',
              selectedEmoji === emoji && 'bg-primary/20 scale-110',
            )}
            style={{
              animationDelay: `${index * 30}ms`,
            }}
          >
            <span className="emoji-pop">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
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
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="floating-emoji text-8xl">{emoji}</div>
    </div>
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
      {isExpanded && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">
          <EmojiReactions
            onReact={handleReact}
            isVisible={true}
            selectedEmoji={selectedEmoji}
            position="top"
          />
        </div>
      )}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'text-xl p-2 rounded-full transition-all duration-200',
          'hover:scale-110 hover:bg-muted/50 active:scale-95',
          isExpanded && 'bg-muted/50'
        )}
      >
        {selectedEmoji || triggerEmoji}
      </button>
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
