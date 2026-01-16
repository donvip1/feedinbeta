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
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Sparkles, 
  Copy, 
  Check, 
  Hash,
  RefreshCw,
  Wand2,
  MessageSquare,
  Briefcase,
  Smile,
  Laugh,
  Star
} from 'lucide-react';

interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  style: string;
}

const STYLES = [
  { id: 'professional', label: 'Professional', emoji: '💼', icon: Briefcase, gradient: 'from-slate-500 to-zinc-600' },
  { id: 'casual', label: 'Casual', emoji: '😊', icon: Smile, gradient: 'from-blue-500 to-cyan-500' },
  { id: 'funny', label: 'Funny', emoji: '😂', icon: Laugh, gradient: 'from-amber-500 to-orange-500' },
  { id: 'inspiring', label: 'Inspiring', emoji: '✨', icon: Star, gradient: 'from-purple-500 to-pink-500' },
];

const CaptionGenerator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<'professional' | 'casual' | 'funny' | 'inspiring'>('casual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [captions, setCaptions] = useState<GeneratedCaption[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const selectedStyle = STYLES.find(s => s.id === style);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Hash className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">Caption Generator</span>
            <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px] px-1.5">
              AI
            </Badge>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-600/5" />
            <CardContent className="relative p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-500" />
                  Describe your post
                </label>
                <Textarea
                  placeholder="E.g., A sunset photo at the beach with friends celebrating..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="resize-none bg-background/50"
                />
              </div>

              {/* Style Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Caption Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <motion.button
                        key={s.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setStyle(s.id as any)}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          style === s.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border/50 hover:border-primary/30 bg-card/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{s.label}</div>
                            <div className="text-xs text-muted-foreground">{s.emoji}</div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !description.trim()}
                className={`w-full h-12 font-semibold bg-gradient-to-r ${selectedStyle?.gradient || 'from-violet-500 to-purple-600'} hover:opacity-90`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate Captions
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Generated Captions */}
        <AnimatePresence mode="wait">
          {captions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                <h2 className="text-lg font-semibold">Generated Captions</h2>
                <Badge variant="secondary" className="ml-auto">
                  {captions.length} options
                </Badge>
              </div>
              
              {captions.map((caption, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden border-border/50 hover:border-violet-500/30 transition-colors group">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge 
                          className={`bg-gradient-to-r ${
                            STYLES.find(s => s.id === caption.style)?.gradient || 'from-violet-500 to-purple-600'
                          } text-white capitalize`}
                        >
                          {caption.style}
                        </Badge>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => copyCaption(caption, index)}
                          className="p-2 rounded-full hover:bg-muted transition-colors"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          )}
                        </motion.button>
                      </div>
                      
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{caption.caption}</p>
                      
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                        {caption.hashtags.map((tag, i) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className="text-xs text-violet-500 border-violet-500/30 hover:bg-violet-500/10 transition-colors cursor-pointer"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        <AnimatePresence>
          {captions.length === 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
                <Hash className="w-10 h-10 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Perfect Captions</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Describe your post and let AI generate engaging captions with trending hashtags
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
};

export default CaptionGenerator;
