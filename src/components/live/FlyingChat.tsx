import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedGiftEmoji } from '@/components/shared/AnimatedGiftEmoji';
import { Coins, Crown, Gift, Megaphone } from 'lucide-react';
import { FullScreenGiftEffect } from './FullScreenGiftEffect';
interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_broadcast?: boolean;
  is_gift?: boolean;
  gift_value?: number;
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
  sender_avatar?: string;
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
  coffee: '☕',
  castle: '🏰',
};

// Get display name for gift type
const getGiftDisplayName = (type: string): string => {
  const names: Record<string, string> = {
    rose: 'rose',
    coffee: 'coffee',
    heart: 'love',
    diamond: 'diamond',
    rocket: 'rocket',
    castle: 'castle',
    crown: 'crown',
    fire: 'fire',
    star: 'star',
  };
  return names[type] || type;
};

export const FlyingChat = ({ 
  messages, 
  gifts = [], 
  hostId,
  maxMessages = 12,
  className,
  bottomOffset = 200,
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

  // Handle flying gifts - TikTok style prominent display + add to chat as message
  useEffect(() => {
    if (gifts.length > 0) {
      const latestGift = gifts[gifts.length - 1];
      const existingIds = new Set(flyingGifts.map(g => g.id));
      
      if (!existingIds.has(latestGift.id)) {
        const animKey = `${latestGift.id}-${Date.now()}`;
        setFlyingGifts(prev => [...prev, { ...latestGift, _animKey: animKey }]);
        
        // Add gift as a chat message with special styling
        messageCountRef.current++;
        const giftMessage: ChatMessage & { _key: string } = {
          id: `gift-${latestGift.id}`,
          content: `Sent ${getGiftDisplayName(latestGift.gift_type)}!`,
          user_id: latestGift.sender_id || '',
          created_at: new Date().toISOString(),
          is_gift: true,
          gift_value: latestGift.credit_value,
          profiles: {
            display_name: latestGift.sender_name,
            avatar_url: latestGift.sender_avatar,
          },
          _key: `gift-msg-${animKey}`
        };
        setDisplayedMessages(prev => [...prev, giftMessage].slice(-maxMessages));
        
        // Trigger full-screen effect for all gifts
        const newEffect = {
          id: animKey,
          giftType: latestGift.gift_type,
          intensity: getGiftIntensity(latestGift.credit_value),
          timestamp: Date.now(),
        };
        setFullScreenEffects(prev => [...prev, newEffect]);
        
        // Remove flying gift after animation (but keep chat message)
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g._animKey !== animKey));
          setFullScreenEffects(prev => prev.filter(e => e.id !== animKey));
        }, 5000);
      }
    }
  }, [gifts, maxMessages]);

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
          "absolute left-0 pointer-events-none z-20",
          className
        )}
        style={{ 
          bottom: `${bottomOffset}px`, 
          maxHeight: '45vh',
          maxWidth: '70%',
          width: '70%'
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

      {/* Plain Chat Messages - TikTok/Tango Style */}
      <div className="flex flex-col gap-2.5 px-4 overflow-y-auto max-h-full scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {displayedMessages.map((message) => {
            const isHostUser = hostId && message.user_id === hostId;
            const displayName = message.profiles?.display_name || message.profiles?.username || 'Anonymous';
            const isBroadcast = message.is_broadcast || message.content?.startsWith('📢');
            const isGiftMessage = message.is_gift;
            
            return (
              <motion.div
                key={message._key}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-auto"
              >
                {/* Broadcast Message - Highlighted with red background */}
                {isBroadcast ? (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-red-600/80 to-red-500/60 backdrop-blur-sm px-3 py-2 rounded-full">
                    <Megaphone className="w-4 h-4 text-white shrink-0" />
                    <p className="text-white font-bold text-sm">
                      <span className="text-yellow-300 mr-1">Broadcast</span>
                      {message.content.replace('📢', '').trim()}
                    </p>
                  </div>
                ) : isGiftMessage ? (
                  /* Gift Message - TikTok/Tango style gradient pill with avatar */
                  <motion.div 
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-3 py-2 rounded-full shadow-lg shadow-pink-500/30"
                  >
                    {/* Sender Avatar */}
                    <Avatar className="w-7 h-7 border-2 border-white/30 shrink-0">
                      <AvatarImage src={message.profiles?.avatar_url} />
                      <AvatarFallback className="bg-white/20 text-white text-xs">
                        {displayName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Text Content */}
                    <p className="text-sm font-semibold whitespace-nowrap">
                      <span className="text-white/90">{displayName === 'Anonymous' ? 'Me' : displayName}</span>
                      <span className="text-yellow-300 ml-1 font-bold">{message.content}</span>
                    </p>
                  </motion.div>
                ) : (
                  /* Regular Message */
                  <p className="text-sm leading-relaxed">
                    {/* Clickable Username - inline with shadow */}
                    <span 
                      className={cn(
                        "font-bold cursor-pointer hover:underline mr-2",
                        isHostUser 
                          ? "text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" 
                          : "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                      )}
                      onClick={(e) => handleProfileClick(message.user_id, e)}
                    >
                      {isHostUser && <Crown className="w-3 h-3 inline-block mr-1 text-amber-400" />}
                      {displayName}
                    </span>
                    {/* Message content - bold with shadow */}
                    <span className="text-white font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                      {renderContent(message.content)}
                    </span>
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
};