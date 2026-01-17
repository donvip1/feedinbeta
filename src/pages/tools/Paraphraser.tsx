import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, Loader2, Copy, Download, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';

const CREDIT_COST = 8;

const MODES = [
  { id: 'standard', name: 'Standard', description: 'Clear and natural rewrite', emoji: '✍️' },
  { id: 'fluent', name: 'Fluent', description: 'Improve flow and readability', emoji: '💫' },
  { id: 'formal', name: 'Formal', description: 'Professional and academic tone', emoji: '📚' },
  { id: 'simple', name: 'Simple', description: 'Easy to understand', emoji: '🎯' },
  { id: 'creative', name: 'Creative', description: 'Unique and engaging', emoji: '🎨' },
  { id: 'expand', name: 'Expand', description: 'Add more detail', emoji: '📝' },
  { id: 'shorten', name: 'Shorten', description: 'Make it concise', emoji: '⚡' },
];

const Paraphraser = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [mode, setMode] = useState('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { balance, isLoading: isLoadingCredits, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'Paraphraser',
    creditCost: CREDIT_COST,
  });

  const handleParaphrase = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text to paraphrase',
        variant: 'destructive',
      });
      return;
    }

    // Check and deduct credits first
    const hasCredits = await checkAndDeductCredits();
    if (!hasCredits) return;

    setIsProcessing(true);
    setResult('');

    try {
      const modeInfo = MODES.find(m => m.id === mode);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: inputText }],
          systemPrompt: `You are a professional paraphrasing assistant. Rewrite the given text in a ${modeInfo?.name.toLowerCase()} style.

## Mode: ${modeInfo?.name} ${modeInfo?.emoji}
${modeInfo?.description}

## Guidelines
- Preserve the original meaning completely
- Change sentence structure and word choice significantly  
- Make it sound natural and fluent
${mode === 'formal' ? '- Use formal vocabulary and avoid contractions\n- Employ sophisticated sentence structures' : ''}
${mode === 'simple' ? '- Use simple words and short sentences\n- Avoid jargon and complex terms' : ''}
${mode === 'creative' ? '- Add engaging language and varied sentence structures\n- Make it more interesting to read' : ''}
${mode === 'expand' ? '- Add more detail and explanation\n- Elaborate on key points' : ''}
${mode === 'shorten' ? '- Be concise while keeping key information\n- Remove unnecessary words' : ''}

## Output Format
Provide ONLY the paraphrased text. Make the rewrite high-quality and professional.`,
        }),
      });

      if (!response.ok) throw new Error('Failed to paraphrase');

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
                  setResult(content);
                }
              } catch {}
            }
          }
        }
      }

      toast({ title: 'Paraphrasing complete!' });
    } catch (error: any) {
      console.error('Paraphrase error:', error);
      toast({
        title: 'Paraphrasing failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toast({ title: 'Copied to clipboard' });
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paraphrased_text.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputWordCount = inputText.split(/\s+/).filter(Boolean).length;
  const resultWordCount = result.split(/\s+/).filter(Boolean).length;

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="text-lg font-semibold">Paraphraser</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Zap className="w-4 h-4 text-yellow-500" />
              {isLoadingCredits ? (
                <Skeleton className="w-8 h-4" />
              ) : (
                <span className={hasEnoughCredits ? 'text-muted-foreground' : 'text-destructive font-medium'}>
                  {balance}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Info Card */}
          <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">AI Paraphraser</p>
                  <p className="text-sm text-muted-foreground">
                    Rewrite text in different styles while preserving the original meaning.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input Section */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Paraphrasing Mode</label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.emoji}</span>
                          <div className="flex flex-col">
                            <span>{m.name}</span>
                            <span className="text-xs text-muted-foreground">{m.description}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter text to paraphrase..."
                className="min-h-[150px] resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {inputWordCount} words
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInputText('')}
                  disabled={!inputText}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleParaphrase}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Paraphrasing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Paraphrase
              </>
            )}
          </Button>

          {/* Result Section */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{MODES.find(m => m.id === mode)?.name} Paraphrase</p>
                          <span className="text-xs text-muted-foreground">
                            {resultWordCount} words
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={handleCopy}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDownload}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="bg-background/50 rounded-lg p-4 border border-border/50">
                      <EnhancedMarkdownRenderer content={result} className="text-sm" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Paraphraser;
