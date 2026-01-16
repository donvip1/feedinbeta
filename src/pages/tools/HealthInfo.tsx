import React, { useState } from 'react';
import { ArrowLeft, Heart, Search, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

const HealthInfo = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [info, setInfo] = useState<{
    overview: string;
    causes: string[];
    symptoms: string[];
    prevention: string[];
    whenToSeek: string;
  } | null>(null);

  const popularTopics = [
    'Headaches',
    'Sleep disorders',
    'Stress management',
    'Healthy eating',
    'Exercise benefits',
    'Mental health'
  ];

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a health topic');
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Provide general health information about: "${query}"
              
              Format as JSON:
              {
                "overview": "A brief overview of the topic (2-3 sentences)",
                "causes": ["Common cause 1", "Common cause 2", ...],
                "symptoms": ["Symptom 1", "Symptom 2", ...],
                "prevention": ["Prevention tip 1", "Prevention tip 2", ...],
                "whenToSeek": "When to seek medical attention"
              }
              
              IMPORTANT: This is for educational purposes only. Always recommend consulting a healthcare professional.`
            }
          ],
          systemPrompt: 'You are a health education assistant. Provide accurate, general health information for educational purposes. Always emphasize the importance of consulting healthcare professionals. Never diagnose or prescribe treatment.'
        }
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setInfo(parsed);
          toast.success('Information found!');
        }
      }
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
          <div>
            <h1 className="text-xl font-bold">Health Information</h1>
            <p className="text-sm text-muted-foreground">Educational health resources</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Disclaimer */}
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This tool provides general health information for educational purposes only. 
              It is not a substitute for professional medical advice. Always consult a healthcare provider.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Search Health Topics</h3>
            </div>

            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., headaches, nutrition, sleep..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
                  <button
                    key={topic}
                    className="px-3 py-1 text-xs bg-muted rounded-full hover:bg-muted/80"
                    onClick={() => {
                      setQuery(topic);
                      setInfo(null);
                    }}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {info && (
          <>
            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Overview</h3>
                <p className="text-sm text-muted-foreground">{info.overview}</p>
              </div>
            </Card>

            {info.causes.length > 0 && (
              <Card className="p-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">Common Causes</h3>
                  <ul className="space-y-1">
                    {info.causes.map((cause, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}

            {info.symptoms.length > 0 && (
              <Card className="p-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">Common Symptoms</h3>
                  <ul className="space-y-1">
                    {info.symptoms.map((symptom, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{symptom}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}

            {info.prevention.length > 0 && (
              <Card className="p-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">Prevention & Management</h3>
                  <ul className="space-y-1">
                    {info.prevention.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-red-500/10 border-red-500/30">
              <div className="space-y-2">
                <h3 className="font-semibold text-red-600 dark:text-red-400">When to See a Doctor</h3>
                <p className="text-sm">{info.whenToSeek}</p>
              </div>
            </Card>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default HealthInfo;
