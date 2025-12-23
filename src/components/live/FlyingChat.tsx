import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedGiftEmoji } from '@/components/shared/AnimatedGiftEmoji';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

interface FlyingGift {
  id: string;
  gift_type: string;
  sender_name: string;
  credit_value: number;
}

interface FlyingChatProps {
  messages: ChatMessage[];
  gifts?: FlyingGift[];
  maxMessages?: number;
  className?: string;
}

export const FlyingChat = ({ 
  messages, 
  gifts = [], 
  maxMessages = 6,
  className 
}: FlyingChatProps) => {
  const [displayedMessages, setDisplayedMessages] = useState<(ChatMessage & { _key: string })[]>([]);
  const [flyingGifts, setFlyingGifts] = useState<(FlyingGift & { _animKey: string })[]>([]);
  const messageCountRef = useRef(0);

  // Add new messages with animation
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      const existingIds = new Set(displayedMessages.map(m => m.id));
      
      if (!existingIds.has(latestMessage.id)) {
        messageCountRef.current++;
        const newMessage = {
          ...latestMessage,
          _key: `${latestMessage.id}-${messageCountRef.current}`
        };
        
        setDisplayedMessages(prev => {
          const updated = [...prev, newMessage];
          // Keep only the last N messages
          return updated.slice(-maxMessages);
        });
      }
    }
  }, [messages, maxMessages]);

  // Handle flying gifts
  useEffect(() => {
    if (gifts.length > 0) {
      const latestGift = gifts[gifts.length - 1];
      const existingIds = new Set(flyingGifts.map(g => g.id));
      
      if (!existingIds.has(latestGift.id)) {
        const animKey = `${latestGift.id}-${Date.now()}`;
        setFlyingGifts(prev => [...prev, { ...latestGift, _animKey: animKey }]);
        
        // Remove after animation
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g._animKey !== animKey));
        }, 4000);
      }
    }
  }, [gifts]);

  // Highlight @mentions in text
  const renderContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // This is a username (captured group)
        return (
          <span key={i} className="text-primary font-semibold">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn(
      "absolute bottom-24 left-0 right-16 pointer-events-none overflow-hidden",
      className
    )}>
      {/* Flying Gifts - full screen animations */}
      <AnimatePresence>
        {flyingGifts.map((gift) => (
          <motion.div
            key={gift._animKey}
            initial={{ 
              x: -100, 
              y: 0, 
              opacity: 1,
              scale: 0.5 
            }}
            animate={{ 
              x: ['0%', '50%', '100%'],
              y: [0, -50, -100],
              opacity: [1, 1, 0],
              scale: [1.5, 2, 1.5]
            }}
            transition={{ 
              duration: 3,
              ease: "easeOut"
            }}
            className="absolute bottom-1/2 left-0 z-50 flex items-center gap-2 bg-gradient-to-r from-amber-500/90 to-pink-500/90 text-white px-4 py-2 rounded-full shadow-lg"
          >
            <AnimatedGiftEmoji giftType={gift.gift_type} size={32} />
            <span className="font-bold text-sm whitespace-nowrap">
              {gift.sender_name} sent {gift.gift_type}!
            </span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              +{gift.credit_value}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Chat Messages */}
      <div className="flex flex-col gap-1.5 px-3">
        <AnimatePresence mode="popLayout">
          {displayedMessages.map((message, index) => (
            <motion.div
              key={message._key}
              initial={{ x: -50, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ 
                duration: 0.3,
                delay: 0.05
              }}
              className="flex items-start gap-2 max-w-[85%]"
            >
              <Avatar className="w-7 h-7 shrink-0 ring-1 ring-white/20">
                <AvatarImage src={message.profiles?.avatar_url} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {message.profiles?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-1.5 shadow-lg">
                <span className="text-primary text-xs font-semibold mr-1.5">
                  {message.profiles?.display_name || 'Anonymous'}
                </span>
                <span className="text-white text-sm break-words">
                  {renderContent(message.content)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Auto-fade old messages */}
      <style>{`
        @keyframes fadeSlideUp {
          0% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
};
