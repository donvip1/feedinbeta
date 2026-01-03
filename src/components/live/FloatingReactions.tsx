/**
 * Physics-based Floating Reactions Component
 * TikTok/Tango inspired floating hearts and emojis
 * Uses framer-motion for smooth, organic animations
 */

import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';

interface FloatingReaction {
  id: string | number;
  emoji: string;
  senderName?: string;
  x: number;
  size: number;
  rotation: number;
  duration: number;
}

interface FloatingReactionsProps {
  reactions: Array<{
    id: string | number;
    type: string;
    senderName?: string;
  }>;
  className?: string;
}

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️',
  fire: '🔥',
  star: '⭐',
  clap: '👏',
  like: '👍',
  love: '😍',
  wow: '😮',
  laugh: '😂',
  cry: '😢',
  angry: '😠',
};

export const FloatingReactions = ({ reactions, className }: FloatingReactionsProps) => {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Process incoming reactions
  useEffect(() => {
    if (reactions.length === 0) return;

    const latestReaction = reactions[reactions.length - 1];
    
    // Create floating reaction with random physics properties
    const newFloating: FloatingReaction = {
      id: `${latestReaction.id}-${Date.now()}-${Math.random()}`,
      emoji: REACTION_EMOJIS[latestReaction.type] || '❤️',
      senderName: latestReaction.senderName,
      x: 70 + Math.random() * 25, // Right side of screen (70-95%)
      size: 1 + Math.random() * 0.5, // 1x to 1.5x scale
      rotation: -15 + Math.random() * 30, // -15 to 15 degrees
      duration: 2.5 + Math.random() * 1.5, // 2.5 to 4 seconds
    };

    setFloatingReactions(prev => [...prev, newFloating]);

    // Remove after animation completes
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== newFloating.id));
    }, newFloating.duration * 1000 + 500);
  }, [reactions]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <AnimatePresence>
        {floatingReactions.map((reaction) => (
          <PhysicsReaction key={reaction.id} reaction={reaction} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Individual reaction with physics-based animation
const PhysicsReaction = ({ reaction }: { reaction: FloatingReaction }) => {
  // Spring physics for organic movement
  const springConfig = { stiffness: 80, damping: 15, mass: 1 };
  
  // Random horizontal drift
  const xDrift = Math.random() * 40 - 20;
  
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: '100vh',
        x: `${reaction.x}%`,
        scale: 0.3,
        rotate: reaction.rotation,
      }}
      animate={{
        opacity: [0, 1, 1, 1, 0.8, 0],
        y: ['100vh', '70vh', '40vh', '20vh', '-5vh'],
        x: [`${reaction.x}%`, `${reaction.x + xDrift * 0.3}%`, `${reaction.x + xDrift * 0.6}%`, `${reaction.x + xDrift}%`, `${reaction.x + xDrift * 1.2}%`],
        scale: [0.3, reaction.size, reaction.size * 1.2, reaction.size, reaction.size * 0.8],
        rotate: [reaction.rotation, reaction.rotation - 10, reaction.rotation + 5, reaction.rotation - 5, reaction.rotation],
      }}
      exit={{
        opacity: 0,
        scale: 0,
      }}
      transition={{
        duration: reaction.duration,
        ease: [0.25, 0.46, 0.45, 0.94], // Organic easing
        times: [0, 0.2, 0.5, 0.75, 1],
      }}
      className="absolute z-40 flex flex-col items-center"
      style={{ right: 0 }}
    >
      {/* Emoji with glow effect */}
      <motion.span
        className="text-4xl drop-shadow-lg filter"
        style={{
          textShadow: '0 0 20px rgba(255, 100, 100, 0.5)',
        }}
        animate={{
          scale: [1, 1.15, 1, 1.1, 1],
        }}
        transition={{
          duration: 0.8,
          repeat: Math.floor(reaction.duration / 0.8),
          repeatType: 'reverse',
        }}
      >
        {reaction.emoji}
      </motion.span>
      
      {/* Sender name badge */}
      {reaction.senderName && (
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full mt-1 whitespace-nowrap max-w-[80px] truncate"
        >
          {reaction.senderName}
        </motion.span>
      )}
    </motion.div>
  );
};

export default FloatingReactions;
