import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveStreakBadge } from './LiveStreakBadge';
import { useStreamStore } from '@/stores/useStreamStore';

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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const getStreak = useStreamStore((s) => s.getStreak);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="absolute bottom-36 left-0 right-16 z-30 px-4">
      <div
        className="flex flex-col space-y-1 max-h-[160px] overflow-y-auto scrollbar-hide pointer-events-auto"
        data-scrollable="true"
        style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {messages.slice(-20).map((msg) => {
            const streak = hostId ? getStreak(hostId) : 0;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="px-3 py-1.5"
              >
                {msg.user_id === 'system' || msg.isGift ? (
                  <span className="text-[11px] text-amber-400/80 font-medium">{msg.text}</span>
                ) : (
                  <>
                    <span className="text-[11px] font-black mr-1.5 text-rose-400">{msg.user}</span>
                    {streak > 0 && <LiveStreakBadge count={streak} className="mr-1" />}
                    <span className="text-[11px] font-medium text-white/80">{msg.text}</span>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>
    </div>
  );
};
