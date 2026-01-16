import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, SpellCheck, Loader2, Copy, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const GrammarFixer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [corrections, setCorrections] = useState<string[]>([]);

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
              
              Format your response as follows:
              CORRECTED TEXT:
              [The corrected text here]
              
              CORRECTIONS MADE:
              - [List each correction made, one per line]
              
              Be thorough but preserve the original meaning and tone.`,
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
                  
                  // Parse the response to extract corrected text
                  const correctedMatch = fullResponse.match(/CORRECTED TEXT:\s*([\s\S]*?)(?=CORRECTIONS MADE:|$)/i);
                  if (correctedMatch) {
                    setResult(correctedMatch[1].trim());
                  }
                  
                  // Parse corrections
                  const correctionsMatch = fullResponse.match(/CORRECTIONS MADE:\s*([\s\S]*)/i);
                  if (correctionsMatch) {
                    const correctionsList = correctionsMatch[1]
                      .split('\n')
                      .filter(line => line.trim().startsWith('-'))
                      .map(line => line.trim().slice(1).trim());
                    setCorrections(correctionsList);
                  }
                }
              } catch {}
            }
          }
        }
      }

      toast({
        title: 'Grammar fixed!',
        description: `Made ${corrections.length || 'several'} corrections`,
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
            <div>
              <h1 className="text-lg font-semibold">Grammar Fixer</h1>
              <p className="text-xs text-muted-foreground">Fix grammar and spelling errors</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-4">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your text here to fix grammar and spelling errors..."
                className="min-h-[200px] resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">
                  {inputText.length} characters
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
            onClick={handleFix}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Fixing grammar...
              </>
            ) : (
              <>
                <SpellCheck className="w-5 h-5 mr-2" />
                Fix Grammar
              </>
            )}
          </Button>

          {result && (
            <>
              <Card className="border-green-500/50 bg-green-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      ✓ Corrected Text
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={handleCopy}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleDownload}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{result}</p>
                </CardContent>
              </Card>

              {corrections.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-3">Corrections Made ({corrections.length})</p>
                    <ul className="space-y-1">
                      {corrections.map((correction, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <RefreshCw className="w-3 h-3 mt-1 flex-shrink-0" />
                          {correction}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default GrammarFixer;
