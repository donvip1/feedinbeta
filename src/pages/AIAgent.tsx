import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ChatMessage, Message } from '@/components/ai/ChatMessage';
import { ChatInput } from '@/components/ai/ChatInput';
import { AIWelcomeScreen } from '@/components/ai/AIWelcomeScreen';
import { QuickAction } from '@/components/ai/QuickActionChips';
import { ArrowLeft, Trash2, Plus, History } from 'lucide-react';
import feedinIcon from '@/assets/feedin-icon.png';

interface Conversation {
  id: string;
  title: string;
  is_active: boolean;
  message_count: number;
  updated_at: string;
}

const SYSTEM_PROMPT = `You are FeedIn AI, an intelligent assistant integrated into the FeedIn social platform.

## Your Capabilities:
1. **Academic Support**: Help with thesis writing, exam preparation, research papers, project documentation
2. **Health & Wellness**: Provide general health information (always include disclaimer for medical advice)
3. **Creative Assistance**: Content ideas, writing help, image concepts, video planning
4. **Programming Help**: Code explanation, debugging assistance, learning resources
5. **Platform Guidance**: Help users navigate FeedIn features and maximize their experience

## Response Style:
- Use clear headers (##) for sections
- Use bullet points and numbered lists for clarity
- Include code blocks with proper syntax highlighting when showing code
- Use **bold** for important terms and *italics* for emphasis
- Add helpful tips in blockquotes
- Use tables for comparisons when appropriate

## Personality:
- Friendly, helpful, and encouraging
- Clear and concise in explanations
- Patient with beginners
- Uses emojis sparingly but effectively 🚀

## Important Rules:
- For medical/health topics: Always include "⚠️ Please consult a healthcare professional for personalized medical advice"
- For legal/financial topics: Recommend consulting qualified professionals
- Be accurate and admit when you don't know something
- Respect user privacy and never ask for sensitive personal information`;

const AIAgent = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadConversations();
    startNewConversation();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadConversations = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('ai_agent_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (!error && data) setConversations(data);
  };

  const startNewConversation = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('ai_agent_conversations')
      .insert({ user_id: user.id, title: 'New Conversation', system_prompt: SYSTEM_PROMPT })
      .select()
      .single();
    if (!error && data) {
      setCurrentConversation(data.id);
      setMessages([]);
      loadConversations();
    }
  };

  const loadConversation = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('ai_agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setMessages(data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, created_at: m.created_at })));
      setCurrentConversation(conversationId);
      setShowHistory(false);
    }
  };

  const handleSend = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading || !currentConversation) return;

    const userMessage: Message = { role: 'user', content: messageText };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    try {
      await supabase.from('ai_agent_messages').insert({
        conversation_id: currentConversation,
        user_id: user?.id,
        role: 'user',
        content: messageText,
      });

      const { fetchAIAgent } = await import('@/utils/aiAgentFetch');
      const response = await fetchAIAgent({
        body: JSON.stringify({ 
          messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

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
                    newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantContent, isStreaming: true };
                    return newMessages;
                  });
                }
              } catch {}
            }
          }
        }
      }

      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantContent };
        return newMessages;
      });

      if (assistantContent) {
        await supabase.from('ai_agent_messages').insert({
          conversation_id: currentConversation,
          user_id: user?.id,
          role: 'assistant',
          content: assistantContent,
        });

        if (messages.length === 0) {
          const title = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');
          await supabase.from('ai_agent_conversations').update({ title, message_count: 2 }).eq('id', currentConversation);
          loadConversations();
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send message', variant: 'destructive' });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt);
  };

  const deleteConversation = async (conversationId: string) => {
    await supabase.from('ai_agent_conversations').delete().eq('id', conversationId);
    loadConversations();
    if (conversationId === currentConversation) startNewConversation();
  };

  if (showHistory) {
    return (
      <div className="flex flex-col h-screen bg-background pb-20">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-semibold">Chat History</span>
            <Button variant="ghost" size="icon" onClick={startNewConversation}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Card key={conv.id} className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => loadConversation(conv.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium truncate">{conv.title}</h3>
                      <p className="text-xs text-muted-foreground">{conv.message_count} messages • {new Date(conv.updated_at).toLocaleDateString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-screen bg-background pb-20">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                <AvatarImage src={feedinIcon} />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <span className="text-lg font-semibold">FeedIn AI</span>
              <Badge variant="secondary" className="text-xs">Pro</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)}>
                <History className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={startNewConversation}>
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-2xl mx-auto">
            {messages.length === 0 ? (
              <AIWelcomeScreen onQuickAction={handleQuickAction} userName={user?.email?.split('@')[0]} />
            ) : (
              messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  message={message}
                  isLatest={index === messages.length - 1}
                  onRegenerate={message.role === 'assistant' && index === messages.length - 1 ? () => handleSend(messages[index - 1]?.content) : undefined}
                />
              ))
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4 bg-background">
          <div className="max-w-2xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              isLoading={isLoading}
              placeholder="Ask me anything..."
            />
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default AIAgent;
