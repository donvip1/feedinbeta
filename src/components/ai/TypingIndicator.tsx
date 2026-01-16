import React from 'react';
import { motion } from 'framer-motion';

export const TypingIndicator = () => {
  return (
    <div className="flex items-center gap-1 py-2 px-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-primary/60 rounded-full"
          animate={{
            y: [0, -6, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">FeedIn AI is thinking...</span>
    </div>
  );
};

export default TypingIndicator;
