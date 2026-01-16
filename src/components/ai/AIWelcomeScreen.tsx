import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, Brain, Image, Code, FileText, Heart, GraduationCap, Lightbulb } from 'lucide-react';
import { QuickActionChips, QuickAction } from './QuickActionChips';
import feedinIcon from '@/assets/feedin-icon.png';

interface AIWelcomeScreenProps {
  onQuickAction: (action: QuickAction) => void;
  userName?: string;
}

const defaultQuickActions: QuickAction[] = [
  { 
    id: 'thesis', 
    label: 'Help with Thesis', 
    icon: GraduationCap, 
    prompt: 'I need help writing my thesis. Can you guide me through the process step by step?',
    gradient: 'from-blue-500/10 to-cyan-500/10'
  },
  { 
    id: 'health', 
    label: 'Health Question', 
    icon: Heart, 
    prompt: 'I have a health-related question I\'d like to ask.',
    gradient: 'from-pink-500/10 to-rose-500/10'
  },
  { 
    id: 'code', 
    label: 'Coding Help', 
    icon: Code, 
    prompt: 'I need help with coding. Let me explain my problem.',
    gradient: 'from-green-500/10 to-emerald-500/10'
  },
  { 
    id: 'ideas', 
    label: 'Content Ideas', 
    icon: Lightbulb, 
    prompt: 'Give me some creative viral content ideas for social media.',
    gradient: 'from-yellow-500/10 to-orange-500/10'
  },
  { 
    id: 'write', 
    label: 'Write for Me', 
    icon: FileText, 
    prompt: 'Help me write a professional document. Here are the details:',
    gradient: 'from-purple-500/10 to-violet-500/10'
  },
  { 
    id: 'image', 
    label: 'Create Image', 
    icon: Image, 
    prompt: 'Help me create an image. I want to generate:',
    gradient: 'from-indigo-500/10 to-blue-500/10'
  },
];

const features = [
  { icon: Brain, label: 'Advanced AI', color: 'text-blue-500' },
  { icon: Zap, label: 'Instant Responses', color: 'text-yellow-500' },
  { icon: Shield, label: 'Private & Secure', color: 'text-green-500' },
];

export const AIWelcomeScreen = ({ onQuickAction, userName }: AIWelcomeScreenProps) => {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      {/* Animated Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ 
          type: 'spring', 
          stiffness: 200, 
          damping: 15,
          duration: 0.8 
        }}
        className="relative mb-6"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
        
        {/* Logo container */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent p-[3px] shadow-lg shadow-primary/30">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
            <img src={feedinIcon} alt="FeedIn AI" className="w-16 h-16 object-contain" />
          </div>
        </div>
        
        {/* Sparkle decorations */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-2 -right-2"
        >
          <Sparkles className="w-6 h-6 text-yellow-500" />
        </motion.div>
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-6"
      >
        <h2 className="text-2xl font-bold mb-2">
          {greeting()}{userName ? `, ${userName}` : ''}! 👋
        </h2>
        <p className="text-muted-foreground max-w-md">
          I'm FeedIn AI, your intelligent assistant. I can help with academics, coding, 
          health questions, content creation, and so much more.
        </p>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-6 mb-8"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <feature.icon className={`w-4 h-4 ${feature.color}`} />
            <span>{feature.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-lg"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">
          What can I help you with today?
        </h3>
        <QuickActionChips actions={defaultQuickActions} onSelect={onQuickAction} />
      </motion.div>
    </div>
  );
};

export default AIWelcomeScreen;
