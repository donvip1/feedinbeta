import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, 
  Zap, 
  MessageSquare, 
  Image, 
  Sparkles, 
  FileText, 
  BookOpen,
  Video,
  GraduationCap,
  Wand2,
  Crown,
  TrendingUp,
  Hash,
  Mic,
  UserCircle,
  Lightbulb
} from 'lucide-react';
import feedinIcon from '@/assets/feedin-icon.png';

interface AITool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  category: 'chat' | 'creative' | 'content' | 'learning';
  isPremium?: boolean;
  isNew?: boolean;
  creditCost?: number;
}

const AIHub = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [credits, setCredits] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 50 });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadUserData();
  }, [user, loading, navigate]);

  const loadUserData = async () => {
    if (!user) return;

    // Load credits
    const { data: creditsData } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (creditsData) {
      setCredits(creditsData.balance);
    }

    // Load premium status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single();
    
    if (profile) {
      setIsPremium(profile.is_premium || false);
    }

    // Calculate daily usage
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today);
    
    setDailyUsage({ used: count || 0, limit: isPremium ? 500 : 50 });
  };

  const aiTools: AITool[] = [
    {
      id: 'feedai',
      name: 'FeedAI Chat',
      description: 'Your intelligent AI assistant for any question',
      icon: <MessageSquare className="w-6 h-6" />,
      path: '/ai/copilot',
      category: 'chat',
      creditCost: 5,
    },
    {
      id: 'image-gen',
      name: 'Image Generator',
      description: 'Create stunning images from text descriptions',
      icon: <Image className="w-6 h-6" />,
      path: '/ai/image-gen',
      category: 'creative',
      creditCost: 20,
    },
    {
      id: 'image-enhance',
      name: 'Image Enhancer',
      description: 'Improve and enhance your photos with AI',
      icon: <Sparkles className="w-6 h-6" />,
      path: '/ai/enhance',
      category: 'creative',
      creditCost: 15,
    },
    {
      id: 'caption-gen',
      name: 'Caption Generator',
      description: 'Create engaging captions for your posts',
      icon: <Hash className="w-6 h-6" />,
      path: '/ai/captions',
      category: 'content',
      isNew: true,
      creditCost: 10,
    },
    {
      id: 'content-ideas',
      name: 'Content Ideas',
      description: 'Get AI-powered content suggestions',
      icon: <Lightbulb className="w-6 h-6" />,
      path: '/ai/ideas',
      category: 'content',
      isNew: true,
      creditCost: 10,
    },
    {
      id: 'thesis',
      name: 'Thesis Writer',
      description: 'AI-assisted academic writing helper',
      icon: <FileText className="w-6 h-6" />,
      path: '/ai/thesis',
      category: 'learning',
      creditCost: 15,
    },
    {
      id: 'project',
      name: 'Project Writer',
      description: 'Generate project proposals and documentation',
      icon: <BookOpen className="w-6 h-6" />,
      path: '/ai/project',
      category: 'learning',
      creditCost: 15,
    },
    {
      id: 'video',
      name: 'Video Planner',
      description: 'Plan your video content with AI assistance',
      icon: <Video className="w-6 h-6" />,
      path: '/ai/video',
      category: 'content',
      creditCost: 10,
    },
    {
      id: 'education',
      name: 'Study Helper',
      description: 'Get answers to educational questions',
      icon: <GraduationCap className="w-6 h-6" />,
      path: '/ai/education',
      category: 'learning',
      creditCost: 10,
    },
    {
      id: 'learn',
      name: 'Learn Tech',
      description: 'Interactive tech learning with AI tutor',
      icon: <BookOpen className="w-6 h-6" />,
      path: '/ai/learn',
      category: 'learning',
      creditCost: 5,
    },
  ];

  const categories = [
    { id: 'chat', name: 'Chat & Assistant', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'creative', name: 'Creative Tools', icon: <Wand2 className="w-5 h-5" /> },
    { id: 'content', name: 'Content Creation', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'learning', name: 'Learning & Education', icon: <GraduationCap className="w-5 h-5" /> },
  ];

  const getToolsByCategory = (category: string) => {
    return aiTools.filter(tool => tool.category === category);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/feed')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={feedinIcon} alt="AI" className="w-8 h-8" />
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              AI Hub
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/wallet/credits')}>
            <Zap className="w-4 h-4 mr-1 text-yellow-500" />
            {credits}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Usage Stats */}
        <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Daily AI Usage</span>
              <span className="text-sm text-muted-foreground">
                {dailyUsage.used}/{dailyUsage.limit} requests
              </span>
            </div>
            <Progress value={(dailyUsage.used / dailyUsage.limit) * 100} className="h-2" />
            {!isPremium && (
              <Button 
                variant="link" 
                className="mt-2 p-0 h-auto text-primary"
                onClick={() => navigate('/wallet/subscription')}
              >
                <Crown className="w-4 h-4 mr-1" />
                Upgrade for 10x more AI requests
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Premium Banner (for non-premium users) */}
        {!isPremium && (
          <Card className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Crown className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Unlock Premium AI</h3>
                  <p className="text-sm text-muted-foreground">
                    Get unlimited AI access, priority processing & exclusive features
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-yellow-500 to-orange-500"
                  onClick={() => navigate('/wallet/subscription')}
                >
                  Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Access - Featured AI */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {aiTools.slice(0, 4).map((tool) => (
              <Card 
                key={tool.id}
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
                onClick={() => navigate(tool.path)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-medium truncate">{tool.name}</h3>
                        {tool.isNew && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Categories */}
        {categories.map((category) => {
          const tools = getToolsByCategory(category.id);
          if (tools.length === 0) return null;
          
          return (
            <div key={category.id} className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {category.icon}
                {category.name}
              </h2>
              <div className="space-y-2">
                {tools.map((tool) => (
                  <Card 
                    key={tool.id}
                    className="cursor-pointer hover:border-primary/50 transition-all"
                    onClick={() => navigate(tool.path)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                          {tool.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{tool.name}</h3>
                            {tool.isNew && (
                              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
                                New
                              </Badge>
                            )}
                            {tool.isPremium && (
                              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-500">
                                <Crown className="w-3 h-3 mr-1" />
                                Premium
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">
                            ~{tool.creditCost} credits
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {/* Credits CTA */}
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <h3 className="font-semibold">Need more credits?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Top up your credits to continue using AI features
            </p>
            <Button onClick={() => navigate('/wallet/credits')}>
              Get Credits
            </Button>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default AIHub;