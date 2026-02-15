import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/navigation/BottomNav';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { 
  ArrowLeft, Pen, Loader2, Copy, Download, 
  CheckCircle, Zap, FileText, GraduationCap
} from 'lucide-react';

const CREDIT_COST = 15;

const EssayWriter = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'essay_writer',
    creditCost: CREDIT_COST,
  });
  
  const [topic, setTopic] = useState('');
  const [essayType, setEssayType] = useState<string>('argumentative');
  const [wordCount, setWordCount] = useState<string>('500');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [generatedEssay, setGeneratedEssay] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const essayTypes = [
    { value: 'argumentative', label: 'Argumentative Essay' },
    { value: 'expository', label: 'Expository Essay' },
    { value: 'narrative', label: 'Narrative Essay' },
    { value: 'descriptive', label: 'Descriptive Essay' },
    { value: 'persuasive', label: 'Persuasive Essay' },
    { value: 'compare-contrast', label: 'Compare & Contrast' },
    { value: 'cause-effect', label: 'Cause & Effect' },
    { value: 'research', label: 'Research Paper' },
  ];

  const wordCountOptions = [
    { value: '300', label: '~300 words (Short)' },
    { value: '500', label: '~500 words (Medium)' },
    { value: '800', label: '~800 words (Long)' },
    { value: '1000', label: '~1000 words (Extended)' },
    { value: '1500', label: '~1500 words (Detailed)' },
  ];

  const handleGenerate = async () => {
    if (!user || !topic.trim()) {
      toast({ title: 'Please enter a topic', variant: 'destructive' });
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsGenerating(true);
    setProgress(10);
    setGeneratedEssay('');

    try {
      setProgress(30);

      const systemPrompt = `You are an expert academic essay writer. Generate a well-structured, 
original essay that demonstrates critical thinking and proper academic writing conventions.

## Essay Configuration
- **Type:** ${essayTypes.find(t => t.value === essayType)?.label}
- **Target Length:** approximately ${wordCount} words

## Output Format

Structure your essay with proper markdown formatting:

### Title
**[Create an engaging title for the essay]**

### Introduction
- Hook to capture reader attention
- Background context
- Clear **thesis statement** (bolded)

### Body Paragraphs
For each main point:
- **Topic sentence** (bolded)
- Supporting evidence and examples
- Analysis and explanation
- Transition to next point

### Conclusion
- Restate thesis in new words
- Summarize main points
- Closing thought or call to action

## Writing Guidelines
- Use proper transitions between paragraphs
- Support arguments with specific examples
- Maintain academic tone appropriate for ${essayTypes.find(t => t.value === essayType)?.label}
- Ensure logical flow of ideas
- Write original, plagiarism-free content`;

      const userPrompt = `Write an essay on the following topic:

Topic: ${topic}

${additionalInfo ? `Additional requirements/context: ${additionalInfo}` : ''}

Generate a complete, well-structured ${essayTypes.find(t => t.value === essayType)?.label} 
with approximately ${wordCount} words.`;

      // Use streaming for better UX
      const { fetchAIAgent } = await import('@/utils/aiAgentFetch');
      const response = await fetchAIAgent({
        body: JSON.stringify({
          messages: [{ role: 'user', content: userPrompt }],
          systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate essay');
      }

      setProgress(50);

      // Handle streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let essayContent = '';

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
                  essayContent += content;
                  setGeneratedEssay(essayContent);
                  setProgress(Math.min(90, 50 + (essayContent.length / parseInt(wordCount)) * 30));
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      setProgress(100);

      // Log usage
      await supabase.from('ai_tool_usage').insert({
        user_id: user.id,
        tool_id: 'essay-writer',
        tool_category: 'writing',
        credits_used: 15,
        status: 'completed',
        metadata: { essay_type: essayType, word_count: wordCount },
      });

      toast({ title: 'Essay generated successfully!' });
    } catch (error: any) {
      console.error('Error:', error);
      toast({ 
        title: 'Generation failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedEssay);
      toast({ title: 'Essay copied to clipboard!' });
    } catch (error) {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([generatedEssay], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `essay-${topic.slice(0, 30).replace(/\s+/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Essay downloaded!' });
  };

  const actualWordCount = generatedEssay.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Pen className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">Essay Writer</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            ~15
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <GraduationCap className="w-6 h-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">AI Essay Generator</p>
                <p className="text-sm text-muted-foreground">
                  Generate well-structured academic essays on any topic. Perfect for students 
                  needing inspiration or a starting point.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!generatedEssay ? (
          <div className="space-y-4">
            {/* Topic Input */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Essay Topic *</Label>
                  <Textarea
                    id="topic"
                    placeholder="e.g., The impact of social media on modern communication..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Essay Type</Label>
                    <Select value={essayType} onValueChange={setEssayType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {essayTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Word Count</Label>
                    <Select value={wordCount} onValueChange={setWordCount}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {wordCountOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional">Additional Instructions (Optional)</Label>
                  <Textarea
                    id="additional"
                    placeholder="Any specific points to cover, sources to mention, or style requirements..."
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleGenerate} 
              className="w-full"
              size="lg"
              disabled={isGenerating || !topic.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Essay...
                </>
              ) : (
                <>
                  <Pen className="w-5 h-5 mr-2" />
                  Generate Essay
                </>
              )}
            </Button>

            {isGenerating && (
              <Card className="border-primary/50">
                <CardContent className="p-4">
                  <Progress value={progress} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    AI is writing your essay...
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Generated Essay */}
            <Card className="border-green-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium">Generated Essay</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {actualWordCount} words
                  </span>
                </div>
                <ScrollArea className="h-[400px] rounded-lg border p-4 bg-muted/30">
                  <EnhancedMarkdownRenderer content={generatedEssay} className="text-sm" />
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleCopy} className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setGeneratedEssay('');
                setProgress(0);
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate New Essay
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default EssayWriter;
