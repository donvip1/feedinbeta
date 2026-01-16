import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, RefreshCw, Loader2, Copy, Download, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MODES = [
  { id: 'standard', name: 'Standard', description: 'Clear and natural rewrite' },
  { id: 'fluent', name: 'Fluent', description: 'Improve flow and readability' },
  { id: 'formal', name: 'Formal', description: 'Professional and academic tone' },
  { id: 'simple', name: 'Simple', description: 'Easy to understand' },
  { id: 'creative', name: 'Creative', description: 'Unique and engaging' },
  { id: 'expand', name: 'Expand', description: 'Add more detail' },
  { id: 'shorten', name: 'Shorten', description: 'Make it concise' },
];

const Paraphraser = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [mode, setMode] = useState('standard');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleParaphrase = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text to paraphrase',
        variant: 'destructive',
      });
      return;
    }

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
          messages: [
            {
              role: 'system',
              content: `You are a professional paraphrasing assistant. Rewrite the given text in a ${modeInfo?.name.toLowerCase()} style.
              
              Mode: ${modeInfo?.name} - ${modeInfo?.description}
              
              Guidelines:
              - Preserve the original meaning
              - Change sentence structure and word choice
              - Make it sound natural
              ${mode === 'formal' ? '- Use formal vocabulary and avoid contractions' : ''}
              ${mode === 'simple' ? '- Use simple words and short sentences' : ''}
              ${mode === 'creative' ? '- Add engaging language and varied sentence structures' : ''}
              ${mode === 'expand' ? '- Add more detail and explanation' : ''}
              ${mode === 'shorten' ? '- Be concise while keeping key information' : ''}
              
              Respond with ONLY the paraphrased text, no explanations.`,
            },
            {
              role: 'user',
              content: inputText,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to paraphrase');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

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
                  setResult(prev => prev + content);
                }
              } catch {}
            }
          }
        }
      }

      toast({
        title: 'Paraphrasing complete!',
      });
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
              <h1 className="text-lg font-semibold">Paraphraser</h1>
              <p className="text-xs text-muted-foreground">Rewrite text in different styles</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
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
                        <div className="flex flex-col">
                          <span>{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.description}</span>
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
                  {inputText.split(/\s+/).filter(Boolean).length} words
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

          {result && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      {MODES.find(m => m.id === mode)?.name} Paraphrase
                    </p>
                  </div>
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
                <p className="text-xs text-muted-foreground mt-2">
                  {result.split(/\s+/).filter(Boolean).length} words
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Paraphraser;
