import { useState } from 'react';
import { ArrowLeft, FileText, Loader2, Copy, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

const Summarizer = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSummarize = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text to summarize');
      return;
    }

    if (text.length < 100) {
      toast.error('Please enter at least 100 characters for better summarization');
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Please summarize the following text concisely, extracting the key points and main ideas. Keep the summary clear and well-organized:\n\n${text}`
            }
          ],
          systemPrompt: 'You are a professional text summarizer. Create clear, concise summaries that capture the essential information. Use bullet points for key points when appropriate.'
        }
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (content) {
        setSummary(content);
        toast.success('Text summarized successfully!');
      } else {
        throw new Error('No summary generated');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('Failed to summarize. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Text Summarizer</h1>
            <p className="text-sm text-muted-foreground">AI-powered text summarization</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Text to Summarize</h3>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your article, document, or any long text here..."
              className="min-h-[200px] resize-none"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {text.length} characters
              </span>
              <Button 
                onClick={handleSummarize} 
                disabled={isProcessing || text.length < 100}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Summarize
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {summary && (
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Summary</h3>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{summary}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Summarizer;
