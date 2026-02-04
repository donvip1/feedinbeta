import { useState, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_EMOJIS } from '@/components/shared/EmojiReactions';

interface BroadcastInputProps {
  onSendMessage: (message: string, isBroadcast: boolean) => void;
  placeholder?: string;
  className?: string;
  isBroadcastMode?: boolean;
}

export const BroadcastInput = ({
  onSendMessage,
  placeholder = "Say something...",
  className,
  isBroadcastMode = false,
}: BroadcastInputProps) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim(), isBroadcastMode);
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn(
      "relative flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2",
      className
    )}>
      {/* Emoji Picker Popup */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            className="absolute bottom-full left-0 mb-2 z-50"
          >
            <div className="flex gap-1 bg-background/95 dark:bg-black/90 backdrop-blur-xl rounded-2xl px-3 py-2 shadow-lg border border-border/50">
              {DEFAULT_EMOJIS.map((emoji, index) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.03, type: 'spring', stiffness: 500 }}
                  whileHover={{ scale: 1.3, y: -4 }}
                  whileTap={{ scale: 0.85 }}
                  className="text-2xl p-1.5 rounded-full transition-colors duration-150 hover:bg-muted/50"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Button */}
      <button 
        className="p-1.5 text-white/60 hover:text-white transition-colors"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
      >
        <Smile className="w-5 h-5" />
      </button>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isBroadcastMode ? "Type broadcast message..." : placeholder}
        className={cn(
          "flex-1 bg-transparent outline-none text-white text-sm",
          "placeholder:text-white/40"
        )}
      />

      {/* Send Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleSend}
        disabled={!message.trim()}
        className={cn(
          "p-2 rounded-full transition-all",
          message.trim() 
            ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white" 
            : "bg-white/10 text-white/40"
        )}
      >
        <Send className="w-4 h-4" />
      </motion.button>
    </div>
  );
};

export default BroadcastInput;
