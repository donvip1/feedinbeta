import { useState } from 'react';
import { ArrowLeft, GraduationCap, Loader2, BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Generate ${questionCount} ${difficulty} difficulty multiple choice questions about "${topic}". ${content ? `Use this content as reference: ${content}` : ''}
              
              Return the response as a JSON array with this exact format:
              [
                {
                  "question": "Question text here?",
                  "options": ["Option A", "Option B", "Option C", "Option D"],
                  "correctAnswer": 0,
                  "explanation": "Brief explanation of why this answer is correct"
                }
              ]
              
              Only return the JSON array, no other text.`
            }
          ],
          systemPrompt: 'You are an expert educational content creator. Generate accurate, well-structured exam questions. Always return valid JSON.'
        }
      });

      if (error) throw error;

      const content_response = data?.choices?.[0]?.message?.content || data?.content;
      if (content_response) {
        // Parse JSON from response
        const jsonMatch = content_response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setQuestions(parsed);
          setAnswers(new Array(parsed.length).fill(-1));
          toast.success('Questions generated successfully!');
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Exam Prep</h1>
            <p className="text-sm text-muted-foreground">AI-powered practice questions</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {questions.length === 0 ? (
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Generate Practice Questions</h3>
              </div>

              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter topic (e.g., World War II, Python programming)"
              />

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
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
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
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Questions
                  </>
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {showResults && (
              <Card className="p-4 bg-primary/10">
                <div className="text-center">
                  <h3 className="text-2xl font-bold">{score}/{questions.length}</h3>
                  <p className="text-sm text-muted-foreground">
                    {score === questions.length ? 'Perfect!' : score >= questions.length / 2 ? 'Good job!' : 'Keep practicing!'}
                  </p>
                </div>
              </Card>
            )}

            {questions.map((q, qIndex) => (
              <Card key={qIndex} className="p-4">
                <div className="space-y-3">
                  <p className="font-medium">
                    {qIndex + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((option, oIndex) => {
                      const isSelected = answers[qIndex] === oIndex;
                      const isCorrect = q.correctAnswer === oIndex;
                      let className = 'p-3 rounded-lg border cursor-pointer transition-colors ';
                      
                      if (showResults) {
                        if (isCorrect) {
                          className += 'bg-green-500/20 border-green-500';
                        } else if (isSelected && !isCorrect) {
                          className += 'bg-red-500/20 border-red-500';
                        } else {
                          className += 'bg-muted/50 border-border';
                        }
                      } else {
                        className += isSelected 
                          ? 'bg-primary/20 border-primary' 
                          : 'bg-muted/50 border-border hover:border-primary/50';
                      }

                      return (
                        <div
                          key={oIndex}
                          className={className}
                          onClick={() => handleAnswer(qIndex, oIndex)}
                        >
                          <div className="flex items-center gap-2">
                            {showResults && isCorrect && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {showResults && isSelected && !isCorrect && (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">{option}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {showResults && (
                    <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                      {q.explanation}
                    </p>
                  )}
                </div>
              </Card>
            ))}

            <div className="flex gap-2">
              {!showResults ? (
                <Button onClick={handleSubmit} className="flex-1">
                  Submit Answers
                </Button>
              ) : (
                <Button onClick={() => {
                  setQuestions([]);
                  setAnswers([]);
                  setShowResults(false);
                }} className="flex-1">
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
