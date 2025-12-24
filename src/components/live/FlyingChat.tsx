import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedGiftEmoji } from '@/components/shared/AnimatedGiftEmoji';
import { Coins } from 'lucide-react';

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

const GIFT_EMOJIS: Record<string, string> = {
  heart: '❤️',
  star: '⭐',
  fire: '🔥',
  lightning: '⚡',
  crown: '👑',
  diamond: '💎',
  rocket: '🚀',
  universe: '🌌',
  credits: '💰',
};

export const FlyingChat = ({ 
  messages, 
  gifts = [], 
  maxMessages = 12,
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
          return updated.slice(-maxMessages);
        });
      }
    }
  }, [messages, maxMessages]);

  // Handle flying gifts - TikTok style prominent display
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
        }, 5000);
      }
    }
  }, [gifts]);

  // Highlight @mentions in text
  const renderContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span key={i} className="text-primary font-semibold">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const getGiftEmoji = (type: string) => GIFT_EMOJIS[type] || '🎁';

  return (
    <div className={cn(
      "absolute bottom-28 left-0 right-16 pointer-events-none overflow-hidden",
      className
    )}>
      {/* TikTok-Style Flying Gifts - Center screen, prominent */}
      <AnimatePresence>
        {flyingGifts.map((gift, index) => (
          <motion.div
            key={gift._animKey}
            initial={{ 
              opacity: 0, 
              scale: 0,
              x: '-50%',
              y: 100
            }}
            animate={{ 
              opacity: [0, 1, 1, 1, 0],
              scale: [0.5, 1.2, 1, 1, 0.8],
              y: [100, 0, 0, -50, -150],
            }}
            exit={{ 
              opacity: 0,
              scale: 0.5,
              y: -200
            }}
            transition={{ 
              duration: 4,
              ease: "easeOut",
              times: [0, 0.15, 0.3, 0.7, 1]
            }}
            className="fixed left-1/2 top-1/3 z-50 pointer-events-none"
            style={{ marginTop: index * 80 }}
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white px-6 py-3 rounded-full shadow-2xl">
              <motion.span 
                className="text-4xl"
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 0.5, 
                  repeat: 3,
                  repeatType: "reverse"
                }}
              >
                {getGiftEmoji(gift.gift_type)}
              </motion.span>
              <div className="text-left">
                <p className="font-bold text-lg whitespace-nowrap">
                  {gift.sender_name}
                </p>
                <p className="text-sm text-white/90">
                  sent <span className="font-bold">{gift.gift_type}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                <Coins className="w-4 h-4" />
                <span className="font-bold">+{gift.credit_value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Chat Messages */}
      <div className="flex flex-col gap-2 px-3">
        <AnimatePresence mode="popLayout">
          {displayedMessages.map((message) => (
            <motion.div
              key={message._key}
              initial={{ x: -50, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ 
                duration: 0.3,
                delay: 0.05
              }}
              className="flex items-start gap-2 max-w-[90%]"
            >
              <Avatar className="w-8 h-8 shrink-0 ring-2 ring-white/20">
                <AvatarImage src={message.profiles?.avatar_url} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {message.profiles?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-3 py-2 shadow-lg">
                <span className="text-primary text-sm font-bold mr-2">
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
    </div>
  );
};