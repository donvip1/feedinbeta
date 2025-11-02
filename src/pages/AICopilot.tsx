import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/navigation/BottomNav';
import { QuickActionsModal } from '@/components/feed/QuickActionsModal';
import { ArrowLeft, Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AICopilot = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiUsage, setAiUsage] = useState({ 
    chatCount: 0, 
    thesisCount: 0, 
    videoCount: 0, 
    eduQaCount: 0, 
    imageCount: 0, 
    isPremium: false 
  });
  const [userCredits, setUserCredits] = useState(0);
  const [selectedTool, setSelectedTool] = useState<string>('chat');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadChatHistory();
    loadAIUsage();
  }, [user, loading]);

  const loadAIUsage = async () => {
    try {
      // Get user's profile with AI usage data
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_ai_chat_count, daily_ai_thesis_count, daily_ai_video_count, daily_ai_eduqa_count, daily_ai_image_count, last_ai_reset_date')
        .eq('id', user?.id)
        .single();

      // Get user credits
      const { data: credits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user?.id)
        .single();

      setUserCredits(credits?.balance || 0);

      // Check if user has premium subscription
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status, subscription_tiers(name)')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .single();

      const tier = Array.isArray(subscription?.subscription_tiers) 
        ? subscription.subscription_tiers[0] 
        : subscription?.subscription_tiers;
      
      const isPremium = subscription && (tier?.name === 'Pro' || tier?.name === 'Premium');

      // Check if we need to reset daily counts
      const today = new Date().toISOString().split('T')[0];
      const lastReset = profile?.last_ai_reset_date?.split('T')[0];
      
      if (lastReset !== today) {
        // Reset counts for new day
        await supabase
          .from('profiles')
          .update({ 
            daily_ai_chat_count: 0,
            daily_ai_thesis_count: 0,
            daily_ai_video_count: 0,
            daily_ai_eduqa_count: 0,
            daily_ai_image_count: 0,
            last_ai_reset_date: today 
          })
          .eq('id', user?.id);
        
        setAiUsage({ 
          chatCount: 0, 
          thesisCount: 0, 
          videoCount: 0, 
          eduQaCount: 0, 
          imageCount: 0, 
          isPremium: isPremium || false 
        });
      } else {
        setAiUsage({
          chatCount: profile?.daily_ai_chat_count || 0,
          thesisCount: profile?.daily_ai_thesis_count || 0,
          videoCount: profile?.daily_ai_video_count || 0,
          eduQaCount: profile?.daily_ai_eduqa_count || 0,
          imageCount: profile?.daily_ai_image_count || 0,
          isPremium: isPremium || false,
        });
      }
    } catch (error) {
      console.error('Error loading AI usage:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('role, content')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error: any) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatMessage = async (role: 'user' | 'assistant', content: string) => {
    try {
      await supabase.from('ai_chat_messages').insert({
        user_id: user?.id,
        role,
        content,
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: [...messages, { role: 'user', content: userMessage }] }),
    });

    if (!resp.ok) {
      const error = await resp.json();
      throw new Error(error.error || 'Failed to get AI response');
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          // Gemini format: candidates[0].content.parts[0].text
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Save assistant message
    if (assistantContent) {
      await saveChatMessage('assistant', assistantContent);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim().toLowerCase();
    
    // Detect tool type based on message
    let toolType = 'chat';
    let creditCost = 0;
    let dailyLimit = 0;
    let currentCount = 0;
    let countField = '';

    if (userMessage.includes('thesis') || userMessage.includes('research paper')) {
      toolType = 'thesis';
      creditCost = 20;
      dailyLimit = 1;
      currentCount = aiUsage.thesisCount;
      countField = 'daily_ai_thesis_count';
    } else if (userMessage.includes('video') || userMessage.includes('video creation')) {
      toolType = 'video';
      creditCost = 50;
      dailyLimit = 1;
      currentCount = aiUsage.videoCount;
      countField = 'daily_ai_video_count';
    } else if (userMessage.includes('homework') || userMessage.includes('studies') || userMessage.includes('educational') || userMessage.includes('learn')) {
      toolType = 'eduqa';
      creditCost = 5;
      dailyLimit = 5;
      currentCount = aiUsage.eduQaCount;
      countField = 'daily_ai_eduqa_count';
    } else if (userMessage.includes('image') || userMessage.includes('photo') || userMessage.includes('enhance') || userMessage.includes('generate')) {
      toolType = 'image';
      creditCost = 20;
      dailyLimit = 1;
      currentCount = aiUsage.imageCount;
      countField = 'daily_ai_image_count';
    } else {
      // General chat and app guide are free unlimited
      toolType = 'chat';
      creditCost = 0;
      dailyLimit = 0;
      currentCount = aiUsage.chatCount;
      countField = 'daily_ai_chat_count';
    }

    // Check limits for paid features
    if (dailyLimit > 0 && currentCount >= dailyLimit) {
      // Check if user has enough credits
      if (userCredits < creditCost) {
        toast({
          title: 'Insufficient credits',
          description: `You need ${creditCost} credits to use this feature. Purchase credits or wait until tomorrow for your free usage to reset.`,
          variant: 'destructive',
        });
        return;
      }

      // Deduct credits
      const { error: deductError } = await supabase
        .from('user_credits')
        .update({ balance: userCredits - creditCost })
        .eq('user_id', user?.id);

      if (deductError) {
        toast({
          title: 'Error',
          description: 'Failed to deduct credits. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Log credit transaction
      await supabase.from('credit_transactions').insert({
        user_id: user?.id,
        amount: -creditCost,
        type: 'deduction',
        description: `AI ${toolType} usage`,
      });

      setUserCredits(prev => prev - creditCost);
    }

    const fullMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    const userMsg: Message = { role: 'user', content: fullMessage };
    setMessages(prev => [...prev, userMsg]);
    await saveChatMessage('user', fullMessage);

    try {
      await streamChat(fullMessage);
      
      // Increment count
      if (countField) {
        const newCount = currentCount + 1;
        await supabase
          .from('profiles')
          .update({ [countField]: newCount })
          .eq('id', user?.id);
        
        setAiUsage(prev => ({ 
          ...prev, 
          [`${toolType}Count`]: newCount 
        }));
      }
      
      // Track usage
      await supabase.from('ai_usage').insert({
        user_id: user?.id,
        model: 'google/gemini-2.5-flash',
        feature: toolType,
        tokens_used: fullMessage.length + 100,
        cost_credits: creditCost,
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      toast({
        title: 'AI Error',
        description: error.message || 'Failed to get response from AI',
        variant: 'destructive',
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await supabase
        .from('ai_chat_messages')
        .delete()
        .eq('user_id', user?.id);
      
      setMessages([]);
      toast({
        title: 'Chat cleared',
        description: 'Your conversation history has been deleted',
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate(-1)}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  FEED AI
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-xs bg-gray-800 px-3 py-1 rounded-full">
                {userCredits} credits
              </div>
              {messages.length > 0 && (
                <Button
                  onClick={clearChat}
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="container mx-auto max-w-2xl space-y-6">
          {messages.length === 0 ? (
            <div className="py-6">
              <div className="text-center mb-8">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">AI Tools & Assistants</h2>
                <p className="text-gray-400 text-sm">
                  Choose a tool below or start a conversation
                </p>
              </div>

              {/* AI Tools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {[
                  { 
                    title: 'Image Enhancement', 
                    desc: '1 free/day then 20 credits per use',
                    icon: '🎨',
                    prompt: 'I want to enhance an image',
                    cost: 20,
                    limit: '1/day'
                  },
                  { 
                    title: 'Image Generation', 
                    desc: '1 free/day then 20 credits per use',
                    icon: '🖼️',
                    prompt: 'I want to generate an image',
                    cost: 20,
                    limit: '1/day'
                  },
                  { 
                    title: 'Project Writing', 
                    desc: '1 free/day then 20 credits per use',
                    icon: '📝',
                    prompt: 'Help me write a project',
                    cost: 20,
                    limit: '1/day'
                  },
                  { 
                    title: 'Educational Q&A', 
                    desc: '5 free/day then 5 credits per use',
                    icon: '🎓',
                    prompt: 'I have a question about my studies',
                    cost: 5,
                    limit: '5/day'
                  },
                  { 
                    title: 'Video Creation', 
                    desc: '1 free/day then 50 credits per use',
                    icon: '🎬',
                    prompt: 'I want to create a short video',
                    cost: 50,
                    limit: '1/day'
                  },
                  { 
                    title: 'Thesis Generator', 
                    desc: '1 free/day then 20 credits per use',
                    icon: '📚',
                    prompt: 'Help me with my thesis',
                    cost: 20,
                    limit: '1/day'
                  },
                  { 
                    title: 'App Guide', 
                    desc: 'Free unlimited - Learn FEEDIN features',
                    icon: '❓',
                    prompt: 'How does FEEDIN work?',
                    cost: 0,
                    limit: 'Unlimited'
                  },
                  { 
                    title: 'General Chat', 
                    desc: 'Free unlimited - Ask anything',
                    icon: '💬',
                    prompt: 'Let\'s chat!',
                    cost: 0,
                    limit: 'Unlimited'
                  }
                ].map((tool, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(tool.prompt)}
                    className="text-left bg-gray-900/50 hover:bg-gray-800 rounded-xl p-5 transition-all border border-gray-800 hover:border-blue-500/50 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl group-hover:scale-110 transition-transform">
                        {tool.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-white group-hover:text-blue-400 transition-colors">
                          {tool.title}
                        </h3>
                        <p className="text-xs text-gray-400">{tool.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Suggestions */}
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-3">Or try these quick prompts:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'Trending topics',
                    'Content ideas',
                    'Study tips'
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="text-xs bg-gray-900 hover:bg-gray-800 rounded-full px-4 py-2 transition-colors border border-gray-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' ? (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                      : 'bg-gray-900 border border-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-900 rounded-2xl px-4 py-3 border border-gray-800">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="sticky bottom-20 bg-black/80 backdrop-blur-lg border-t border-gray-800 px-4 py-4">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-end gap-2">
            <Input
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              className="flex-1 bg-gray-900 border-gray-800"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <BottomNav onQuickActionClick={() => setShowQuickActions(true)} currentPage="ai" />

      {/* AI Tools Modal */}
      <QuickActionsModal
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onActionSelect={(action) => {
          switch (action) {
            case "thesis-writer":
              navigate("/thesis-writer");
              break;
            case "video-creation":
              navigate("/video-creation");
              break;
            case "educational-qa":
              navigate("/educational-qa");
              break;
            case "project-writing":
              navigate("/project-writing");
              break;
            case "image-generation":
              navigate("/image-generation");
              break;
            case "image-enhancement":
              navigate("/image-enhancement");
              break;
            default:
              toast({
                title: 'AI Feature',
                description: `${action} - Coming Soon! This feature will allow advanced AI operations.`,
              });
          }
          setShowQuickActions(false);
        }}
        context="ai"
      />
    </div>
  );
};

export default AICopilot;