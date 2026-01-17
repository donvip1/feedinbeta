import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, Search, Zap, Crown, Star,
  FileText, Image, Video, Pen, Wrench,
  MessageSquare, Sparkles, Wand2, GraduationCap,
  BookOpen, Hash, Lightbulb, FileImage,
  Eraser, Maximize, Palette, Type, Scissors,
  Film, Music, Download, Languages, FileUp,
  Bot, Brain, FileCheck, QrCode
} from 'lucide-react';
import feedinIcon from '@/assets/feedin-icon.png';

interface AITool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  category: 'pdf' | 'image' | 'video' | 'writing' | 'utility' | 'chat' | 'audio' | 'education' | 'health';
  creditCost: number;
  isNew?: boolean;
  isPremium?: boolean;
  isPopular?: boolean;
}

const AIToolsHub = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [credits, setCredits] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 50 });
  const [activeCategory, setActiveCategory] = useState<string>('all');

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

    const { data: creditsData } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (creditsData) setCredits(creditsData.balance);

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single();
    
    if (profile) setIsPremium(profile.is_premium || false);

    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today);
    
    setDailyUsage({ used: count || 0, limit: isPremium ? 500 : 50 });
  };

  const tools: AITool[] = [
    // Chat & Agent
    {
      id: 'ai-agent',
      name: 'FeedIn AI Agent',
      description: 'Your intelligent assistant for everything',
      icon: <Bot className="w-5 h-5" />,
      path: '/ai/agent',
      category: 'chat',
      creditCost: 5,
      isPopular: true,
    },
    {
      id: 'feedai-chat',
      name: 'Quick Chat',
      description: 'Fast AI responses for any question',
      icon: <MessageSquare className="w-5 h-5" />,
      path: '/ai/copilot',
      category: 'chat',
      creditCost: 3,
    },
    
    // Image Tools
    {
      id: 'bg-remover',
      name: 'Background Remover',
      description: 'Remove backgrounds from images instantly',
      icon: <Eraser className="w-5 h-5" />,
      path: '/ai/tools/bg-remover',
      category: 'image',
      creditCost: 10,
      isPopular: true,
      isNew: true,
    },
    {
      id: 'image-upscaler',
      name: 'Image Upscaler',
      description: 'Increase image resolution like Remini',
      icon: <Maximize className="w-5 h-5" />,
      path: '/ai/tools/upscaler',
      category: 'image',
      creditCost: 15,
      isPopular: true,
    },
    {
      id: 'image-gen',
      name: 'AI Image Generator',
      description: 'Create stunning images from text',
      icon: <Image className="w-5 h-5" />,
      path: '/ai/image-gen',
      category: 'image',
      creditCost: 20,
      isPopular: true,
    },
    {
      id: 'image-enhance',
      name: 'Image Enhancer',
      description: 'Improve photo quality with AI',
      icon: <Sparkles className="w-5 h-5" />,
      path: '/ai/enhance',
      category: 'image',
      creditCost: 15,
    },
    {
      id: 'colorizer',
      name: 'Photo Colorizer',
      description: 'Add color to black & white photos',
      icon: <Palette className="w-5 h-5" />,
      path: '/ai/tools/colorizer',
      category: 'image',
      creditCost: 10,
      isNew: true,
    },
    {
      id: 'image-to-text',
      name: 'Image to Text (OCR)',
      description: 'Extract text from images',
      icon: <Type className="w-5 h-5" />,
      path: '/ai/tools/image-to-text',
      category: 'image',
      creditCost: 5,
    },
    {
      id: 'img-compress',
      name: 'Image Compressor',
      description: 'Reduce image file size',
      icon: <FileImage className="w-5 h-5" />,
      path: '/ai/tools/img-compress',
      category: 'image',
      creditCost: 3,
    },
    
    // PDF Tools
    {
      id: 'pdf-to-word',
      name: 'PDF to Word',
      description: 'Convert PDF documents to Word',
      icon: <FileText className="w-5 h-5" />,
      path: '/ai/tools/pdf-to-word',
      category: 'pdf',
      creditCost: 10,
      isPopular: true,
    },
    {
      id: 'word-to-pdf',
      name: 'Word to PDF',
      description: 'Convert Word documents to PDF',
      icon: <FileUp className="w-5 h-5" />,
      path: '/ai/tools/word-to-pdf',
      category: 'pdf',
      creditCost: 5,
    },
    {
      id: 'pdf-merge',
      name: 'Merge PDFs',
      description: 'Combine multiple PDFs into one',
      icon: <FileCheck className="w-5 h-5" />,
      path: '/ai/tools/pdf-merge',
      category: 'pdf',
      creditCost: 5,
    },
    {
      id: 'pdf-split',
      name: 'Split PDF',
      description: 'Split PDF into separate pages',
      icon: <Scissors className="w-5 h-5" />,
      path: '/ai/tools/pdf-split',
      category: 'pdf',
      creditCost: 5,
    },
    {
      id: 'pdf-compress',
      name: 'Compress PDF',
      description: 'Reduce PDF file size',
      icon: <Download className="w-5 h-5" />,
      path: '/ai/tools/pdf-compress',
      category: 'pdf',
      creditCost: 5,
    },
    {
      id: 'jpg-to-pdf',
      name: 'Images to PDF',
      description: 'Convert images to PDF document',
      icon: <FileImage className="w-5 h-5" />,
      path: '/ai/tools/jpg-to-pdf',
      category: 'pdf',
      creditCost: 5,
    },
    {
      id: 'summarizer',
      name: 'Document Summarizer',
      description: 'Summarize long documents with AI',
      icon: <BookOpen className="w-5 h-5" />,
      path: '/ai/tools/summarizer',
      category: 'pdf',
      creditCost: 8,
    },
    
    // Writing Tools
    {
      id: 'essay-writer',
      name: 'Essay Writer',
      description: 'Generate academic essays with AI',
      icon: <Pen className="w-5 h-5" />,
      path: '/ai/tools/essay-writer',
      category: 'writing',
      creditCost: 15,
      isPopular: true,
      isNew: true,
    },
    {
      id: 'grammar-fixer',
      name: 'Grammar Fixer',
      description: 'Fix grammar and spelling errors',
      icon: <FileCheck className="w-5 h-5" />,
      path: '/ai/tools/grammar',
      category: 'writing',
      creditCost: 5,
    },
    {
      id: 'paraphraser',
      name: 'Paraphraser',
      description: 'Reword content to avoid plagiarism',
      icon: <BookOpen className="w-5 h-5" />,
      path: '/ai/tools/paraphrase',
      category: 'writing',
      creditCost: 8,
    },
    {
      id: 'translator',
      name: 'AI Translator',
      description: 'Translate text to any language',
      icon: <Languages className="w-5 h-5" />,
      path: '/ai/tools/translator',
      category: 'writing',
      creditCost: 5,
    },
    {
      id: 'caption-gen',
      name: 'Caption Generator',
      description: 'Create engaging social captions',
      icon: <Hash className="w-5 h-5" />,
      path: '/ai/captions',
      category: 'writing',
      creditCost: 5,
    },
    {
      id: 'content-ideas',
      name: 'Content Ideas',
      description: 'Get AI content suggestions',
      icon: <Lightbulb className="w-5 h-5" />,
      path: '/ai/ideas',
      category: 'writing',
      creditCost: 5,
    },
    {
      id: 'thesis',
      name: 'Thesis Writer',
      description: 'AI-assisted thesis and research',
      icon: <GraduationCap className="w-5 h-5" />,
      path: '/ai/thesis',
      category: 'writing',
      creditCost: 15,
    },
    
    // Video Tools
    {
      id: 'video-trim',
      name: 'Video Trimmer',
      description: 'Cut and trim video clips',
      icon: <Scissors className="w-5 h-5" />,
      path: '/ai/tools/video-trim',
      category: 'video',
      creditCost: 5,
    },
    {
      id: 'video-compress',
      name: 'Video Compressor',
      description: 'Reduce video file size',
      icon: <Film className="w-5 h-5" />,
      path: '/ai/tools/video-compress',
      category: 'video',
      creditCost: 5,
    },
    
    // Audio Tools
    {
      id: 'audio-extract',
      name: 'Video to MP3',
      description: 'Extract audio from videos',
      icon: <Music className="w-5 h-5" />,
      path: '/ai/tools/audio-extract',
      category: 'audio',
      creditCost: 3,
    },
    {
      id: 'text-to-speech',
      name: 'Text to Speech',
      description: 'Convert text to natural speech',
      icon: <Music className="w-5 h-5" />,
      path: '/ai/tools/text-to-speech',
      category: 'audio',
      creditCost: 5,
    },
    {
      id: 'speech-to-text',
      name: 'Speech to Text',
      description: 'Transcribe audio to text',
      icon: <Type className="w-5 h-5" />,
      path: '/ai/tools/speech-to-text',
      category: 'audio',
      creditCost: 5,
    },
    
    // Education & Research Tools
    {
      id: 'math-solver',
      name: 'Math Solver',
      description: 'Solve math problems step by step',
      icon: <Brain className="w-5 h-5" />,
      path: '/ai/tools/math-solver',
      category: 'education',
      creditCost: 5,
    },
    {
      id: 'exam-prep',
      name: 'Exam Prep',
      description: 'Practice questions and study guides',
      icon: <GraduationCap className="w-5 h-5" />,
      path: '/ai/tools/exam-prep',
      category: 'education',
      creditCost: 8,
    },
    {
      id: 'research',
      name: 'Research Assistant',
      description: 'Help with research and citations',
      icon: <BookOpen className="w-5 h-5" />,
      path: '/ai/tools/research',
      category: 'education',
      creditCost: 10,
    },
    
    // Utility Tools
    {
      id: 'qr-gen',
      name: 'QR Code Generator',
      description: 'Create QR codes instantly',
      icon: <QrCode className="w-5 h-5" />,
      path: '/ai/tools/qr-gen',
      category: 'utility',
      creditCost: 2,
    },
    {
      id: 'meme-gen',
      name: 'Meme Generator',
      description: 'Create funny memes easily',
      icon: <Sparkles className="w-5 h-5" />,
      path: '/ai/tools/meme-gen',
      category: 'utility',
      creditCost: 3,
    },
    {
      id: 'logo-maker',
      name: 'Logo Maker',
      description: 'Design simple logos with AI',
      icon: <Wand2 className="w-5 h-5" />,
      path: '/ai/tools/logo-maker',
      category: 'utility',
      creditCost: 10,
    },
    
    // Health Tools
    {
      id: 'health-info',
      name: 'Health Info',
      description: 'Get health information and tips',
      icon: <Brain className="w-5 h-5" />,
      path: '/ai/tools/health-info',
      category: 'health',
      creditCost: 5,
    },
    {
      id: 'symptom-checker',
      name: 'Symptom Checker',
      description: 'Check symptoms and get guidance',
      icon: <FileCheck className="w-5 h-5" />,
      path: '/ai/tools/symptom-checker',
      category: 'health',
      creditCost: 5,
    },
    {
      id: 'nutrition',
      name: 'Nutrition Calculator',
      description: 'Calculate nutrition information',
      icon: <Lightbulb className="w-5 h-5" />,
      path: '/ai/tools/nutrition',
      category: 'health',
      creditCost: 3,
    },
  ];

  const categories = [
    { id: 'all', name: 'All Tools', icon: <Wrench className="w-4 h-4" /> },
    { id: 'chat', name: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'image', name: 'Image', icon: <Image className="w-4 h-4" /> },
    { id: 'pdf', name: 'PDF', icon: <FileText className="w-4 h-4" /> },
    { id: 'writing', name: 'Writing', icon: <Pen className="w-4 h-4" /> },
    { id: 'video', name: 'Video', icon: <Video className="w-4 h-4" /> },
    { id: 'audio', name: 'Audio', icon: <Music className="w-4 h-4" /> },
    { id: 'education', name: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'health', name: 'Health', icon: <Brain className="w-4 h-4" /> },
    { id: 'utility', name: 'Utility', icon: <Wrench className="w-4 h-4" /> },
  ];

  const filteredTools = useMemo(() => {
    let filtered = tools;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(t => t.category === activeCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [activeCategory, searchQuery]);

  const popularTools = tools.filter(t => t.isPopular);

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
              AI Tools
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/wallet/credits')}>
            <Zap className="w-4 h-4 mr-1 text-yellow-500" />
            {credits}
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search AI tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
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

        {/* Popular Tools */}
        {!searchQuery && activeCategory === 'all' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Popular Tools</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {popularTools.slice(0, 4).map((tool) => (
                <Card 
                  key={tool.id}
                  className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
                  onClick={() => navigate(tool.path)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          {tool.icon}
                        </div>
                        {tool.isNew && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
                            New
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-sm">{tool.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 min-w-max pb-1">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className="gap-1.5"
              >
                {cat.icon}
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Tools List */}
        <div className="space-y-2">
          {filteredTools.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No tools found</p>
              </CardContent>
            </Card>
          ) : (
            filteredTools.map((tool) => (
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
                            Pro
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
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default AIToolsHub;
