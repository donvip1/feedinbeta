import { useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BroadcastInputProps {
  isHost: boolean;
  onSendMessage: (message: string, isBroadcast: boolean) => void;
  placeholder?: string;
  className?: string;
}

export const BroadcastInput = ({
  isHost,
  onSendMessage,
  placeholder = "Say something...",
  className,
}: BroadcastInputProps) => {
  const [message, setMessage] = useState('');
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim(), isBroadcastMode && isHost);
    setMessage('');
    setIsBroadcastMode(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 bg-black/40 backdrop-blur-md rounded-full",
      className
    )}>
      {/* Broadcast Toggle (Host Only) */}
      {isHost && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsBroadcastMode(!isBroadcastMode)}
          className={cn(
            "p-2.5 rounded-full transition-all",
            isBroadcastMode 
              ? "bg-red-500 text-white" 
              : "bg-white/10 text-white/60 hover:text-white"
          )}
          title={isBroadcastMode ? "Broadcast mode ON" : "Toggle broadcast mode"}
        >
          <Megaphone className="w-4 h-4" />
        </motion.button>
      )}

      {/* Input Container */}
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBroadcastMode ? "Type broadcast message..." : placeholder}
          className={cn(
            "w-full bg-transparent outline-none text-white text-sm px-3 py-2",
            "placeholder:text-white/40"
          )}
        />
      </div>

      {/* Emoji Button */}
      <button 
        className="p-2 text-white/60 hover:text-white transition-colors"
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
          "p-2.5 rounded-full transition-all",
          message.trim() 
            ? "bg-primary text-primary-foreground" 
            : "bg-white/10 text-white/40"
        )}
      >
        <Send className="w-4 h-4" />
      </motion.button>
    </div>
  );
};

export default BroadcastInput;
