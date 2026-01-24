import React, { useState, useEffect } from 'react';
import { Timer, Eye, EyeOff, Lock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { playSecretSound } from '@/lib/chat-sounds';

interface SecretMessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    is_secret?: boolean;
    view_once_timer?: number; // seconds
    expires_at?: string;
    viewed_by?: string[];
  };
  isOwn: boolean;
  currentUserId: string;
  onViewed?: (messageId: string) => void;
}

export const SecretMessageBubble = ({
  message,
  isOwn,
  currentUserId,
  onViewed,
}: SecretMessageBubbleProps) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Check if message has been viewed by current user
  const hasViewed = message.viewed_by?.includes(currentUserId) || false;

  // Calculate time remaining if message has expires_at
  useEffect(() => {
    if (!message.expires_at) return;

    const updateTimer = () => {
      const now = Date.now();
      const expiresAt = new Date(message.expires_at!).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      if (remaining === 0) {
        setIsExpired(true);
        setTimeRemaining(0);
      } else {
        setTimeRemaining(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [message.expires_at]);

  const handleReveal = () => {
    if (isOwn || isExpired) return;
    
    playSecretSound();
    setIsRevealed(true);
    onViewed?.(message.id);

    // Auto-hide after viewing time
    if (message.view_once_timer) {
      setTimeout(() => {
        setIsRevealed(false);
      }, message.view_once_timer * 1000);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isExpired) {
    return (
      <motion.div
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 0.3 }}
        className={cn(
          "flex gap-2 items-center px-4 py-3 rounded-2xl",
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <div className="flex items-center gap-2 text-muted-foreground italic text-sm">
          <Flame className="w-4 h-4 text-red-500/50" />
          <span>Message self-destructed</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "flex gap-2",
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div
        onClick={handleReveal}
        className={cn(
          "relative max-w-[75%] px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300",
          "border-2 border-red-500/30",
          isOwn
            ? 'bg-gradient-to-br from-red-600/90 to-red-800/90 text-white'
            : 'bg-gradient-to-br from-slate-800 to-slate-900 text-red-100',
          !isRevealed && !isOwn && "backdrop-blur-xl"
        )}
      >
        {/* Secret Mode Indicator */}
        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-red-300/70">
          <Lock className="w-3 h-3" />
          <span>Secret Message</span>
          {message.view_once_timer && (
            <>
              <Timer className="w-3 h-3 ml-1" />
              <span>{message.view_once_timer}s</span>
            </>
          )}
        </div>

        {/* Message Content */}
        <AnimatePresence mode="wait">
          {isRevealed || isOwn ? (
            <motion.p
              key="revealed"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              className="text-[15px] leading-relaxed break-words whitespace-pre-wrap"
            >
              {message.content}
            </motion.p>
          ) : (
            <motion.div
              key="hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 py-2"
            >
              <EyeOff className="w-5 h-5" />
              <span className="text-sm">Tap to reveal</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer Display */}
        {timeRemaining !== null && timeRemaining > 0 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-red-300/60">
            <Flame className="w-3 h-3 animate-pulse" />
            <span>Expires in {formatTime(timeRemaining)}</span>
          </div>
        )}

        {/* Viewed Status */}
        {isOwn && hasViewed && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-300/60">
            <Eye className="w-3 h-3" />
            <span>Viewed</span>
          </div>
        )}

        {/* Decorative Secret Pattern */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none rounded-2xl overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(#ef4444 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />
      </div>
    </motion.div>
  );
};

export default SecretMessageBubble;
