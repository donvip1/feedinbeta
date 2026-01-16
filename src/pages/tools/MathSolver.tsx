import { useState } from 'react';
import { ArrowLeft, Calculator, Loader2, Copy, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

const MathSolver = () => {
  const navigate = useNavigate();
  const [problem, setProblem] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<{
    answer: string;
    steps: string[];
    explanation: string;
  } | null>(null);

  const exampleProblems = [
    'Solve: 2x + 5 = 15',
    'Find the derivative of f(x) = x³ + 2x² - 5x',
    'Calculate the area of a circle with radius 7',
    'Simplify: (3x² + 2x) / x',
    'Solve the system: x + y = 10, x - y = 4'
  ];

  const handleSolve = async () => {
    if (!problem.trim()) {
      toast.error('Please enter a math problem');
      return;
    }

    setIsSolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Solve this math problem step by step: ${problem}
              
              Provide the solution in this JSON format:
              {
                "answer": "The final answer",
                "steps": ["Step 1: ...", "Step 2: ...", ...],
                "explanation": "A brief explanation of the concept used"
              }
              
              Only return the JSON, no other text.`
            }
          ],
          systemPrompt: 'You are an expert math tutor. Solve problems step by step, showing all work clearly. Explain concepts in simple terms. Always verify your calculations.'
        }
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setSolution(parsed);
          toast.success('Problem solved!');
        }
      }
    } catch (error) {
      console.error('Solving error:', error);
      toast.error('Failed to solve. Please try again.');
    } finally {
      setIsSolving(false);
    }
  };

  const handleCopy = () => {
    if (solution) {
      const text = `Problem: ${problem}\n\nAnswer: ${solution.answer}\n\nSteps:\n${solution.steps.join('\n')}\n\nExplanation: ${solution.explanation}`;
      navigator.clipboard.writeText(text);
      toast.success('Solution copied!');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Math Solver</h1>
            <p className="text-sm text-muted-foreground">Step-by-step solutions</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Math Problem</h3>
            </div>

            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Type your math problem here..."
              className="min-h-[100px] font-mono"
            />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {exampleProblems.map((example, index) => (
                  <button
                    key={index}
                    className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
                    onClick={() => setProblem(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleSolve} 
              disabled={isSolving || !problem.trim()}
              className="w-full"
            >
              {isSolving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Solving...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Solve Problem
                </>
              )}
            </Button>
          </div>
        </Card>

        {solution && (
          <>
            <Card className="p-4 bg-primary/10">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Answer</h3>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-2xl font-bold font-mono">{solution.answer}</p>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Step-by-Step Solution</h3>
                <div className="space-y-2">
                  {solution.steps.map((step, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <p className="text-sm font-mono">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Explanation</h3>
                <p className="text-sm text-muted-foreground">{solution.explanation}</p>
              </div>
            </Card>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default MathSolver;
