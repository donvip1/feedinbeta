import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Flag, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { QuizQuestion } from './QuizQuestion';
import { QuizResults } from './QuizResults';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: Array<{ id: string; text: string; is_correct?: boolean }>;
  points: number;
  display_order: number;
}

interface QuizPlayerProps {
  assessmentId: string;
  onComplete?: () => void;
  onClose?: () => void;
}

export const QuizPlayer: React.FC<QuizPlayerProps> = ({
  assessmentId,
  onComplete,
  onClose,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [passPercentage, setPassPercentage] = useState(70);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);

  // Load assessment
  useEffect(() => {
    const loadAssessment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('learn-assessment', {
          body: { action: 'start', assessmentId },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        setQuestions(data.questions || []);
        setTimeLimit(data.timeLimit);
        setPassPercentage(data.passPercentage || 70);
        if (data.timeLimit) {
          setTimeRemaining(data.timeLimit * 60); // Convert to seconds
        }
        setStartTime(Date.now());
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error loading assessment:', error);
        toast.error(error.message || 'Failed to load assessment');
        onClose?.();
      }
    };

    loadAssessment();
  }, [assessmentId, onClose]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || results) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, results]);

  const handleAnswer = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async (forceSubmit = false) => {
    if (!forceSubmit) {
      setShowSubmitConfirm(true);
      return;
    }

    setIsSubmitting(true);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      const { data, error } = await supabase.functions.invoke('learn-assessment', {
        body: { 
          action: 'submit', 
          assessmentId, 
          answers,
          timeTaken,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setResults(data.results);
    } catch (error: any) {
      console.error('Error submitting assessment:', error);
      toast.error(error.message || 'Failed to submit assessment');
    } finally {
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / questions.length) * 100;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (results) {
    return (
      <QuizResults 
        results={results} 
        passPercentage={passPercentage}
        questions={questions}
        onClose={() => {
          onComplete?.();
          onClose?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            Question {currentIndex + 1} of {questions.length}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {answeredCount} answered
          </Badge>
        </div>
        
        {timeRemaining !== null && (
          <Badge 
            variant={timeRemaining < 60 ? 'destructive' : 'outline'}
            className="gap-1 text-base px-3 py-1"
          >
            <Clock className="w-4 h-4" />
            {formatTime(timeRemaining)}
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <QuizQuestion
            question={currentQuestion}
            selectedAnswer={answers[currentQuestion.id]}
            onSelectAnswer={(optionId) => handleAnswer(currentQuestion.id, optionId)}
            questionNumber={currentIndex + 1}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentIndex === questions.length - 1 ? (
            <Button
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="gap-2"
            >
              <Flag className="w-4 h-4" />
              Submit Quiz
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Question navigator */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Quick Navigation</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => (
              <Button
                key={q.id}
                variant={currentIndex === idx ? 'default' : answers[q.id] ? 'secondary' : 'outline'}
                size="sm"
                className="w-10 h-10"
                onClick={() => setCurrentIndex(idx)}
              >
                {idx + 1}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Submit Quiz?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-amber-500">
                  Warning: You have {questions.length - answeredCount} unanswered question(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Quiz</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};