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
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiUsage, setAiUsage] = useState({ promptCount: 0, imageCount: 0, isPremium: false });
  const [showQuickActions, setShowQuickActions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadChatHistory();
    loadAIUsage();
  }, [user]);

  const loadAIUsage = async () => {
    try {
      // Get user's profile with AI usage data
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_ai_prompt_count, daily_ai_image_count, last_ai_reset_date')
        .eq('id', user?.id)
        .single();

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
            daily_ai_prompt_count: 0, 
            daily_ai_image_count: 0,
            last_ai_reset_date: today 
          })
          .eq('id', user?.id);
        
        setAiUsage({ promptCount: 0, imageCount: 0, isPremium: isPremium || false });
      } else {
        setAiUsage({
          promptCount: profile?.daily_ai_prompt_count || 0,
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

    // Check AI usage limits
    if (!aiUsage.isPremium && aiUsage.promptCount >= 3) {
      toast({
        title: 'Daily limit reached',
        description: 'Free users can send 3 prompts per day. Upgrade to Premium for unlimited access.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    const userMsg: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    await saveChatMessage('user', userMessage);

    try {
      await streamChat(userMessage);
      
      // Increment prompt count
      const newCount = aiUsage.promptCount + 1;
      await supabase
        .from('profiles')
        .update({ daily_ai_prompt_count: newCount })
        .eq('id', user?.id);
      
      setAiUsage(prev => ({ ...prev, promptCount: newCount }));
      
      // Track usage
      await supabase.from('ai_usage').insert({
        user_id: user?.id,
        model: 'google/gemini-2.5-flash',
        feature: 'chat',
        tokens_used: userMessage.length + 100, // Estimate
        cost_credits: 0,
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      toast({
        title: 'AI Error',
        description: error.message || 'Failed to get response from AI',
        variant: 'destructive',
      });
      // Remove the user message if AI failed
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
                onClick={() => navigate('/feed')}
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
                  AI Copilot
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!aiUsage.isPremium && (
                <div className="text-xs bg-gray-800 px-3 py-1 rounded-full">
                  {aiUsage.promptCount}/3 prompts
                </div>
              )}
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
                    desc: 'Enhance photos with Good, Better, or Ultra quality',
                    icon: '🎨',
                    prompt: 'I want to enhance an image'
                  },
                  { 
                    title: 'Image Generation', 
                    desc: 'Create AI-generated images from text descriptions',
                    icon: '🖼️',
                    prompt: 'I want to generate an image'
                  },
                  { 
                    title: 'Project Writing', 
                    desc: 'Help with essays, reports, and academic projects',
                    icon: '📝',
                    prompt: 'Help me write a project'
                  },
                  { 
                    title: 'Educational Q&A', 
                    desc: 'Get help with homework and learning concepts',
                    icon: '🎓',
                    prompt: 'I have a question about my studies'
                  },
                  { 
                    title: 'Video Creation', 
                    desc: 'Generate short videos from text or images',
                    icon: '🎬',
                    prompt: 'I want to create a short video'
                  },
                  { 
                    title: 'Thesis Generator', 
                    desc: 'Structure and develop thesis papers',
                    icon: '📚',
                    prompt: 'Help me with my thesis'
                  },
                  { 
                    title: 'App Guide', 
                    desc: 'Learn how to use FEEDIN features',
                    icon: '❓',
                    prompt: 'How does FEEDIN work?'
                  },
                  { 
                    title: 'General Chat', 
                    desc: 'Ask me anything or have a conversation',
                    icon: '💬',
                    prompt: 'Let\'s chat!'
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
          toast({
            title: 'AI Feature',
            description: `${action} - Coming Soon! This feature will allow advanced AI operations.`,
          });
        }}
        context="ai"
      />
    </div>
  );
};

export default AICopilot;