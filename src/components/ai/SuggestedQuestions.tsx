import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export const SuggestedQuestions = ({ questions, onSelect }: SuggestedQuestionsProps) => {
  if (!questions.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="w-3 h-3" />
        <span>Suggested questions</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            onClick={() => onSelect(question)}
            className="px-3 py-1.5 text-xs bg-primary/5 hover:bg-primary/10 border border-primary/20 
                       rounded-full text-foreground transition-colors hover:border-primary/40"
          >
            {question}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default SuggestedQuestions;
