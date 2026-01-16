import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { MarkdownRenderer } from '@/components/ai/MarkdownRenderer';
import { 
  ArrowLeft, Send, Loader2, Trash2, Bot, Sparkles, 
  GraduationCap, Heart, Code, Lightbulb, FileText,
  Image, Video, Plus, History, Settings
} from 'lucide-react';
import feedinIcon from '@/assets/feedin-icon.png';

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

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

## Personality:
- Friendly, helpful, and encouraging
- Clear and concise in explanations
- Patient with beginners
- Cites sources when providing factual information
- Uses emojis sparingly but effectively

## Important Rules:
- For medical/health topics: Always include "Please consult a healthcare professional for personalized medical advice"
- For legal/financial topics: Recommend consulting qualified professionals
- Be accurate and admit when you don't know something
- Respect user privacy and never ask for sensitive personal information

## Response Format:
- Use markdown for formatting when helpful
- Break down complex topics into digestible sections
- Provide examples when explaining concepts
- Offer follow-up suggestions when appropriate`;

const quickActions = [
  { id: 'thesis', label: 'Help with Thesis', icon: GraduationCap, prompt: 'I need help writing my thesis. Can you guide me through the process?' },
  { id: 'health', label: 'Health Question', icon: Heart, prompt: 'I have a health-related question. ' },
  { id: 'code', label: 'Coding Help', icon: Code, prompt: 'I need help with coding. ' },
  { id: 'ideas', label: 'Content Ideas', icon: Lightbulb, prompt: 'Give me some creative content ideas for social media.' },
  { id: 'write', label: 'Write for Me', icon: FileText, prompt: 'Help me write ' },
];

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
  const inputRef = useRef<HTMLInputElement>(null);

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
    
    if (!error && data) {
      setConversations(data);
    }
  };

  const startNewConversation = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('ai_agent_conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation',
        system_prompt: SYSTEM_PROMPT,
      })
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
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        created_at: m.created_at,
      })));
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
      // Save user message
      await supabase.from('ai_agent_messages').insert({
        conversation_id: currentConversation,
        user_id: user?.id,
        role: 'user',
        content: messageText,
      });

      // Stream response from AI
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      // Handle streaming
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

      // Save assistant message
      if (assistantContent) {
        await supabase.from('ai_agent_messages').insert({
          conversation_id: currentConversation,
          user_id: user?.id,
          role: 'assistant',
          content: assistantContent,
        });

        // Update conversation title if first message
        if (messages.length === 0) {
          const title = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');
          await supabase
            .from('ai_agent_conversations')
            .update({ title, message_count: 2 })
            .eq('id', currentConversation);
          loadConversations();
        } else {
          await supabase
            .from('ai_agent_conversations')
            .update({ message_count: messages.length + 2, updated_at: new Date().toISOString() })
            .eq('id', currentConversation);
        }
      }
    } catch (error: any) {
      console.error('Error:', error);
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

  const handleQuickAction = (action: typeof quickActions[0]) => {
    setInput(action.prompt);
    inputRef.current?.focus();
  };

  const deleteConversation = async (conversationId: string) => {
    await supabase
      .from('ai_agent_conversations')
      .delete()
      .eq('id', conversationId);
    
    loadConversations();
    
    if (conversationId === currentConversation) {
      startNewConversation();
    }
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
              <Card 
                key={conv.id}
                className="cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => loadConversation(conv.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium truncate">{conv.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {conv.message_count} messages • {new Date(conv.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                    >
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
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={feedinIcon} />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <div>
                <span className="text-lg font-semibold">FeedIn AI</span>
                <Badge variant="secondary" className="ml-2 text-xs">Agent</Badge>
              </div>
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

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-2xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="relative inline-block">
                  <img src={feedinIcon} alt="FeedIn AI" className="w-20 h-20 mx-auto mb-4" />
                  <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-yellow-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">FeedIn AI Agent</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Your intelligent assistant for academics, health, coding, content creation, and more!
                </p>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                  {quickActions.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto py-3 flex-col gap-1"
                      onClick={() => handleQuickAction(action)}
                    >
                      <action.icon className="w-5 h-5 text-primary" />
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8 mr-2 flex-shrink-0">
                    <AvatarImage src={feedinIcon} />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <MarkdownRenderer content={message.content} className="text-sm" />
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <Avatar className="w-8 h-8 mr-2">
                  <AvatarImage src={feedinIcon} />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <Input
              ref={inputRef}
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
              className="rounded-full"
            />
            <Button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="rounded-full"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
};

export default AIAgent;
