import { useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  return (
    <div className={cn(
      "flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2",
      className
    )}>
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

      {/* Emoji Button */}
      <button 
        className="p-1.5 text-white/60 hover:text-white transition-colors"
        onClick={() => {/* TODO: Emoji picker */}}
      >
        <Smile className="w-5 h-5" />
      </button>

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
