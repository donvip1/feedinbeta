import React from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, XCircle, Clock, Target, CheckCircle, 
  RotateCcw, ChevronDown, ChevronUp, BookOpen 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface GradedAnswer {
  selected: string;
  correct: string;
  isCorrect: boolean;
  explanation?: string;
}

interface Results {
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  gradedAnswers: Record<string, GradedAnswer>;
  timeTaken: number;
}

interface Question {
  id: string;
  question_text: string;
  options: Array<{ id: string; text: string }>;
}

interface QuizResultsProps {
  results: Results;
  passPercentage: number;
  questions: Question[];
  onClose?: () => void;
  onRetry?: () => void;
}

export const QuizResults: React.FC<QuizResultsProps> = ({
  results,
  passPercentage,
  questions,
  onClose,
  onRetry,
}) => {
  const [expandedQuestions, setExpandedQuestions] = React.useState<Set<string>>(new Set());

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getOptionText = (question: Question, optionId: string) => {
    return question.options.find(o => o.id === optionId)?.text || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Result Header */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={cn(
          "overflow-hidden",
          results.passed 
            ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30" 
            : "bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30"
        )}>
          <CardContent className="pt-8 pb-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className={cn(
                "w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center",
                results.passed ? "bg-green-500" : "bg-red-500"
              )}
            >
              {results.passed ? (
                <Trophy className="w-12 h-12 text-white" />
              ) : (
                <XCircle className="w-12 h-12 text-white" />
              )}
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold mb-2"
            >
              {results.passed ? 'Congratulations!' : 'Keep Trying!'}
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground"
            >
              {results.passed 
                ? 'You have successfully passed this assessment!' 
                : `You need ${passPercentage}% to pass. Keep learning and try again!`}
            </motion.p>

            {/* Score Display */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6"
            >
              <div className="text-5xl font-bold mb-2">
                {results.scorePercent}%
              </div>
              <Progress 
                value={results.scorePercent} 
                className={cn(
                  "h-3 max-w-xs mx-auto",
                  results.passed ? "bg-green-200" : "bg-red-200"
                )}
              />
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{results.correctAnswers}</div>
            <div className="text-xs text-muted-foreground">Correct</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{results.totalQuestions}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-amber-500" />
            <div className="text-2xl font-bold">{formatTime(results.timeTaken)}</div>
            <div className="text-xs text-muted-foreground">Time</div>
          </CardContent>
        </Card>
      </div>

      {/* Review Answers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Review Your Answers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((question, idx) => {
            const answer = results.gradedAnswers[question.id];
            const isExpanded = expandedQuestions.has(question.id);

            return (
              <Collapsible
                key={question.id}
                open={isExpanded}
                onOpenChange={() => toggleQuestion(question.id)}
              >
                <CollapsibleTrigger asChild>
                  <button className={cn(
                    "w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3",
                    answer?.isCorrect 
                      ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10" 
                      : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      answer?.isCorrect ? "bg-green-500" : "bg-red-500"
                    )}>
                      {answer?.isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <XCircle className="w-5 h-5 text-white" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">
                        {idx + 1}. {question.question_text}
                      </p>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-2 ml-11 p-4 rounded-lg bg-muted/50 space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Your answer:</p>
                      <p className={cn(
                        "font-medium",
                        answer?.isCorrect ? "text-green-600" : "text-red-600"
                      )}>
                        {answer?.selected 
                          ? getOptionText(question, answer.selected)
                          : 'No answer selected'}
                      </p>
                    </div>

                    {!answer?.isCorrect && answer?.correct && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Correct answer:</p>
                        <p className="font-medium text-green-600">
                          {getOptionText(question, answer.correct)}
                        </p>
                      </div>
                    )}

                    {answer?.explanation && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-1">Explanation:</p>
                        <p className="text-sm">{answer.explanation}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {onRetry && !results.passed && (
          <Button variant="outline" onClick={onRetry} className="flex-1 gap-2">
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>
        )}
        <Button onClick={onClose} className="flex-1">
          {results.passed ? 'Continue Learning' : 'Back to Course'}
        </Button>
      </div>
    </div>
  );
};