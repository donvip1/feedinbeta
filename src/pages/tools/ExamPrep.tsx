import { useState } from 'react';
import { ArrowLeft, GraduationCap, Loader2, BookOpen, CheckCircle, XCircle, Trophy, Target, Brain, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const ExamPrep = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  const popularSubjects = ['Mathematics', 'Physics', 'Biology', 'History', 'Computer Science', 'Literature'];

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setQuestions([]);
    setAnswers([]);
    setShowResults(false);

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate ${questionCount} ${difficulty} difficulty multiple choice questions about "${topic}". ${content ? `Use this content as reference: ${content}` : ''}
              
              Return the response as a JSON array ONLY with this exact format, no other text:
              [
                {
                  "question": "Question text here?",
                  "options": ["Option A", "Option B", "Option C", "Option D"],
                  "correctAnswer": 0,
                  "explanation": "Brief explanation of why this answer is correct"
                }
              ]`
            }
          ],
          systemPrompt: 'You are an expert educational content creator. Generate accurate, well-structured exam questions. ONLY return valid JSON array, no markdown or other text.'
        }),
      });

      if (!response.ok) throw new Error('Failed to generate questions');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                }
              } catch {}
            }
          }
        }
      }

      if (fullContent) {
        const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setQuestions(parsed);
          setAnswers(new Array(parsed.length).fill(-1));
          toast.success('Questions generated successfully!');
        } else {
          throw new Error('Invalid response format');
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    if (showResults) return;
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    if (answers.includes(-1)) {
      toast.error('Please answer all questions');
      return;
    }
    setShowResults(true);
    const correct = answers.filter((a, i) => a === questions[i].correctAnswer).length;
    toast.success(`You got ${correct} out of ${questions.length} correct!`);
  };

  const score = answers.filter((a, i) => a === questions[i]?.correctAnswer).length;
  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Exam Prep
            </h1>
            <p className="text-sm text-muted-foreground">AI-powered practice questions</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            3
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {questions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Generate Practice Questions</h3>
                </div>

                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter topic (e.g., World War II, Python programming)"
                  className="text-base"
                />

                {/* Quick topic selection */}
                <div className="flex flex-wrap gap-2">
                  {popularSubjects.map((subject) => (
                    <Button
                      key={subject}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setTopic(subject)}
                    >
                      {subject}
                    </Button>
                  ))}
                </div>

                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Optional: Paste study material for more relevant questions..."
                  className="min-h-[100px]"
                />

                <div className="grid grid-cols-2 gap-2">
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">🟢 Easy</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="hard">🔴 Hard</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Questions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Questions</SelectItem>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !topic.trim()}
                  className="w-full h-12"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4 mr-2" />
                      Generate Questions
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            <AnimatePresence>
              {showResults && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Card className={`${percentage >= 70 ? 'bg-green-500/10 border-green-500/30' : percentage >= 50 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <CardContent className="p-6 text-center">
                      <Trophy className={`w-12 h-12 mx-auto mb-3 ${percentage >= 70 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
                      <h3 className="text-3xl font-bold">{score}/{questions.length}</h3>
                      <p className="text-lg font-medium">{percentage}%</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {percentage === 100 ? '🎉 Perfect score!' : percentage >= 70 ? '👏 Great job!' : percentage >= 50 ? '📚 Keep practicing!' : '💪 Don\'t give up!'}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {questions.map((q, qIndex) => (
              <motion.div
                key={qIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.1 }}
              >
                <Card className={showResults ? (answers[qIndex] === q.correctAnswer ? 'border-green-500/30' : 'border-red-500/30') : ''}>
                  <CardContent className="p-4 space-y-3">
                    <p className="font-medium flex items-start gap-2">
                      <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">
                        {qIndex + 1}
                      </span>
                      <span>{q.question}</span>
                    </p>
                    <div className="space-y-2 ml-8">
                      {q.options.map((option, oIndex) => {
                        const isSelected = answers[qIndex] === oIndex;
                        const isCorrect = q.correctAnswer === oIndex;
                        let className = 'p-3 rounded-lg border cursor-pointer transition-all ';
                        
                        if (showResults) {
                          if (isCorrect) {
                            className += 'bg-green-500/20 border-green-500';
                          } else if (isSelected && !isCorrect) {
                            className += 'bg-red-500/20 border-red-500';
                          } else {
                            className += 'bg-muted/50 border-border opacity-50';
                          }
                        } else {
                          className += isSelected 
                            ? 'bg-primary/20 border-primary' 
                            : 'bg-muted/50 border-border hover:border-primary/50 hover:bg-primary/5';
                        }

                        return (
                          <div
                            key={oIndex}
                            className={className}
                            onClick={() => handleAnswer(qIndex, oIndex)}
                          >
                            <div className="flex items-center gap-2">
                              {showResults && isCorrect && (
                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                              )}
                              {showResults && isSelected && !isCorrect && (
                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                              )}
                              <span className="text-sm">{option}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {showResults && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="ml-8 p-3 bg-primary/5 rounded-lg border border-primary/20"
                      >
                        <p className="text-sm font-medium text-primary mb-1">💡 Explanation</p>
                        <p className="text-sm text-muted-foreground">{q.explanation}</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <div className="flex gap-2">
              {!showResults ? (
                <Button onClick={handleSubmit} className="flex-1 h-12">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Answers
                </Button>
              ) : (
                <Button onClick={() => {
                  setQuestions([]);
                  setAnswers([]);
                  setShowResults(false);
                }} className="flex-1 h-12">
                  <Target className="h-4 w-4 mr-2" />
                  Try New Questions
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ExamPrep;
