import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: Option[];
  points: number;
}

interface QuizQuestionProps {
  question: Question;
  selectedAnswer?: string;
  onSelectAnswer: (optionId: string) => void;
  questionNumber: number;
  showCorrectAnswer?: boolean;
  correctAnswerId?: string;
}

export const QuizQuestion: React.FC<QuizQuestionProps> = ({
  question,
  selectedAnswer,
  onSelectAnswer,
  questionNumber,
  showCorrectAnswer = false,
  correctAnswerId,
}) => {
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-primary">{questionNumber}</span>
          </div>
          <CardTitle className="text-lg font-medium leading-relaxed flex-1">
            {question.question_text}
          </CardTitle>
        </div>
        {question.points > 1 && (
          <p className="text-sm text-muted-foreground ml-14">
            Worth {question.points} points
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {question.options.map((option, idx) => {
          const isSelected = selectedAnswer === option.id;
          const isCorrect = correctAnswerId === option.id;
          const isWrong = showCorrectAnswer && isSelected && !isCorrect;
          
          return (
            <motion.button
              key={option.id}
              whileHover={{ scale: showCorrectAnswer ? 1 : 1.01 }}
              whileTap={{ scale: showCorrectAnswer ? 1 : 0.99 }}
              onClick={() => !showCorrectAnswer && onSelectAnswer(option.id)}
              disabled={showCorrectAnswer}
              className={cn(
                "w-full p-4 rounded-lg border-2 transition-all duration-200 text-left flex items-start gap-3",
                "hover:border-primary/50 hover:bg-primary/5",
                isSelected && !showCorrectAnswer && "border-primary bg-primary/10",
                showCorrectAnswer && isCorrect && "border-green-500 bg-green-500/10",
                isWrong && "border-red-500 bg-red-500/10",
                !isSelected && !showCorrectAnswer && "border-border bg-card",
              )}
            >
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm border-2 transition-colors",
                  isSelected && !showCorrectAnswer && "border-primary bg-primary text-primary-foreground",
                  showCorrectAnswer && isCorrect && "border-green-500 bg-green-500 text-white",
                  isWrong && "border-red-500 bg-red-500 text-white",
                  !isSelected && !showCorrectAnswer && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {showCorrectAnswer && isCorrect ? (
                  <Check className="w-4 h-4" />
                ) : (
                  optionLetters[idx]
                )}
              </div>
              
              <span className={cn(
                "flex-1 pt-1",
                isSelected && "font-medium",
                showCorrectAnswer && isCorrect && "text-green-700 dark:text-green-400",
                isWrong && "text-red-700 dark:text-red-400",
              )}>
                {option.text}
              </span>
            </motion.button>
          );
        })}
      </CardContent>
    </Card>
  );
};