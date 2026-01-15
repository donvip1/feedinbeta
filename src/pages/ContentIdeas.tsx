import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, 
  Lightbulb, 
  TrendingUp, 
  RefreshCw,
  Bookmark,
  Calendar,
  Sparkles
} from 'lucide-react';

interface ContentIdea {
  title: string;
  description: string;
  type: 'video' | 'photo' | 'carousel' | 'story' | 'text';
  timing: string;
  hashtags: string[];
  engagementTip: string;
}

const ContentIdeas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [niche, setNiche] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<Set<number>>(new Set());

  const niches = [
    'Technology', 'Lifestyle', 'Fitness', 'Food', 'Travel', 
    'Fashion', 'Business', 'Education', 'Entertainment', 'Art'
  ];

  const handleGenerate = async () => {
    if (!niche.trim() || !user) {
      toast({
        title: 'Select or enter a niche',
        description: 'Tell us what kind of content you create',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-content-ideas', {
        body: {
          niche: niche.trim(),
          count: 5,
        },
      });

      if (error) throw error;

      if (data?.ideas) {
        setIdeas(data.ideas);
        toast({
          title: 'Ideas generated!',
          description: `Got ${data.ideas.length} content ideas for you`,
        });
      }
    } catch (error: any) {
      console.error('Error generating ideas:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSave = (index: number) => {
    const newSaved = new Set(savedIdeas);
    if (newSaved.has(index)) {
      newSaved.delete(index);
    } else {
      newSaved.add(index);
    }
    setSavedIdeas(newSaved);
    toast({
      title: savedIdeas.has(index) ? 'Removed from saved' : 'Idea saved!',
    });
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      video: 'bg-red-500/20 text-red-500',
      photo: 'bg-blue-500/20 text-blue-500',
      carousel: 'bg-purple-500/20 text-purple-500',
      story: 'bg-orange-500/20 text-orange-500',
      text: 'bg-green-500/20 text-green-500',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-500';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold">Content Ideas</span>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Your Content Niche
            </label>
            <Input
              placeholder="E.g., Tech reviews, Fitness tips..."
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>

          {/* Quick Niche Selection */}
          <div className="flex flex-wrap gap-2">
            {niches.map((n) => (
              <Badge
                key={n}
                variant={niche === n ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setNiche(n)}
              >
                {n}
              </Badge>
            ))}
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !niche.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating Ideas...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content Ideas
              </>
            )}
          </Button>
        </div>

        {/* Generated Ideas */}
        {ideas.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Your Content Ideas
            </h2>
            
            {ideas.map((idea, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getTypeColor(idea.type)}>
                        {idea.type}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {idea.timing}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSave(index)}
                    >
                      <Bookmark 
                        className={`w-4 h-4 ${savedIdeas.has(index) ? 'fill-primary text-primary' : ''}`} 
                      />
                    </Button>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold">{idea.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {idea.description}
                    </p>
                  </div>

                  <div className="bg-muted/50 p-2 rounded-lg">
                    <p className="text-xs font-medium text-primary flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Engagement Tip
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {idea.engagementTip}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {idea.hashtags.map((tag, i) => (
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className="text-xs"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {ideas.length === 0 && !isGenerating && (
          <div className="text-center py-12">
            <Lightbulb className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Get Content Inspiration</h3>
            <p className="text-muted-foreground">
              Enter your niche and let AI suggest trending content ideas
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ContentIdeas;