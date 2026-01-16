import { useState } from 'react';
import { ArrowLeft, Search, Loader2, BookOpen, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

const ResearchAssistant = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [context, setContext] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{
    summary: string;
    keyPoints: string[];
    sources: string[];
    furtherReading: string[];
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a research topic');
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Research topic: "${query}"
              ${context ? `Additional context: ${context}` : ''}
              
              Please provide:
              1. A comprehensive summary of this topic (2-3 paragraphs)
              2. Key points and findings (5-7 bullet points)
              3. Suggested academic/reliable sources to explore
              4. Further reading recommendations
              
              Format your response as JSON:
              {
                "summary": "...",
                "keyPoints": ["point1", "point2", ...],
                "sources": ["source1", "source2", ...],
                "furtherReading": ["topic1", "topic2", ...]
              }`
            }
          ],
          systemPrompt: 'You are an expert research assistant. Provide accurate, well-researched information with academic rigor. Always cite reliable sources and suggest further reading.'
        }
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setResults(parsed);
          toast.success('Research complete!');
        }
      }
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Research failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Research Assistant</h1>
            <p className="text-sm text-muted-foreground">AI-powered research helper</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Research Topic</h3>
            </div>

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Climate change effects on biodiversity"
            />

            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional: Add specific questions or context..."
              className="min-h-[80px]"
            />

            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !query.trim()}
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Start Research
                </>
              )}
            </Button>
          </div>
        </Card>

        {results && (
          <>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Summary</h3>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(results.summary)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {results.summary}
                </p>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Key Points</h3>
                <ul className="space-y-2">
                  {results.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Suggested Sources</h3>
                <ul className="space-y-2">
                  {results.sources.map((source, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-primary">
                      <ExternalLink className="h-3 w-3" />
                      <span>{source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Further Reading</h3>
                <div className="flex flex-wrap gap-2">
                  {results.furtherReading.map((topic, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1 bg-primary/10 rounded-full text-sm cursor-pointer hover:bg-primary/20"
                      onClick={() => {
                        setQuery(topic);
                        setResults(null);
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ResearchAssistant;
