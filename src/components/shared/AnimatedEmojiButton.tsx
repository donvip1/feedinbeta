/**
 * ANIMATED EMOJI REACTION ENGINE
 * Unified component for all social interactions across the app
 * Used in: DMs, Groups, Feed, Live Streams, Live Spaces, Stories
 * Features: Lucide icons with color themes, hover-scaling, particle burst system
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, Flame, ThumbsUp, Trophy, PartyPopper, Smile, 
  Star, Sparkles, LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard reaction types used across the app
export const REACTION_TYPES = [
  { id: 'heart', icon: Heart, color: 'bg-red-500', textColor: 'text-red-500', emoji: '❤️', label: 'Love' },
  { id: 'fire', icon: Flame, color: 'bg-orange-500', textColor: 'text-orange-500', emoji: '🔥', label: 'Fire' },
  { id: 'laugh', icon: Smile, color: 'bg-yellow-500', textColor: 'text-yellow-500', emoji: '😂', label: 'Haha' },
  { id: 'like', icon: ThumbsUp, color: 'bg-blue-500', textColor: 'text-blue-500', emoji: '👍', label: 'Like' },
  { id: 'party', icon: PartyPopper, color: 'bg-purple-500', textColor: 'text-purple-500', emoji: '🎉', label: 'Party' },
  { id: 'trophy', icon: Trophy, color: 'bg-amber-500', textColor: 'text-amber-500', emoji: '🏆', label: 'Win' },
] as const;

// Extended emoji set for live streams and spaces
export const LIVE_REACTIONS = [
  { id: 'heart', icon: Heart, color: 'bg-red-500', textColor: 'text-red-500', emoji: '❤️', label: 'Heart' },
  { id: 'fire', icon: Flame, color: 'bg-orange-500', textColor: 'text-orange-500', emoji: '🔥', label: 'Fire' },
  { id: 'star', icon: Star, color: 'bg-yellow-500', textColor: 'text-yellow-500', emoji: '⭐', label: 'Star' },
  { id: 'clap', icon: PartyPopper, color: 'bg-purple-500', textColor: 'text-purple-500', emoji: '👏', label: 'Clap' },
  { id: 'like', icon: ThumbsUp, color: 'bg-blue-500', textColor: 'text-blue-500', emoji: '👍', label: 'Like' },
  { id: 'love', icon: Sparkles, color: 'bg-pink-500', textColor: 'text-pink-500', emoji: '😍', label: 'Love' },
] as const;

export type ReactionType = typeof REACTION_TYPES[number];

interface ParticleProps {
  delay: number;
  color: string;
}

const Particle = ({ delay, color }: ParticleProps) => {
  const angle = Math.random() * 360;
  const distance = 20 + Math.random() * 30;
  const x = Math.cos(angle * Math.PI / 180) * distance;
  const y = Math.sin(angle * Math.PI / 180) * distance;
  
  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      animate={{ 
        opacity: 0, 
        scale: 0.5, 
        x, 
        y 
      }}
      transition={{ 
        duration: 0.6, 
        delay: delay / 1000,
        ease: "easeOut"
      }}
      className={cn("absolute w-2 h-2 rounded-full", color)}
      style={{ left: '50%', top: '50%', marginLeft: -4, marginTop: -4 }}
    />
  );
};

interface AnimatedEmojiButtonProps {
  reaction: ReactionType;
  isSelected?: boolean;
  onClick: (reactionId: string, emoji: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  variant?: 'default' | 'ghost' | 'live';
}

export const AnimatedEmojiButton = ({
  reaction,
  isSelected = false,
  onClick,
  size = 'md',
  showLabel = false,
  className,
  variant = 'default',
}: AnimatedEmojiButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [bursts, setBursts] = useState<number[]>([]);
  
  const Icon = reaction.icon;
  
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2.5',
    lg: 'p-3',
  };
  
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  
  const getAnimationClass = () => {
    if (isSelected) return 'scale-110';
    if (isHovered) return 'scale-105 -translate-y-0.5';
    return 'scale-100';
  };
  
  const getVariantClasses = () => {
    const base = "relative rounded-full transition-all duration-200 flex items-center justify-center";
    
    if (variant === 'live') {
      return cn(
        base,
        isSelected 
          ? `${reaction.color} text-white shadow-lg` 
          : 'bg-black/50 backdrop-blur-sm text-white/80 hover:bg-black/70 hover:text-white'
      );
    }
    
    if (variant === 'ghost') {
      return cn(
        base,
        isSelected 
          ? `${reaction.color} text-white shadow-lg` 
          : `bg-muted/60 hover:bg-muted ${reaction.textColor}`
      );
    }
    
    // Default variant
    return cn(
      base,
      isSelected 
        ? `${reaction.color} text-white shadow-lg ring-2 ring-offset-2 ring-offset-background` 
        : `bg-muted/60 hover:bg-muted active:scale-90 ${reaction.textColor}`
    );
  };
  
  const handleClick = useCallback(() => {
    onClick(reaction.id, reaction.emoji);
    
    // Trigger particle burst
    const newBursts = Array.from({ length: 6 }).map((_, i) => Date.now() + i);
    setBursts(newBursts);
    
    // Clear bursts after animation
    setTimeout(() => setBursts([]), 700);
  }, [onClick, reaction.id, reaction.emoji]);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        getVariantClasses(),
        sizeClasses[size],
        getAnimationClass(),
        className
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.85 }}
      title={reaction.label}
    >
      {/* Particle burst effect */}
      <AnimatePresence>
        {bursts.length > 0 && (
          <div className="absolute inset-0 overflow-visible pointer-events-none">
            {bursts.map((id, i) => (
              <Particle 
                key={id} 
                delay={i * 40} 
                color={reaction.color}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
      
      {/* Icon with pulse animation when selected */}
      <motion.div
        animate={isSelected ? { 
          scale: [1, 1.2, 1],
        } : {}}
        transition={{ 
          duration: 0.4,
          repeat: isSelected ? Infinity : 0,
          repeatDelay: 2
        }}
      >
        <Icon className={iconSizes[size]} />
      </motion.div>
      
      {/* Hover label tooltip */}
      <AnimatePresence>
        {isHovered && showLabel && !isSelected && (
          <motion.span
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] bg-popover/95 backdrop-blur-sm text-popover-foreground px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg border border-border z-50"
          >
            {reaction.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// Quick Reaction Bar - For message context menus and quick access
interface QuickReactionBarProps {
  reactions?: ReactionType[];
  onReact: (emoji: string) => void;
  selectedEmoji?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'live';
  className?: string;
}

export const QuickReactionBar = ({
  reactions = REACTION_TYPES as unknown as ReactionType[],
  onReact,
  selectedEmoji,
  size = 'md',
  variant = 'default',
  className,
}: QuickReactionBarProps) => {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {reactions.slice(0, 6).map((reaction) => (
        <AnimatedEmojiButton
          key={reaction.id}
          reaction={reaction}
          isSelected={selectedEmoji === reaction.emoji}
          onClick={(_, emoji) => onReact(emoji)}
          size={size}
          variant={variant}
          showLabel
        />
      ))}
    </div>
  );
};

// Live Stream/Space Reaction Bar - Floating style for streams
interface LiveReactionBarProps {
  onReact: (reactionType: string) => void;
  className?: string;
}

export const LiveReactionBar = ({
  onReact,
  className,
}: LiveReactionBarProps) => {
  return (
    <div className={cn(
      "flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-2",
      className
    )}>
      {LIVE_REACTIONS.map((reaction) => (
        <AnimatedEmojiButton
          key={reaction.id}
          reaction={reaction as unknown as ReactionType}
          onClick={(id) => onReact(id)}
          size="md"
          variant="live"
        />
      ))}
    </div>
  );
};

export default AnimatedEmojiButton;
