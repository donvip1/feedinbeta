import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedGiftEmoji } from '@/components/shared/AnimatedGiftEmoji';
import { Coins, Crown } from 'lucide-react';
import { FullScreenGiftEffect } from './FullScreenGiftEffect';
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
  sender_id?: string;
}

interface FlyingChatProps {
  messages: ChatMessage[];
  gifts?: FlyingGift[];
  hostId?: string;
  maxMessages?: number;
  className?: string;
  bottomOffset?: number;
  onMentionClick?: (username: string) => void;
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
  rose: '🌹',
  kiss: '💋',
  cake: '🎂',
  money: '💰',
};

export const FlyingChat = ({ 
  messages, 
  gifts = [], 
  hostId,
  maxMessages = 12,
  className,
  bottomOffset = 112,
  onMentionClick
}: FlyingChatProps) => {
  const navigate = useNavigate();
  const [displayedMessages, setDisplayedMessages] = useState<(ChatMessage & { _key: string })[]>([]);
  const [flyingGifts, setFlyingGifts] = useState<(FlyingGift & { _animKey: string })[]>([]);
  const [fullScreenEffects, setFullScreenEffects] = useState<Array<{
    id: string;
    giftType: string;
    intensity: 'basic' | 'premium' | 'exclusive';
    timestamp: number;
  }>>([]);
  const messageCountRef = useRef(0);

  // Determine gift intensity based on credit value
  const getGiftIntensity = (creditValue: number): 'basic' | 'premium' | 'exclusive' => {
    if (creditValue >= 500) return 'exclusive';
    if (creditValue >= 100) return 'premium';
    return 'basic';
  };

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
        
        // Trigger full-screen effect for all gifts
        const newEffect = {
          id: animKey,
          giftType: latestGift.gift_type,
          intensity: getGiftIntensity(latestGift.credit_value),
          timestamp: Date.now(),
        };
        setFullScreenEffects(prev => [...prev, newEffect]);
        
        // Remove after animation
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g._animKey !== animKey));
          setFullScreenEffects(prev => prev.filter(e => e.id !== animKey));
        }, 5000);
      }
    }
  }, [gifts]);

  // Navigate to user profile
  const handleProfileClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  // Highlight @mentions in text and make them clickable
  const renderContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span 
            key={i} 
            className="text-primary font-semibold cursor-pointer hover:underline pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick?.(part);
            }}
          >
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const getGiftEmoji = (type: string) => GIFT_EMOJIS[type] || '🎁';

  return (
    <>
      {/* Full-Screen Floating Emoji Effects */}
      <FullScreenGiftEffect gifts={fullScreenEffects} />
      
      <div 
        className={cn(
          "absolute left-0 pointer-events-none overflow-hidden z-20",
          className
        )}
        style={{ 
          bottom: `${bottomOffset}px`, 
          maxHeight: '40vh',
          maxWidth: '55%',  // Constrain to left side only
          width: '55%'
        }}
      >
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
            className="fixed left-1/2 top-1/3 z-50 pointer-events-auto cursor-pointer"
            style={{ marginTop: index * 80 }}
            onClick={(e) => gift.sender_id && handleProfileClick(gift.sender_id, e)}
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
                <p className="font-bold text-lg whitespace-nowrap hover:underline">
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
          {displayedMessages.map((message) => {
            const isHost = hostId && message.user_id === hostId;
            const displayName = message.profiles?.display_name || message.profiles?.username || 'Anonymous';
            
            return (
              <motion.div
                key={message._key}
                initial={{ x: -50, opacity: 0, scale: 0.9 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.8 }}
                transition={{ 
                  duration: 0.3,
                  delay: 0.05
                }}
                className="flex items-start gap-2 max-w-[90%] pointer-events-auto"
              >
                {/* Clickable Avatar */}
                <Avatar 
                  className={cn(
                    "w-8 h-8 shrink-0 ring-2 cursor-pointer hover:scale-110 transition-transform",
                    isHost ? "ring-amber-400" : "ring-white/20"
                  )}
                  onClick={(e) => handleProfileClick(message.user_id, e)}
                >
                  <AvatarImage src={message.profiles?.avatar_url} />
                  <AvatarFallback className={cn(
                    "text-xs",
                    isHost ? "bg-amber-500/50 text-amber-100" : "bg-primary/20 text-primary"
                  )}>
                    {displayName[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "backdrop-blur-sm rounded-2xl px-3 py-2 shadow-lg",
                  isHost 
                    ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border border-amber-400/30" 
                    : "bg-black/70"
                )}>
                  <div className="flex items-center gap-1.5">
                    {isHost && (
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                    {/* Clickable Username */}
                    <span 
                      className={cn(
                        "text-sm font-bold mr-2 cursor-pointer hover:underline",
                        isHost ? "text-amber-400" : "text-primary"
                      )}
                      onClick={(e) => handleProfileClick(message.user_id, e)}
                    >
                      {displayName}
                      {isHost && <span className="text-[10px] text-amber-300/80 ml-1">• Host</span>}
                    </span>
                  </div>
                  <span className="text-white text-sm break-words">
                    {renderContent(message.content)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
};