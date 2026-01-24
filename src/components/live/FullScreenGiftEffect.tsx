/**
 * Full-Screen Gift Effect Component
 * Creates dramatic floating emoji explosions when gifts are received
 * Inspired by TikTok/Tango premium gift animations
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  duration: number;
  delay: number;
  path: 'rise' | 'spiral' | 'burst' | 'float';
}

interface GiftEffect {
  id: string;
  giftType: string;
  intensity: 'basic' | 'premium' | 'exclusive';
  timestamp: number;
}

interface FullScreenGiftEffectProps {
  gifts: GiftEffect[];
  className?: string;
}

const GIFT_EMOJI_MAP: Record<string, { emoji: string; particles: string[] }> = {
  heart: { emoji: '❤️', particles: ['❤️', '💕', '💗', '💖', '💝', '💓'] },
  star: { emoji: '⭐', particles: ['⭐', '✨', '🌟', '💫', '⭐'] },
  fire: { emoji: '🔥', particles: ['🔥', '🔥', '💥', '⚡', '✨'] },
  lightning: { emoji: '⚡', particles: ['⚡', '💫', '✨', '⚡', '🌟'] },
  crown: { emoji: '👑', particles: ['👑', '✨', '💎', '⭐', '🌟'] },
  diamond: { emoji: '💎', particles: ['💎', '✨', '💫', '🌟', '💎', '✨'] },
  rocket: { emoji: '🚀', particles: ['🚀', '✨', '💫', '⭐', '🌟', '🔥'] },
  universe: { emoji: '🌌', particles: ['🌌', '✨', '💫', '⭐', '🌟', '🌙'] },
  rose: { emoji: '🌹', particles: ['🌹', '🌸', '💐', '🌺', '🌷'] },
  kiss: { emoji: '💋', particles: ['💋', '💕', '❤️', '💗', '😘'] },
  cake: { emoji: '🎂', particles: ['🎂', '🎉', '🎊', '✨', '🎁'] },
  money: { emoji: '💰', particles: ['💰', '💵', '💎', '✨', '💫'] },
  credits: { emoji: '💰', particles: ['💰', '💵', '💎', '✨', '💫'] },
};

const INTENSITY_CONFIG = {
  basic: { count: 8, duration: 2.5, size: { min: 20, max: 36 } },
  premium: { count: 15, duration: 3.5, size: { min: 28, max: 48 } },
  exclusive: { count: 25, duration: 4.5, size: { min: 32, max: 64 } },
};

const getRandomPath = (): FloatingEmoji['path'] => {
  const paths: FloatingEmoji['path'][] = ['rise', 'spiral', 'burst', 'float'];
  return paths[Math.floor(Math.random() * paths.length)];
};

const generateFloatingEmojis = (
  giftType: string,
  intensity: 'basic' | 'premium' | 'exclusive',
  baseId: string
): FloatingEmoji[] => {
  const config = INTENSITY_CONFIG[intensity];
  const giftData = GIFT_EMOJI_MAP[giftType] || GIFT_EMOJI_MAP.heart;
  
  return Array.from({ length: config.count }, (_, i) => ({
    id: `${baseId}-${i}`,
    emoji: giftData.particles[i % giftData.particles.length],
    x: 10 + Math.random() * 80, // Random horizontal position
    y: Math.random() * 100, // Random vertical start
    size: config.size.min + Math.random() * (config.size.max - config.size.min),
    rotation: Math.random() * 360,
    duration: config.duration + Math.random() * 1.5,
    delay: Math.random() * 0.5,
    path: getRandomPath(),
  }));
};

const FloatingEmojiParticle = ({ particle }: { particle: FloatingEmoji }) => {
  const getPathAnimation = () => {
    switch (particle.path) {
      case 'spiral':
        return {
          x: [0, 30, -20, 40, -30, 20],
          y: [0, -80, -180, -300, -450, -600],
          rotate: [particle.rotation, particle.rotation + 720],
          scale: [0, 1.2, 1, 0.8, 0.6, 0],
          opacity: [0, 1, 1, 0.8, 0.4, 0],
        };
      case 'burst':
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 200;
        return {
          x: [0, Math.cos(angle) * distance * 0.5, Math.cos(angle) * distance],
          y: [0, Math.sin(angle) * distance * 0.3 - 100, -300 + Math.sin(angle) * distance * 0.5],
          rotate: [particle.rotation, particle.rotation + 540],
          scale: [0, 1.5, 1, 0.5, 0],
          opacity: [0, 1, 1, 0.6, 0],
        };
      case 'float':
        return {
          x: [0, -15 + Math.random() * 30, 15 - Math.random() * 30, 0],
          y: [0, -150, -350, -550],
          rotate: [particle.rotation, particle.rotation + 180, particle.rotation + 360],
          scale: [0.5, 1.1, 1, 0.7, 0],
          opacity: [0, 1, 1, 0.7, 0],
        };
      case 'rise':
      default:
        return {
          x: [0, -10 + Math.random() * 20, 10 - Math.random() * 20],
          y: [0, -200, -500],
          rotate: [particle.rotation, particle.rotation + 360],
          scale: [0, 1.3, 1, 0.6, 0],
          opacity: [0, 1, 1, 0.5, 0],
        };
    }
  };

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        scale: 0,
        x: 0,
        y: 0,
        rotate: particle.rotation,
      }}
      animate={getPathAnimation()}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: particle.duration,
        delay: particle.delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="absolute pointer-events-none z-50"
      style={{
        left: `${particle.x}%`,
        bottom: `${particle.y}%`,
        fontSize: particle.size,
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
      }}
    >
      <span className="select-none">{particle.emoji}</span>
    </motion.div>
  );
};

// Central gift explosion effect
const CentralGiftExplosion = ({ 
  giftType, 
  intensity 
}: { 
  giftType: string; 
  intensity: 'basic' | 'premium' | 'exclusive' 
}) => {
  const emoji = GIFT_EMOJI_MAP[giftType]?.emoji || '🎁';
  const isExclusive = intensity === 'exclusive';
  const isPremium = intensity === 'premium' || intensity === 'exclusive';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 1, 1, 0],
        scale: [0, isExclusive ? 3 : isPremium ? 2.5 : 2, isExclusive ? 2.5 : 2, 1.8, 0],
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: isExclusive ? 2 : isPremium ? 1.5 : 1,
        ease: "easeOut",
      }}
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
    >
      <motion.span
        animate={{
          rotate: [0, 15, -15, 10, -10, 0],
          filter: [
            'drop-shadow(0 0 20px rgba(255,200,100,0.8))',
            'drop-shadow(0 0 40px rgba(255,150,100,1))',
            'drop-shadow(0 0 60px rgba(255,100,150,0.8))',
            'drop-shadow(0 0 40px rgba(255,200,100,0.6))',
          ],
        }}
        transition={{
          duration: 0.5,
          repeat: isExclusive ? 4 : isPremium ? 3 : 2,
          repeatType: "reverse",
        }}
        className="text-8xl md:text-9xl"
      >
        {emoji}
      </motion.span>
    </motion.div>
  );
};

// Sparkle ring effect for premium/exclusive gifts
const SparkleRing = ({ intensity }: { intensity: 'premium' | 'exclusive' }) => {
  const sparkleCount = intensity === 'exclusive' ? 16 : 10;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: [0, 1, 0],
        scale: [0.5, 1.5, 2],
        rotate: [0, 180],
      }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-40"
    >
      {Array.from({ length: sparkleCount }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            x: [0, Math.cos((i / sparkleCount) * Math.PI * 2) * 150],
            y: [0, Math.sin((i / sparkleCount) * Math.PI * 2) * 150],
          }}
          transition={{
            duration: 1,
            delay: i * 0.05,
          }}
          className="absolute text-2xl"
        >
          ✨
        </motion.span>
      ))}
    </motion.div>
  );
};

export const FullScreenGiftEffect = ({ gifts, className }: FullScreenGiftEffectProps) => {
  const [activeEffects, setActiveEffects] = useState<Map<string, FloatingEmoji[]>>(new Map());
  const [centralExplosions, setCentralExplosions] = useState<GiftEffect[]>([]);

  useEffect(() => {
    if (gifts.length === 0) return;
    
    const latestGift = gifts[gifts.length - 1];
    
    // Generate floating particles
    const particles = generateFloatingEmojis(
      latestGift.giftType,
      latestGift.intensity,
      latestGift.id
    );
    
    setActiveEffects(prev => {
      const next = new Map(prev);
      next.set(latestGift.id, particles);
      return next;
    });
    
    // Add central explosion
    setCentralExplosions(prev => [...prev, latestGift]);
    
    // Cleanup after animation
    const duration = INTENSITY_CONFIG[latestGift.intensity].duration * 1000 + 2000;
    setTimeout(() => {
      setActiveEffects(prev => {
        const next = new Map(prev);
        next.delete(latestGift.id);
        return next;
      });
      setCentralExplosions(prev => prev.filter(g => g.id !== latestGift.id));
    }, duration);
  }, [gifts]);

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden z-50 ${className}`}>
      {/* Central Explosions */}
      <AnimatePresence>
        {centralExplosions.map((gift) => (
          <CentralGiftExplosion 
            key={`central-${gift.id}`}
            giftType={gift.giftType}
            intensity={gift.intensity}
          />
        ))}
      </AnimatePresence>

      {/* Sparkle Rings for Premium/Exclusive */}
      <AnimatePresence>
        {centralExplosions
          .filter(g => g.intensity === 'premium' || g.intensity === 'exclusive')
          .map((gift) => (
            <SparkleRing 
              key={`ring-${gift.id}`}
              intensity={gift.intensity as 'premium' | 'exclusive'}
            />
          ))}
      </AnimatePresence>

      {/* Floating Particles */}
      <AnimatePresence>
        {Array.from(activeEffects.entries()).map(([giftId, particles]) =>
          particles.map((particle) => (
            <FloatingEmojiParticle key={particle.id} particle={particle} />
          ))
        )}
      </AnimatePresence>
    </div>
  );
};

export default FullScreenGiftEffect;
