import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Clock, AlertCircle, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';
import { QuizResults } from '@/components/learn/QuizResults';

interface Question {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  explanation?: string;
  points?: number;
}

const AptitudeTestPlayer = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentQuestion, setCurrentQuestion] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [testStarted, setTestStarted] = React.useState(false);
  const [testCompleted, setTestCompleted] = React.useState(false);
  const [results, setResults] = React.useState<any>(null);

  const { data: test, isLoading } = useQuery({
    queryKey: ['aptitude-test', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aptitude_tests')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: questions } = useQuery({
    queryKey: ['aptitude-questions', test?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aptitude_test_questions')
        .select('*')
        .eq('test_id', test.id)
        .order('display_order');

      if (error) throw error;
      return data.map((q: any) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
      })) as Question[];
    },
    enabled: !!test?.id,
  });

  const { checkAndDeductCredits } = useAIToolCredits({
    toolName: 'aptitude-test',
    creditCost: test?.credit_cost || 10,
  });

  // Timer
  React.useEffect(() => {
    if (testStarted && timeLeft !== null && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev && prev <= 1) {
            handleSubmit();
            return 0;
          }
          return (prev || 0) - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [testStarted, timeLeft]);

  const startTest = async () => {
    const success = await checkAndDeductCredits();
    if (success) {
      setTestStarted(true);
      setTimeLeft((test?.duration_minutes || 20) * 60);
    }
  };

  const handleAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!questions || !test || !user) return;

    let correct = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach((q) => {
      const points = q.points || 1;
      totalPoints += points;
      if (answers[q.id] === q.correct_option_id) {
        correct++;
        earnedPoints += points;
      }
    });

    const scorePercent = Math.round((earnedPoints / totalPoints) * 100);
    const passed = scorePercent >= (test.passing_score || 70);

    // Save results
    try {
      await supabase.from('aptitude_test_results').insert({
        test_id: test.id,
        user_id: user.id,
        answers,
        correct_answers: correct,
        total_questions: questions.length,
        score_percent: scorePercent,
        passed,
        time_taken_seconds: ((test.duration_minutes || 20) * 60) - (timeLeft || 0),
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save results:', error);
    }

    setResults({
      score: scorePercent,
      passed,
      correctAnswers: correct,
      totalQuestions: questions.length,
      timeTaken: ((test.duration_minutes || 20) * 60) - (timeLeft || 0),
    });
    setTestCompleted(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Test Not Found</h1>
          <Button onClick={() => navigate('/ai/learn/aptitude')}>Browse Tests</Button>
        </div>
      </div>
    );
  }

  if (testCompleted && results) {
    return (
      <QuizResults
        score={results.score}
        passed={results.passed}
        correctAnswers={results.correctAnswers}
        totalQuestions={results.totalQuestions}
        timeTaken={results.timeTaken}
        passingScore={test.passing_score || 70}
        onRetry={() => {
          setTestCompleted(false);
          setTestStarted(false);
          setAnswers({});
          setResults(null);
        }}
        onClose={() => navigate('/ai/learn/aptitude')}
      />
    );
  }

  if (!testStarted) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">{test.title}</h1>
          </div>
        </div>

        <div className="p-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/20 via-card to-accent/10 rounded-2xl p-6 border text-center"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center text-4xl">
              {test.icon || '🧠'}
            </div>
            <h2 className="text-2xl font-bold mb-2">{test.title}</h2>
            <p className="text-muted-foreground mb-6">{test.description}</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-card rounded-lg p-3">
                <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold">{test.duration_minutes || 20} min</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
              <div className="bg-card rounded-lg p-3">
                <AlertCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold">{test.total_questions || questions?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </div>
              <div className="bg-card rounded-lg p-3">
                <Check className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold">{test.passing_score || 70}%</p>
                <p className="text-xs text-muted-foreground">Pass Score</p>
              </div>
            </div>

            <Button size="lg" className="w-full" onClick={startTest}>
              Start Test ({test.credit_cost || 10} Credits)
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const question = questions?.[currentQuestion];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with Timer */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {questions?.length || 0}
            </span>
            <Badge variant={timeLeft && timeLeft < 60 ? 'destructive' : 'secondary'} className="gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(timeLeft || 0)}
            </Badge>
          </div>
          <Progress value={((currentQuestion + 1) / (questions?.length || 1)) * 100} />
        </div>
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {question && (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-semibold">{question.question_text}</h2>

              <div className="space-y-3">
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleAnswer(question.id, option.id)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      answers[question.id] === option.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        answers[question.id] === option.id
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}>
                        {answers[question.id] === option.id && (
                          <Check className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                      <span>{option.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          {currentQuestion === (questions?.length || 1) - 1 ? (
            <Button className="flex-1" onClick={handleSubmit}>
              Submit Test
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => setCurrentQuestion((prev) => Math.min((questions?.length || 1) - 1, prev + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AptitudeTestPlayer;
