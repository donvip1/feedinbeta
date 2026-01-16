import { useState } from 'react';
import { ArrowLeft, Heart, Search, Loader2, AlertTriangle, BookOpen, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';

const HealthInfo = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState('');

  const popularTopics = [
    '🤕 Headaches',
    '😴 Sleep disorders',
    '🧘 Stress management',
    '🥗 Healthy eating',
    '🏃 Exercise benefits',
    '🧠 Mental health'
  ];

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a health topic');
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
              content: `You are a health education assistant. Provide accurate, general health information for educational purposes.

## Response Format:

### 📚 Health Topic: [Topic Name]

#### Overview
[2-3 sentence overview of the topic]

---

### 🔍 Common Causes

| Cause | Description |
|-------|-------------|
| Cause 1 | Brief explanation |
| Cause 2 | Brief explanation |
| Cause 3 | Brief explanation |

---

### ⚡ Common Symptoms

- **Symptom 1**: Description
- **Symptom 2**: Description
- **Symptom 3**: Description

---

### ✅ Prevention & Management

1. **Tip 1**: Detailed explanation
2. **Tip 2**: Detailed explanation
3. **Tip 3**: Detailed explanation
4. **Tip 4**: Detailed explanation

---

### 🏥 When to See a Doctor

> ⚠️ Seek medical attention if you experience:
> - Warning sign 1
> - Warning sign 2
> - Warning sign 3

---

### ⚠️ Disclaimer

This information is for educational purposes only. Always consult a healthcare professional for medical advice.

IMPORTANT: Never diagnose or prescribe treatment. Always emphasize consulting healthcare professionals.`,
            },
            {
              role: 'user',
              content: `Provide general health information about: "${query}"`,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Search failed');

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

      toast.success('Information found!');
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to find information. Please try again.');
    } finally {
      setIsSearching(false);
    }
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
              <Heart className="h-5 w-5 text-primary" />
              Health Information
            </h1>
            <p className="text-sm text-muted-foreground">Educational health resources</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  This tool provides general health information for educational purposes only. 
                  It is not a substitute for professional medical advice. Always consult a healthcare provider.
                </p>
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
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Search Health Topics</h3>
              </div>

              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., headaches, nutrition, sleep..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="text-base"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Popular topics:</p>
                <div className="flex flex-wrap gap-2">
                  {popularTopics.map((topic) => (
                    <Button
                      key={topic}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setQuery(topic.slice(2).trim());
                        setResult('');
                      }}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
              </div>
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
                    <Sparkles className="h-5 w-5 text-primary" />
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

export default HealthInfo;
