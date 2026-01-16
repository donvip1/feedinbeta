import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  prompt: string;
  gradient?: string;
}

interface QuickActionChipsProps {
  actions: QuickAction[];
  onSelect: (action: QuickAction) => void;
}

export const QuickActionChips = ({ actions, onSelect }: QuickActionChipsProps) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      {actions.map((action) => (
        <motion.button
          key={action.id}
          variants={item}
          onClick={() => onSelect(action)}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative flex flex-col items-center justify-center gap-2 p-4 
                     bg-card border border-border/50 rounded-xl shadow-sm
                     hover:border-primary/30 hover:shadow-md hover:shadow-primary/5
                     transition-all duration-200 overflow-hidden"
        >
          {/* Gradient background on hover */}
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                          bg-gradient-to-br ${action.gradient || 'from-primary/5 to-accent/5'}`} 
          />
          
          {/* Icon */}
          <div className="relative z-10 p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/15 
                          transition-colors duration-200">
            <action.icon className="w-5 h-5 text-primary" />
          </div>
          
          {/* Label */}
          <span className="relative z-10 text-xs font-medium text-center line-clamp-2">
            {action.label}
          </span>
        </motion.button>
      ))}
    </motion.div>
  );
};

export default QuickActionChips;
