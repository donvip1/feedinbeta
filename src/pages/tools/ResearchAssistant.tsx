import { useState } from 'react';
import { ArrowLeft, Search, Loader2, BookOpen, Copy, ExternalLink, Sparkles, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';

const ResearchAssistant = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [context, setContext] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState('');

  const popularTopics = [
    'Climate Change',
    'Artificial Intelligence',
    'Renewable Energy',
    'Mental Health',
    'Blockchain Technology',
    'Gene Therapy'
  ];

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a research topic');
      return;
    }

    setIsSearching(true);
    setResult('');
    
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
              content: `You are an expert research assistant with academic rigor. Provide comprehensive, well-researched information.

## Response Format (CRITICAL - Follow exactly):

### 📚 Research Summary: [Topic]

[2-3 paragraph comprehensive overview with key insights]

---

### 🔑 Key Findings

1. **Finding 1**: Detailed explanation
2. **Finding 2**: Detailed explanation
3. **Finding 3**: Detailed explanation
4. **Finding 4**: Detailed explanation
5. **Finding 5**: Detailed explanation

---

### 📊 Current State of Research

| Aspect | Status | Key Developments |
|--------|--------|------------------|
| Area 1 | Status | Recent developments |
| Area 2 | Status | Recent developments |

---

### 📖 Recommended Sources

1. **Academic Source 1** - Description of relevance
2. **Academic Source 2** - Description of relevance
3. **Research Paper/Book** - Description of relevance

---

### 🔮 Further Research Directions

- **Direction 1**: Why it's important
- **Direction 2**: Why it's important
- **Direction 3**: Why it's important

---

### ⚠️ Research Considerations

Important caveats, limitations, or areas of ongoing debate.`,
            },
            {
              role: 'user',
              content: `Research topic: "${query}"${context ? `\n\nAdditional context: ${context}` : ''}`,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Research failed');

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

      toast.success('Research complete!');
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Research failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Research Assistant
            </h1>
            <p className="text-sm text-muted-foreground">AI-powered academic research helper</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Enter Research Topic</h3>
              </div>

              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Climate change effects on biodiversity"
                className="text-base"
              />

              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Optional: Add specific questions or context..."
                className="min-h-[80px]"
              />

              {/* Popular topics */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Popular topics:</p>
                <div className="flex flex-wrap gap-2">
                  {popularTopics.map((topic) => (
                    <Button
                      key={topic}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setQuery(topic)}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !query.trim()}
                className="w-full h-12"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Research
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
              transition={{ duration: 0.3 }}
            >
              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Research Results</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
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

export default ResearchAssistant;
