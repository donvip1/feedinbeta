import { useState } from 'react';
import { ArrowLeft, FileText, Loader2, Copy, Sparkles, Zap, Download, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';

const SUMMARY_STYLES = [
  { id: 'concise', name: 'Concise', description: 'Brief key points' },
  { id: 'detailed', name: 'Detailed', description: 'Comprehensive summary' },
  { id: 'bullet', name: 'Bullet Points', description: 'Easy to scan list' },
  { id: 'executive', name: 'Executive', description: 'Business-style brief' },
];

const Summarizer = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [style, setStyle] = useState('concise');

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
    setSummary('');

    try {
      const styleInfo = SUMMARY_STYLES.find(s => s.id === style);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          systemPrompt: `You are an expert text summarizer. Create a ${styleInfo?.name.toLowerCase()} summary.

## Output Format
${style === 'bullet' ? `
Present the summary as well-organized bullet points:
- Use **bold** for key concepts
- Group related points under headers if needed
- Keep each point concise but informative
` : style === 'executive' ? `
Create a professional executive summary:
## Key Findings
Brief overview of main points

## Main Insights
- Important insight 1
- Important insight 2

## Conclusion
Final takeaway
` : style === 'detailed' ? `
Create a comprehensive summary with:
## Overview
Brief introduction to the content

## Key Points
Detailed explanation of main ideas

## Supporting Details
Additional context and information

## Summary
Concluding thoughts
` : `
Create a concise summary that:
- Captures the essential message in 2-3 sentences
- Highlights the most important point
- Uses clear, direct language
`}

Always use proper markdown formatting with headers, bold text, and lists where appropriate.`
        }),
      });

      if (!response.ok) throw new Error('Failed to summarize');

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
                  setSummary(content);
                }
              } catch {}
            }
          }
        }
      }

      toast.success('Text summarized successfully!');
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

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const summaryWordCount = summary.split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">Text Summarizer</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            1
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Info Card */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-none">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">AI-Powered Summarization</p>
                <p className="text-sm text-muted-foreground">
                  Transform long texts into clear, structured summaries in seconds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Text to Summarize</h3>
            </div>

            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Select summary style" />
              </SelectTrigger>
              <SelectContent>
                {SUMMARY_STYLES.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex flex-col">
                      <span>{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your article, document, or any long text here..."
              className="min-h-[200px] resize-none"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {wordCount} words • {text.length} characters
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
          </CardContent>
        </Card>

        {/* Result Section */}
        <AnimatePresence>
          {summary && (
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
                        <Sparkles className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Summary</h3>
                        <span className="text-xs text-muted-foreground">
                          {summaryWordCount} words • {Math.round((1 - summaryWordCount / wordCount) * 100)}% reduction
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setSummary('')}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-background/50 rounded-lg p-4 border border-border/50">
                    <EnhancedMarkdownRenderer content={summary} className="text-sm" />
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

export default Summarizer;
