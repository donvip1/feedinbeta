import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ChatInput } from '@/components/ai/ChatInput';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { TypingIndicator } from '@/components/ai/TypingIndicator';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Send, Loader2, Trash2, Bot, MessageSquare, Image, Wand2, 
  FileText, PenTool, Video, Settings, ChevronDown, ChevronRight, Sparkles,
  Eraser, ZoomIn, Palette, ScanText, FileType, Scissors, Archive, 
  Languages, Type, CheckCircle, QrCode, Music, Lightbulb, GraduationCap,
  BookOpen, Heart, FlaskConical, Camera, Download, Coins, ArrowRight,
  Brain, Edit3, FileQuestion, Calculator, Globe, Mic, Volume2, Headphones,
  Film, Clapperboard, ImagePlus, Brush, Layers, Grid3X3
} from 'lucide-react';
import feedinIcon from '@/assets/feedin-icon.png';
import { usePageRefresh } from '@/context/RefreshContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  credits: number;
  isNew?: boolean;
  isPopular?: boolean;
}

interface ToolCategory {
  name: string;
  icon: React.ReactNode;
  tools: ToolItem[];
}

import { UserCheck } from 'lucide-react';

const toolCategories: ToolCategory[] = [
  {
    name: 'Chat & AI Assistant',
    icon: <Bot className="w-5 h-5" />,
    tools: [
      { name: 'AI Agent', description: 'Advanced AI with memory & context', icon: <Brain className="w-5 h-5" />, route: '/ai/agent', credits: 5, isPopular: true },
      { name: 'Quick Chat', description: 'Fast answers to any question', icon: <MessageSquare className="w-5 h-5" />, route: '/ai/copilot', credits: 0 },
      { name: 'Content Ideas', description: 'Generate viral content ideas', icon: <Lightbulb className="w-5 h-5" />, route: '/ai/ideas', credits: 5 },
      { name: 'Caption Generator', description: 'Create engaging captions', icon: <Edit3 className="w-5 h-5" />, route: '/ai/captions', credits: 5 },
    ]
  },
  {
    name: 'Image Tools',
    icon: <Image className="w-5 h-5" />,
    tools: [
      { name: 'Image Generator', description: 'Create images from text', icon: <Wand2 className="w-5 h-5" />, route: '/ai/image-gen', credits: 20, isPopular: true },
      { name: 'Image Enhancer', description: 'Upscale & improve quality', icon: <ZoomIn className="w-5 h-5" />, route: '/ai/enhance', credits: 15, isNew: true },
      { name: 'Background Remover', description: 'Remove image backgrounds', icon: <Eraser className="w-5 h-5" />, route: '/ai/tools/bg-remover', credits: 10, isNew: true },
      { name: 'Image Upscaler', description: 'Increase resolution 4x', icon: <ZoomIn className="w-5 h-5" />, route: '/ai/tools/upscaler', credits: 15, isNew: true },
      { name: 'Image Compressor', description: 'Reduce file size', icon: <Archive className="w-5 h-5" />, route: '/ai/tools/img-compress', credits: 5 },
      { name: 'Image to Text (OCR)', description: 'Extract text from images', icon: <ScanText className="w-5 h-5" />, route: '/ai/tools/image-to-text', credits: 5, isNew: true },
      { name: 'Image Colorizer', description: 'Colorize B&W photos', icon: <Palette className="w-5 h-5" />, route: '/ai/tools/colorizer', credits: 10 },
    ]
  },
  {
    name: 'PDF & Document Tools',
    icon: <FileText className="w-5 h-5" />,
    tools: [
      { name: 'PDF Merge', description: 'Combine multiple PDFs', icon: <Layers className="w-5 h-5" />, route: '/ai/tools/pdf-merge', credits: 5, isNew: true },
      { name: 'PDF Split', description: 'Split PDF into pages', icon: <Scissors className="w-5 h-5" />, route: '/ai/tools/pdf-split', credits: 5 },
      { name: 'PDF Compress', description: 'Reduce PDF file size', icon: <Archive className="w-5 h-5" />, route: '/ai/tools/pdf-compress', credits: 5, isNew: true },
      { name: 'PDF to Word', description: 'Convert PDF to DOCX', icon: <FileType className="w-5 h-5" />, route: '/ai/tools/pdf-to-word', credits: 10 },
      { name: 'Word to PDF', description: 'Convert DOCX to PDF', icon: <FileText className="w-5 h-5" />, route: '/ai/tools/word-to-pdf', credits: 5 },
      { name: 'Images to PDF', description: 'Convert images to PDF', icon: <Layers className="w-5 h-5" />, route: '/ai/tools/jpg-to-pdf', credits: 5 },
      { name: 'Summarizer', description: 'Summarize long texts', icon: <Type className="w-5 h-5" />, route: '/ai/tools/summarizer', credits: 8 },
    ]
  },
  {
    name: 'Writing & Text Tools',
    icon: <PenTool className="w-5 h-5" />,
    tools: [
      { name: 'Humanize AI', description: 'Make AI text sound human & pass detectors', icon: <UserCheck className="w-5 h-5" />, route: '/ai/tools/humanize', credits: 10, isNew: true, isPopular: true },
      { name: 'Essay Writer', description: 'Generate academic essays', icon: <BookOpen className="w-5 h-5" />, route: '/ai/tools/essay-writer', credits: 15, isPopular: true },
      { name: 'Thesis Writer', description: 'Write thesis & dissertations', icon: <GraduationCap className="w-5 h-5" />, route: '/ai/thesis', credits: 20, isNew: true },
      { name: 'Project Writer', description: 'Complete project reports', icon: <FileText className="w-5 h-5" />, route: '/ai/project', credits: 15 },
      { name: 'Grammar Fixer', description: 'Fix grammar & spelling', icon: <CheckCircle className="w-5 h-5" />, route: '/ai/tools/grammar', credits: 5, isNew: true },
      { name: 'Paraphraser', description: 'Rewrite text uniquely', icon: <Edit3 className="w-5 h-5" />, route: '/ai/tools/paraphrase', credits: 8, isNew: true },
      { name: 'Translator', description: 'Translate to 100+ languages', icon: <Languages className="w-5 h-5" />, route: '/ai/tools/translator', credits: 5, isNew: true },
    ]
  },
  {
    name: 'Video & Audio Tools',
    icon: <Video className="w-5 h-5" />,
    tools: [
      { name: 'Video Creator', description: 'AI video generation', icon: <Clapperboard className="w-5 h-5" />, route: '/ai/video', credits: 25, isPopular: true },
      { name: 'Video Trimmer', description: 'Cut & trim videos', icon: <Scissors className="w-5 h-5" />, route: '/ai/tools/video-trim', credits: 5, isNew: true },
      { name: 'Video Compressor', description: 'Reduce video size', icon: <Archive className="w-5 h-5" />, route: '/ai/tools/video-compress', credits: 5 },
      { name: 'Audio Extractor', description: 'Extract audio from video', icon: <Volume2 className="w-5 h-5" />, route: '/ai/tools/audio-extract', credits: 5 },
      { name: 'Text to Speech', description: 'Convert text to audio', icon: <Headphones className="w-5 h-5" />, route: '/ai/tools/text-to-speech', credits: 8 },
      { name: 'Speech to Text', description: 'Transcribe audio to text', icon: <Mic className="w-5 h-5" />, route: '/ai/tools/speech-to-text', credits: 8 },
      { name: 'Music Discovery', description: 'Find trending music', icon: <Music className="w-5 h-5" />, route: '/music', credits: 0 },
    ]
  },
  {
    name: 'Education & Research',
    icon: <GraduationCap className="w-5 h-5" />,
    tools: [
      { name: 'Learn Tech', description: 'Interactive tech courses', icon: <FlaskConical className="w-5 h-5" />, route: '/ai/learn', credits: 0, isPopular: true },
      { name: 'Educational Q&A', description: 'Get answers with sources', icon: <FileQuestion className="w-5 h-5" />, route: '/ai/education', credits: 5 },
      { name: 'Exam Prep', description: 'Practice questions & quizzes', icon: <BookOpen className="w-5 h-5" />, route: '/ai/tools/exam-prep', credits: 3 },
      { name: 'Research Assistant', description: 'Find academic papers', icon: <Globe className="w-5 h-5" />, route: '/ai/tools/research', credits: 8 },
      { name: 'Math Solver', description: 'Solve math problems', icon: <Calculator className="w-5 h-5" />, route: '/ai/tools/math-solver', credits: 3 },
    ]
  },
  {
    name: 'Utility Tools',
    icon: <Settings className="w-5 h-5" />,
    tools: [
      { name: 'QR Code Generator', description: 'Create QR codes instantly', icon: <QrCode className="w-5 h-5" />, route: '/ai/tools/qr-gen', credits: 5, isNew: true },
      { name: 'Meme Generator', description: 'Create funny memes', icon: <ImagePlus className="w-5 h-5" />, route: '/ai/tools/meme-gen', credits: 5 },
      { name: 'Logo Maker', description: 'Design simple logos', icon: <Brush className="w-5 h-5" />, route: '/ai/tools/logo-maker', credits: 10 },
    ]
  },
  {
    name: 'Health & Wellness',
    icon: <Heart className="w-5 h-5" />,
    tools: [
      { name: 'Health Info', description: 'General health information', icon: <Heart className="w-5 h-5" />, route: '/ai/tools/health-info', credits: 0 },
      { name: 'Symptom Checker', description: 'Check symptoms (not medical advice)', icon: <FlaskConical className="w-5 h-5" />, route: '/ai/tools/symptom-checker', credits: 5 },
      { name: 'Nutrition Calculator', description: 'Calculate meal nutrition', icon: <Calculator className="w-5 h-5" />, route: '/ai/tools/nutrition', credits: 5 },
    ]
  },
];

