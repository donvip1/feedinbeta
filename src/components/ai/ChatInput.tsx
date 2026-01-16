import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, Image, Sparkles, Loader2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  showImageButton?: boolean;
  showVoiceButton?: boolean;
  onImageClick?: () => void;
  onVoiceClick?: () => void;
}

export const ChatInput = ({
  value,
  onChange,
  onSend,
  onStop,
  isLoading = false,
  placeholder = 'Ask FeedIn AI anything...',
  disabled = false,
  showImageButton = false,
  showVoiceButton = false,
  onImageClick,
  onVoiceClick,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSend();
      }
    }
  };

  const canSend = value.trim() && !disabled && !isLoading;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative"
    >
      {/* Glow effect when focused */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 
                       rounded-2xl blur-md -z-10"
          />
        )}
      </AnimatePresence>

      <div 
        className={cn(
          'flex items-end gap-2 p-3 bg-card border rounded-2xl transition-all duration-200',
          isFocused ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-border',
          disabled && 'opacity-50'
        )}
      >
        {/* Left actions */}
        <div className="flex items-center gap-1">
          {showImageButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onImageClick}
              disabled={disabled || isLoading}
              className="h-9 w-9 p-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Image className="w-5 h-5" />
            </Button>
          )}
          {showVoiceButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onVoiceClick}
              disabled={disabled || isLoading}
              className="h-9 w-9 p-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Input */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[42px] max-h-[150px] resize-none border-0 bg-transparent 
                     focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60
                     text-sm py-3 px-1"
        />

        {/* Send/Stop button */}
        <motion.div whileTap={{ scale: 0.95 }}>
          {isLoading ? (
            <Button
              onClick={onStop}
              size="sm"
              variant="destructive"
              className="h-10 w-10 p-0 rounded-full"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={!canSend}
              size="sm"
              className={cn(
                'h-10 w-10 p-0 rounded-full transition-all duration-200',
                canSend 
                  ? 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25' 
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {canSend ? (
                <Send className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
          )}
        </motion.div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-center mt-2">
        <span className="text-[10px] text-muted-foreground/60">
          Press Enter to send • Shift + Enter for new line
        </span>
      </div>
    </motion.div>
  );
};

export default ChatInput;
