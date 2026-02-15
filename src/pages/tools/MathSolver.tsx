import { useState } from 'react';
import { ArrowLeft, Calculator, Loader2, Copy, Sparkles, Zap, Download, CheckCircle2, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 3;

const MathSolver = () => {
  const navigate = useNavigate();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'math_solver',
    creditCost: CREDIT_COST,
  });
  const [problem, setProblem] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState('');

  const exampleProblems = [
    'Solve: 2x + 5 = 15',
    'Find the derivative of f(x) = x³ + 2x²',
    'Calculate the area of a circle with radius 7',
    'Simplify: (3x² + 2x) / x',
    'Solve the system: x + y = 10, x - y = 4',
    'Integrate: ∫ 2x dx',
  ];

  const handleSolve = async () => {
    if (!problem.trim()) {
      toast.error('Please enter a math problem');
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsSolving(true);
    setSolution('');

    try {
      const { fetchAIAgent } = await import('@/utils/aiAgentFetch');
      const response = await fetchAIAgent({
        body: JSON.stringify({
          messages: [{ role: 'user', content: problem }],
          systemPrompt: `You are an expert math tutor. Solve math problems step by step with clear explanations.

## Response Format

Always structure your response as follows:

### 📊 Problem Analysis
Brief analysis of what type of problem this is and the approach needed.

### ✅ Solution

**Answer:** [Final answer in a box or highlighted]

### 📝 Step-by-Step Process

**Step 1:** [First step with explanation]
$$[Mathematical expression if needed]$$

**Step 2:** [Second step with explanation]
$$[Mathematical expression if needed]$$

[Continue with remaining steps...]

### 💡 Key Concepts
- Concept 1 used in this problem
- Concept 2 used in this problem

### 🔍 Verification
[Quick check that the answer is correct]

---

**Tips:**
- Use LaTeX for mathematical expressions: $inline$ or $$block$$
- Be clear and educational
- Explain WHY each step is taken
- Use proper mathematical notation`
        }),
      });

      if (!response.ok) throw new Error('Failed to solve');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';

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
                  content += delta;
                  setSolution(content);
                }
              } catch {}
            }
          }
        }
      }

      toast.success('Problem solved!');
    } catch (error) {
      console.error('Solving error:', error);
      toast.error('Failed to solve. Please try again.');
    } finally {
      setIsSolving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(solution);
    toast.success('Solution copied!');
  };

  const handleDownload = () => {
    const blob = new Blob([solution], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'math-solution.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <BackButton fallback="/ai/copilot" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">Math Solver</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            3
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Info Card */}
        <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-none">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">AI Math Tutor</p>
                <p className="text-sm text-muted-foreground">
                  Get step-by-step solutions with explanations for any math problem.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Math Problem</h3>
            </div>

            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Type your math problem here... (e.g., Solve for x: 2x + 5 = 15)"
              className="min-h-[100px] font-mono"
            />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {exampleProblems.map((example, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 text-xs bg-muted rounded-full hover:bg-muted/80 transition-colors border border-border/50"
                    onClick={() => setProblem(example)}
                  >
                    {example}
                  </motion.button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleSolve} 
              disabled={isSolving || !problem.trim()}
              className="w-full"
              size="lg"
            >
              {isSolving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Solving...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Solve Problem
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Solution Section */}
        <AnimatePresence>
          {solution && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-green-500/10 rounded-lg">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <h3 className="font-semibold">Solution</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-background/50 rounded-lg p-4 border border-border/50">
                    <EnhancedMarkdownRenderer content={solution} className="text-sm" />
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSolution('');
                  setProblem('');
                }}
              >
                Solve Another Problem
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
};

export default MathSolver;
