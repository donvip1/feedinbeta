import { useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Smile, Mic, MicOff, Sword, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BroadcastInputProps {
  isHost: boolean;
  onSendMessage: (message: string, isBroadcast: boolean) => void;
  placeholder?: string;
  className?: string;
  // Optional additional controls
  isMicOn?: boolean;
  onMicToggle?: () => void;
  isScreenSharing?: boolean;
  onScreenShareToggle?: () => void;
  onPKBattleStart?: () => void;
  showPKButton?: boolean;
  canSpeak?: boolean;
}

export const BroadcastInput = ({
  isHost,
  onSendMessage,
  placeholder = "Say something...",
  className,
  isMicOn = false,
  onMicToggle,
  isScreenSharing = false,
  onScreenShareToggle,
  onPKBattleStart,
  showPKButton = false,
  canSpeak = true,
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

      {/* Mic Toggle Button */}
      {onMicToggle && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onMicToggle}
          disabled={!canSpeak && !isHost}
          className={cn(
            "p-2.5 rounded-full transition-all",
            isMicOn 
              ? "bg-primary text-primary-foreground" 
              : "bg-white/10 text-white/60 hover:text-white",
            !canSpeak && !isHost && "opacity-50 cursor-not-allowed"
          )}
          title={isMicOn ? "Mute" : "Unmute"}
        >
          {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </motion.button>
      )}

      {/* Screen Share Toggle (Host/Speaker) */}
      {onScreenShareToggle && isHost && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onScreenShareToggle}
          className={cn(
            "p-2.5 rounded-full transition-all",
            isScreenSharing 
              ? "bg-green-500 text-white" 
              : "bg-white/10 text-white/60 hover:text-white"
          )}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <Monitor className="w-4 h-4" />
        </motion.button>
      )}

      {/* PK Battle Button (Host, Video Only) */}
      {showPKButton && isHost && onPKBattleStart && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onPKBattleStart}
          className="p-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white"
          title="Start PK Battle"
        >
          <Sword className="w-4 h-4" />
        </motion.button>
      )}

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
