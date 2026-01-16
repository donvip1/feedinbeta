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
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Lightbulb, 
  TrendingUp, 
  RefreshCw,
  Bookmark,
  Calendar,
  Sparkles,
  Video,
  Camera,
  Layers,
  Clock,
  FileText,
  Zap
} from 'lucide-react';

interface ContentIdea {
  title: string;
  description: string;
  type: 'video' | 'photo' | 'carousel' | 'story' | 'text';
  timing: string;
  hashtags: string[];
  engagementTip: string;
}

const NICHES = [
  { id: 'Technology', icon: '💻', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'Lifestyle', icon: '🌟', gradient: 'from-pink-500 to-rose-500' },
  { id: 'Fitness', icon: '💪', gradient: 'from-green-500 to-emerald-500' },
  { id: 'Food', icon: '🍕', gradient: 'from-orange-500 to-amber-500' },
  { id: 'Travel', icon: '✈️', gradient: 'from-sky-500 to-blue-500' },
  { id: 'Fashion', icon: '👗', gradient: 'from-purple-500 to-violet-500' },
  { id: 'Business', icon: '💼', gradient: 'from-slate-500 to-zinc-500' },
  { id: 'Education', icon: '📚', gradient: 'from-indigo-500 to-blue-500' },
  { id: 'Entertainment', icon: '🎬', gradient: 'from-red-500 to-pink-500' },
  { id: 'Art', icon: '🎨', gradient: 'from-fuchsia-500 to-purple-500' },
];

const TYPE_CONFIG = {
  video: { icon: Video, color: 'from-red-500 to-pink-500', bg: 'bg-red-500/10' },
  photo: { icon: Camera, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10' },
  carousel: { icon: Layers, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-500/10' },
  story: { icon: Clock, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-500/10' },
  text: { icon: FileText, color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/10' },
};

const ContentIdeas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [niche, setNiche] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<Set<number>>(new Set());

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

  const selectedNiche = NICHES.find(n => n.id === niche);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">Content Ideas</span>
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-1.5">
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
          className="space-y-4"
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5" />
            <CardContent className="relative p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Your Content Niche
                </label>
                <Input
                  placeholder="E.g., Tech reviews, Fitness tips..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="bg-background/50"
                />
              </div>

              {/* Quick Niche Selection */}
              <div className="flex flex-wrap gap-2">
                {NICHES.map((n) => (
                  <motion.button
                    key={n.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setNiche(n.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      niche === n.id
                        ? `bg-gradient-to-r ${n.gradient} text-white shadow-lg`
                        : 'bg-muted/50 hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="mr-1">{n.icon}</span>
                    {n.id}
                  </motion.button>
                ))}
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !niche.trim()}
                className={`w-full h-12 font-semibold ${
                  selectedNiche
                    ? `bg-gradient-to-r ${selectedNiche.gradient} hover:opacity-90`
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90'
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating Ideas...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Generate Content Ideas
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Generated Ideas */}
        <AnimatePresence mode="wait">
          {ideas.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Your Content Ideas</h2>
                <Badge variant="secondary" className="ml-auto">
                  {ideas.length} ideas
                </Badge>
              </div>
              
              {ideas.map((idea, index) => {
                const typeConfig = TYPE_CONFIG[idea.type] || TYPE_CONFIG.text;
                const TypeIcon = typeConfig.icon;
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${typeConfig.bg}`}>
                              <TypeIcon className={`w-4 h-4 bg-gradient-to-r ${typeConfig.color} bg-clip-text`} style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text' }} />
                            </div>
                            <Badge className={`bg-gradient-to-r ${typeConfig.color} text-white capitalize`}>
                              {idea.type}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {idea.timing}
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleSave(index)}
                            className="p-2 rounded-full hover:bg-muted transition-colors"
                          >
                            <Bookmark 
                              className={`w-4 h-4 transition-all ${
                                savedIdeas.has(index) 
                                  ? 'fill-primary text-primary' 
                                  : 'text-muted-foreground'
                              }`} 
                            />
                          </motion.button>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-foreground">{idea.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {idea.description}
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3 rounded-lg border border-amber-500/20">
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Engagement Tip
                          </p>
                          <p className="text-sm text-foreground mt-1">
                            {idea.engagementTip}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {idea.hashtags.map((tag, i) => (
                            <Badge 
                              key={i} 
                              variant="outline" 
                              className="text-xs bg-muted/30 hover:bg-muted transition-colors cursor-pointer"
                            >
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        <AnimatePresence>
          {ideas.length === 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Lightbulb className="w-10 h-10 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Content Inspiration</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Select your niche and let AI suggest trending content ideas tailored to your audience
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
};

export default ContentIdeas;