const quickAccessTools: ToolItem[] = [
  { name: 'AI Agent', description: 'Chat with memory', icon: <Brain className="w-6 h-6" />, route: '/ai/agent', credits: 5 },
  { name: 'Humanize AI', description: 'Pass AI detectors', icon: <UserCheck className="w-6 h-6" />, route: '/ai/tools/humanize', credits: 10 },
  { name: 'Image Gen', description: 'Create images', icon: <Wand2 className="w-6 h-6" />, route: '/ai/image-gen', credits: 20 },
  { name: 'Essay Writer', description: 'Academic essays', icon: <BookOpen className="w-6 h-6" />, route: '/ai/tools/essay-writer', credits: 15 },
];

const AICopilot = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Chat & AI Assistant', 'Image Tools']);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadChatHistory();
    loadUserCredits();

    // Real-time subscription for credits
    const channel = supabase
      .channel('user-credits-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          if (payload.new?.balance !== undefined) {
            setUserCredits(payload.new.balance);
            localStorage.setItem('user_credits_cache', String(payload.new.balance));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loading, navigate]);

  usePageRefresh('ai', useCallback(() => {
    loadChatHistory();
    loadUserCredits();
  }, []));

  useEffect(() => {
    if (scrollRef.current && showChat) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  const loadUserCredits = async () => {
    // Show cached value immediately
    const cached = localStorage.getItem('user_credits_cache');
    if (cached) setUserCredits(Number(cached));
    
    try {
      const { data } = await supabase.rpc('get_user_credits');
      const credits = data || 0;
      setUserCredits(credits);
      localStorage.setItem('user_credits_cache', String(credits));
    } catch (error) {
      console.error('Error loading credits:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = data.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      setMessages(formattedMessages);
    } catch (error: any) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    setShowChat(true);
    const userMessage: Message = { role: 'user', content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: currentMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantContent,
                    };
                    return newMessages;
                  });
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      if (assistantContent) {
        await supabase.from('ai_chat_messages').insert([
          { user_id: user?.id, role: 'user', content: input },
          { user_id: user?.id, role: 'assistant', content: assistantContent },
        ]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await supabase
        .from('ai_chat_messages')
        .delete()
        .eq('user_id', user?.id);

      setMessages([]);
      setShowChat(false);
      toast({
        title: 'Chat cleared',
        description: 'Your chat history has been cleared',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to clear chat',
        variant: 'destructive',
      });
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const totalTools = toolCategories.reduce((acc, cat) => acc + cat.tools.length, 0);

  return (
    <>
      <div className="flex flex-col min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/feed')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={feedinIcon} alt="FeedAI" className="w-8 h-8" />
              <span className="text-lg font-semibold">FeedAI</span>
              <Badge variant="secondary" className="ml-1">
                {totalTools}+ Tools
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">
                {userCredits === null ? '...' : userCredits}
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Welcome Banner */}
            <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-full">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold">AI-Powered Tools</h2>
                    <p className="text-sm text-muted-foreground">
                      {totalTools}+ tools for creativity, education & productivity
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Access */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Quick Access
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {quickAccessTools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => navigate(tool.route)}
                    className="flex flex-col items-center p-3 bg-card border border-border rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className="p-2 bg-primary/10 rounded-full mb-2">
                      {tool.icon}
                    </div>
                    <span className="text-xs font-medium text-center leading-tight">
                      {tool.name}
                    </span>
                    {tool.credits > 0 && (
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {tool.credits} credits
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* View All Tools Button */}
            <Button 
              variant="outline" 
              className="w-full justify-between"
              onClick={() => navigate('/ai/tools')}
            >
              <span className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                View All {totalTools}+ Tools
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Tool Categories */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                All Categories
              </h3>
              
              {toolCategories.map((category) => (
                <Collapsible
                  key={category.name}
                  open={expandedCategories.includes(category.name)}
                  onOpenChange={() => toggleCategory(category.name)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {category.icon}
                        </div>
                        <div className="text-left">
                          <span className="font-medium">{category.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({category.tools.length} tools)
                          </span>
                        </div>
                      </div>
                      {expandedCategories.includes(category.name) ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 pl-4">
                    {category.tools.map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => navigate(tool.route)}
                        className="w-full flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="p-2 bg-muted rounded-lg shrink-0">
                          {tool.icon}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{tool.name}</span>
                            {tool.isNew && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600">
                                NEW
                              </Badge>
                            )}
                            {tool.isPopular && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600">
                                HOT
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {tool.description}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {tool.credits === 0 ? (
                            <span className="text-green-600">Free</span>
                          ) : (
                            <span>{tool.credits} cr</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            {/* Features Banner */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm">Download Everything</h4>
                    <p className="text-xs text-muted-foreground">
                      All generated content is yours to download and use freely
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chat Messages (shown when chat is active) */}
            {showChat && messages.length > 0 && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Chat History
                  </h3>
                  <Button variant="ghost" size="sm" onClick={handleClearChat}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <EnhancedMarkdownRenderer content={message.content} className="text-sm" />
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <TypingIndicator />
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Chat Input */}
        <div className="sticky bottom-20 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <Input
              placeholder="Ask FeedAI anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <BottomNav transparent={false} />
    </>
  );
};

export default AICopilot;
