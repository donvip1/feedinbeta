import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/navigation/BottomNav';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { 
  ArrowLeft, Sparkles, Copy, Download, Loader2, 
  UserCheck, Zap, CheckCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const HumanizeAI = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const CREDIT_COST = 10;

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      toast({ title: 'Please enter text to humanize', variant: 'destructive' });
      return;
    }

    if (!user) {
      toast({ title: 'Please sign in', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setIsProcessing(true);
    setResult('');

    try {
      // Check and deduct credits first
      const { data: deductResult, error: deductError } = await supabase.functions.invoke('credit-deduction', {
        body: { 
          action: 'ai_tool',
          metadata: { tool: 'humanize_ai', credits: CREDIT_COST }
        }
      });

      if (deductError || !deductResult?.success) {
        toast({ 
          title: 'Insufficient credits', 
          description: `You need ${CREDIT_COST} credits for this tool`,
          variant: 'destructive' 
        });
        setIsProcessing(false);
        return;
      }

      const systemPrompt = `You are an expert text humanizer. Your job is to transform AI-generated text into natural, human-sounding content that:

1. Passes AI detection tools (like GPTZero, Turnitin, Originality.ai)
2. Sounds authentic and conversational
3. Maintains the original meaning and information
4. Varies sentence structure naturally
5. Includes minor natural imperfections like:
   - Occasional contractions
   - Varied paragraph lengths
   - Natural transitions
   - Slightly informal phrasing where appropriate
   - Personal touches and opinions when fitting

IMPORTANT: 
- Keep the core message and facts intact
- Make it sound like a real person wrote it
- Avoid robotic patterns and repetitive structures
- Use natural vocabulary variations

Transform the following text to sound completely human-written:`;

      const { fetchAIAgent } = await import('@/utils/aiAgentFetch');
      const response = await fetchAIAgent({
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: inputText }
          ],
          stream: true
        }),
      });

      if (!response.ok) throw new Error('Failed to process text');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let humanizedContent = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  humanizedContent += content;
                  setResult(humanizedContent);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Log usage
      await supabase.from('ai_tool_usage').insert({
        user_id: user.id,
        tool_id: 'humanize_ai',
        tool_category: 'writing',
        credits_used: CREDIT_COST,
        status: 'completed'
      });

      toast({ title: 'Text humanized successfully!' });
    } catch (error: any) {
      console.error('Error humanizing text:', error);
      toast({ 
        title: 'Error processing text', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toast({ title: 'Copied to clipboard!' });
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'humanized-text.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-col min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <BackButton fallback="/ai/copilot" />
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              <span className="font-semibold">Humanize AI</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>{CREDIT_COST}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* Info Card */}
          <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/20 rounded-full">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Make AI Text Sound Human</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transform AI-generated content into natural, authentic text that passes AI detectors. 
                    Perfect for essays, articles, and social posts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <CheckCircle className="w-4 h-4" />, label: 'Pass AI Detectors' },
              { icon: <UserCheck className="w-4 h-4" />, label: 'Natural Tone' },
              { icon: <Sparkles className="w-4 h-4" />, label: 'Keep Meaning' }
            ].map((feature, i) => (
              <div key={i} className="flex flex-col items-center p-2 bg-card rounded-lg border border-border">
                <div className="text-primary mb-1">{feature.icon}</div>
                <span className="text-xs text-center text-muted-foreground">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Input */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Paste AI-Generated Text</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {inputText.length} characters
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your AI-generated text here... (ChatGPT, Claude, etc.)"
                className="min-h-[150px] resize-none"
              />
              <Button 
                className="w-full mt-3" 
                onClick={handleHumanize}
                disabled={isProcessing || !inputText.trim()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Humanizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Humanize Text ({CREDIT_COST} Credits)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Humanized Result
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCopy}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleDownload}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                      <EnhancedMarkdownRenderer content={result} />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-3"
                      onClick={() => {
                        setInputText('');
                        setResult('');
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Humanize Another Text
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tips */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2">💡 Tips for Best Results</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Works best with paragraphs (not single sentences)</li>
                <li>• The longer the text, the more natural variations</li>
                <li>• Review the output and add personal touches</li>
                <li>• Run important texts through AI detectors to verify</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default HumanizeAI;
