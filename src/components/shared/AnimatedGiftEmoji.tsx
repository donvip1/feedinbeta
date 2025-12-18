import { useEffect, useState } from 'react';

// 19 unique 3D-style animated emojis for gifts
const GIFT_EMOJIS: Record<string, { emoji: string; animation: string }> = {
  // Basic gifts (9 unique)
  heart: { emoji: '❤️', animation: 'animate-heartbeat' },
  star: { emoji: '⭐', animation: 'animate-spin-slow' },
  coffee: { emoji: '☕', animation: 'animate-steam' },
  flower: { emoji: '🌸', animation: 'animate-sway' },
  sun: { emoji: '☀️', animation: 'animate-glow' },
  music: { emoji: '🎵', animation: 'animate-bounce-note' },
  pizza: { emoji: '🍕', animation: 'animate-wiggle' },
  icecream: { emoji: '🍦', animation: 'animate-melt' },
  moon: { emoji: '🌙', animation: 'animate-float' },
  
  // Premium gifts (6 unique)
  lightning: { emoji: '⚡', animation: 'animate-flash' },
  trophy: { emoji: '🏆', animation: 'animate-shine' },
  fire: { emoji: '🔥', animation: 'animate-flame' },
  party: { emoji: '🎉', animation: 'animate-confetti' },
  cake: { emoji: '🎂', animation: 'animate-candle' },
  rainbow: { emoji: '🌈', animation: 'animate-rainbow' },
  
  // Exclusive gifts (4 unique)
  rocket: { emoji: '🚀', animation: 'animate-launch' },
  crown: { emoji: '👑', animation: 'animate-royal' },
  diamond: { emoji: '💎', animation: 'animate-sparkle' },
  universe: { emoji: '✨', animation: 'animate-cosmic' },
};

interface AnimatedGiftEmojiProps {
  giftType: string;
  size?: number;
  className?: string;
}

export const AnimatedGiftEmoji = ({ 
  giftType, 
  size = 48, 
  className = '' 
}: AnimatedGiftEmojiProps) => {
  const normalizedType = giftType.toLowerCase().replace(/\s+/g, '');
  const giftData = GIFT_EMOJIS[normalizedType] || GIFT_EMOJIS.heart;
  
  return (
    <div 
      className={`flex items-center justify-center ${giftData.animation} ${className}`}
      style={{ 
        fontSize: size * 0.75, 
        width: size, 
        height: size,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
      }}
    >
      <span className="select-none" role="img" aria-label={giftType}>
        {giftData.emoji}
      </span>
    </div>
  );
};

export default AnimatedGiftEmoji;
