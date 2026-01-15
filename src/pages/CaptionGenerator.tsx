import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, 
  Sparkles, 
  Copy, 
  Check, 
  Hash,
  RefreshCw,
  Wand2
} from 'lucide-react';

interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  style: string;
}

const CaptionGenerator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<'professional' | 'casual' | 'funny' | 'inspiring'>('casual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [captions, setCaptions] = useState<GeneratedCaption[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const styles = [
    { id: 'professional', label: 'Professional', emoji: '💼' },
    { id: 'casual', label: 'Casual', emoji: '😊' },
    { id: 'funny', label: 'Funny', emoji: '😂' },
    { id: 'inspiring', label: 'Inspiring', emoji: '✨' },
  ];

  const handleGenerate = async () => {
    if (!description.trim() || !user) {
      toast({
        title: 'Please describe your post',
        description: 'Enter what your post is about to generate captions',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-caption-generator', {
        body: {
          description: description.trim(),
          style,
          count: 3,
        },
      });

      if (error) throw error;

      if (data?.captions) {
        setCaptions(data.captions);
        toast({
          title: 'Captions generated!',
          description: `Created ${data.captions.length} caption options`,
        });
      }
    } catch (error: any) {
      console.error('Error generating captions:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCaption = async (caption: GeneratedCaption, index: number) => {
    const fullText = `${caption.caption}\n\n${caption.hashtags.map(h => `#${h}`).join(' ')}`;
    await navigator.clipboard.writeText(fullText);
    setCopiedIndex(index);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopiedIndex(null), 2000);
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
            <Hash className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold">Caption Generator</span>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Describe your post
            </label>
            <Textarea
              placeholder="E.g., A sunset photo at the beach with friends celebrating..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Style Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Caption Style
            </label>
            <div className="flex flex-wrap gap-2">
              {styles.map((s) => (
                <Button
                  key={s.id}
                  variant={style === s.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStyle(s.id as any)}
                  className="flex items-center gap-1"
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !description.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Captions
              </>
            )}
          </Button>
        </div>

        {/* Generated Captions */}
        {captions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Generated Captions
            </h2>
            
            {captions.map((caption, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {caption.style}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyCaption(caption, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap">{caption.caption}</p>
                  
                  <div className="flex flex-wrap gap-1">
                    {caption.hashtags.map((tag, i) => (
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className="text-xs text-primary"
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
      </div>

      <BottomNav />
    </div>
  );
};

export default CaptionGenerator;