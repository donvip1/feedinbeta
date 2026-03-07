import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import { LiveStreakBadge } from './LiveStreakBadge';
import { useStreamStore } from '@/stores/useStreamStore';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  id: string;
  user_id: string;
  user: string;
  handle: string;
  time: string;
  text: string;
  avatar: string;
  likes: number;
  liked_by_me: boolean;
  isGift?: boolean;
}

interface StreamChatProps {
  messages: ChatMessage[];
  hostId?: string;
}

export const StreamChat = ({ messages, hostId }: StreamChatProps) => {
  const chatRef = useRef<HTMLDivElement>(null);
  const getStreak = useStreamStore((s) => s.getStreak);
  const { user } = useAuth();

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="absolute bottom-36 left-0 right-16 z-30 px-4">
      <div
        ref={chatRef}
        className="flex flex-col gap-2 max-h-[160px] overflow-y-auto scrollbar-hide pointer-events-auto"
        data-scrollable="true"
        style={{
          transform: 'translateZ(0)',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          maskImage: 'linear-gradient(to bottom, transparent, black 20%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%)',
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {messages.slice(-20).map((msg) => {
            const streak = hostId ? getStreak(hostId) : 0;
            const isMe = msg.user_id === user?.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`p-3 rounded-2xl border backdrop-blur-xl self-start max-w-[85%] ${
                  msg.isGift
                    ? 'bg-amber-500/20 border-amber-500/30'
                    : isMe
                    ? 'bg-yellow-400/20 border-yellow-400/30'
                    : 'bg-black/30 border-white/5'
                }`}
              >
                {msg.user_id === 'system' ? (
                  <span className="text-[11px] text-amber-400/80 font-medium">{msg.text}</span>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black uppercase ${isMe ? 'text-yellow-400' : 'text-white/40'}`}>
                        {msg.user}
                      </span>
                      {streak > 0 && (
                        <div className="flex items-center gap-0.5 text-[8px] text-orange-400 font-black">
                          <Flame size={8} fill="currentColor" />{streak}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium leading-snug text-white/90">{msg.text}</p>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
