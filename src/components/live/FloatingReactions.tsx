/**
 * Physics-based Floating Reactions Component
 * TikTok/Tango inspired floating emojis and gifts
 * Uses framer-motion for smooth, organic animations
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

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
    emoji?: string;
  }>;
  className?: string;
}

// Unified emoji mapping for all reaction types
const REACTION_EMOJIS: Record<string, string> = {
  // Live reactions
  heart: '❤️',
  like: '👍',
  fire: '🔥',
  clap: '👏',
  star: '⭐',
  love: '😍',
  wow: '😮',
  laugh: '😂',
  cry: '😢',
  angry: '😠',
  // Gift emojis
  rose: '🌹',
  coffee: '☕',
  diamond: '💎',
  rocket: '🚀',
  castle: '🏰',
  crown: '👑',
  lightning: '⚡',
  universe: '🌌',
};

export const FloatingReactions = ({ reactions, className }: FloatingReactionsProps) => {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Process incoming reactions
  useEffect(() => {
    if (reactions.length === 0) return;

    const latestReaction = reactions[reactions.length - 1];
    
    // Use provided emoji or look up from type
    const emoji = latestReaction.emoji || REACTION_EMOJIS[latestReaction.type] || '❤️';
    
    // Create floating reaction with random physics properties
    const newFloating: FloatingReaction = {
      id: `${latestReaction.id}-${Date.now()}-${Math.random()}`,
      emoji,
      senderName: latestReaction.senderName,
      x: 50 + Math.random() * 40 - 20, // 30-70% of screen width
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
  // Random horizontal drift
  const xDrift = Math.random() * 40 - 20;
  
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: '100vh',
        left: `${reaction.x}%`,
        scale: 0.3,
        rotate: reaction.rotation,
      }}
      animate={{
        opacity: [0, 1, 1, 1, 0.8, 0],
        y: ['100vh', '70vh', '40vh', '20vh', '-5vh'],
        left: [`${reaction.x}%`, `${reaction.x + xDrift * 0.3}%`, `${reaction.x + xDrift * 0.6}%`, `${reaction.x + xDrift}%`, `${reaction.x + xDrift * 1.2}%`],
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
