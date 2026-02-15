import { useState } from 'react';
import { ArrowLeft, Stethoscope, Plus, X, Loader2, AlertTriangle, Heart, ShieldCheck, Activity, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 5;

const SymptomChecker = () => {
  const navigate = useNavigate();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'symptom_checker',
    creditCost: CREDIT_COST,
  });
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [duration, setDuration] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState('');

  const commonSymptoms = ['Headache', 'Fatigue', 'Fever', 'Cough', 'Nausea', 'Dizziness'];

  const addSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms([...symptoms, currentSymptom.trim()]);
      setCurrentSymptom('');
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const handleAnalyze = async () => {
    if (symptoms.length === 0) {
      toast.error('Please add at least one symptom');
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsAnalyzing(true);
    setResult('');
    
    try {
      const { fetchAIAgent } = await import('@/utils/aiAgentFetch');
      const response = await fetchAIAgent({
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a health education assistant. Provide EDUCATIONAL information only - NEVER diagnose.

## Response Format:

### ⚠️ Important Disclaimer

This is for educational purposes ONLY. Always consult a qualified healthcare professional for medical advice.

---

### 🔍 Symptom Analysis

Based on the symptoms provided, here's general educational information:

---

### 📋 Possible Related Conditions

| Condition | Likelihood | Description |
|-----------|------------|-------------|
| Condition 1 | Common/Less Common/Rare | Brief description |
| Condition 2 | Common/Less Common/Rare | Brief description |
| Condition 3 | Common/Less Common/Rare | Brief description |

---

### 💡 General Recommendations

1. **Recommendation 1**: Explanation
2. **Recommendation 2**: Explanation
3. **Recommendation 3**: Explanation

---

### 🚨 Urgency Assessment

**Level**: [Low/Moderate/High/Emergency]

[Explanation of when to seek care]

---

### 🏥 When to See a Doctor

- Warning sign 1
- Warning sign 2
- Warning sign 3

CRITICAL: Always emphasize this is educational only, NOT a diagnosis. Recommend consulting a healthcare professional.`,
            },
            {
              role: 'user',
              content: `Symptoms: ${symptoms.join(', ')}\nDuration: ${duration || 'Not specified'}`,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

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
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  setResult(fullResponse);
                }
              } catch {}
            }
          }
        }
      }

      toast.success('Analysis complete');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <BackButton fallback="/ai/copilot" />
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Symptom Checker
            </h1>
            <p className="text-sm text-muted-foreground">Educational symptom analysis</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            {CREDIT_COST}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Important Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-red-600 dark:text-red-400">Important Disclaimer</p>
                  <p className="text-red-600/80 dark:text-red-400/80">
                    This tool is for educational purposes ONLY. It does NOT provide medical diagnoses. 
                    Always consult a qualified healthcare professional for medical advice.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Enter Your Symptoms</h3>
              </div>

              <div className="flex gap-2">
                <Input
                  value={currentSymptom}
                  onChange={(e) => setCurrentSymptom(e.target.value)}
                  placeholder="e.g., headache, fatigue..."
                  onKeyDown={(e) => e.key === 'Enter' && addSymptom()}
                  className="text-base"
                />
                <Button onClick={addSymptom} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Common symptoms */}
              <div className="flex flex-wrap gap-2">
                {commonSymptoms.map((symptom) => (
                  <Button
                    key={symptom}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (!symptoms.includes(symptom)) {
                        setSymptoms([...symptoms, symptom]);
                      }
                    }}
                    disabled={symptoms.includes(symptom)}
                  >
                    + {symptom}
                  </Button>
                ))}
              </div>

              {symptoms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom) => (
                    <motion.span 
                      key={symptom}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="px-3 py-1 bg-primary/20 rounded-full text-sm flex items-center gap-2"
                    >
                      {symptom}
                      <button onClick={() => removeSymptom(symptom)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </motion.span>
                  ))}
                </div>
              )}

              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="How long have you had these symptoms? (optional)"
              />

              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || symptoms.length === 0}
                className="w-full h-12"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Get Information
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Heart className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Health Information</h3>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <EnhancedMarkdownRenderer content={result} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
};

export default SymptomChecker;
