import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, SpellCheck, Loader2, Copy, Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';

const GrammarFixer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [corrections, setCorrections] = useState<string[]>([]);

  const exampleTexts = [
    "Their going to the store tommorrow to buy grocerys.",
    "The company have been growing steadily, but they doesnt have enough employees.",
    "Me and him went to the park yesterday, it was very beautifull weather."
  ];

  const handleFix = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text to fix',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setResult('');
    setCorrections([]);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a professional grammar and spelling checker. Fix all grammar, spelling, and punctuation errors in the text.

## Response Format (CRITICAL - Follow exactly):

### ✅ Corrected Text

[The fully corrected text with all fixes applied]

---

### 📝 Corrections Made

| Original | Corrected | Type |
|----------|-----------|------|
| error1 | fix1 | Grammar/Spelling/Punctuation |
| error2 | fix2 | Grammar/Spelling/Punctuation |

---

### 💡 Writing Tips

Based on the errors found, here are tips to improve:

1. **Tip 1**: Brief explanation
2. **Tip 2**: Brief explanation

Be thorough but preserve the original meaning and tone. Use markdown formatting for clear presentation.`,
            },
            {
              role: 'user',
              content: inputText,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to process text');

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

      toast({
        title: '✅ Grammar fixed!',
        description: 'Your text has been corrected',
      });
    } catch (error: any) {
      console.error('Grammar fix error:', error);
      toast({
        title: 'Failed to fix grammar',
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
    a.download = 'corrected_text.txt';
    a.click();
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <SpellCheck className="w-5 h-5 text-primary" />
                Grammar Fixer
              </h1>
              <p className="text-xs text-muted-foreground">AI-powered grammar and spelling correction</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Input Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-4">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your text here to fix grammar and spelling errors..."
                  className="min-h-[200px] resize-none text-base"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {inputText.length} characters • {inputText.split(/\s+/).filter(Boolean).length} words
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

                {/* Example texts */}
                {!inputText && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Try an example:</p>
                    <div className="flex flex-wrap gap-2">
                      {exampleTexts.map((text, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs h-auto py-1.5 px-2"
                          onClick={() => setInputText(text)}
                        >
                          Example {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <Button
            className="w-full h-12 text-base font-medium"
            size="lg"
            onClick={handleFix}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing & Fixing...
              </>
            ) : (
              <>
                <SpellCheck className="w-5 h-5 mr-2" />
                Fix Grammar & Spelling
              </>
            )}
          </Button>

          {/* Results */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          Corrected Result
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={handleCopy} className="h-8 w-8 p-0">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDownload} className="h-8 w-8 p-0">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleFix} className="h-8 w-8 p-0">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
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
      </div>
      <BottomNav />
    </>
  );
};

export default GrammarFixer;
