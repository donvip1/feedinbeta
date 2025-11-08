import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Phone, Video } from 'lucide-react';
import { EnhancedMessageBubble } from './EnhancedMessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';

interface ChatInterfaceProps {
  conversationId: string;
  onBack: () => void;
}

export const ChatInterface = ({ conversationId, onBack }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Use optimized real-time messages hook
  const { messages, isTyping, loading, addOptimisticMessage, replaceOptimisticMessage } = 
    useRealtimeMessages(conversationId, user?.id);

  useEffect(() => {
    loadOtherUser();
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadOtherUser = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('profiles:user_id (id, display_name, username, avatar_url)')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      const profile = Array.isArray(data?.profiles) ? data.profiles[0] : data?.profiles;
      setOtherUser(profile);
    } catch (error) {
      console.error('Error loading other user:', error);
    }
  };

  const handleTyping = async () => {
    if (!user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    await supabase
      .from('typing_indicators')
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        is_typing: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'conversation_id,user_id'
      });

    typingTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'conversation_id,user_id'
        });
    }, 2000);
  };

  const handleSend = async () => {
    if (!user || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Optimistic update
    addOptimisticMessage(messageContent, tempId);
    setNewMessage('');
    setSending(true);

    try {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: messageContent,
        })
        .select(`
          id,
          content,
          sender_id,
          created_at,
          is_read,
          read_at,
          profiles:sender_id (display_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      if (newMsg) {
        const formatted = {
          ...newMsg,
          profiles: Array.isArray(newMsg.profiles) ? newMsg.profiles[0] : newMsg.profiles,
        };
        replaceOptimisticMessage(tempId, formatted);
      }

      // Clear typing indicator
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'conversation_id,user_id'
        });

    } catch (error: any) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const initiateCall = async (callType: 'video' | 'voice') => {
    if (!user || !otherUser) return;

    try {
      // Create call log
      const { data: callLog, error } = await supabase
        .from('call_logs')
        .insert({
          caller_id: user.id,
          receiver_id: otherUser.id,
          call_type: callType,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Calling...',
        description: `Starting ${callType} call`,
      });

      // Navigate to call page
      navigate(`/call?callId=${callLog.id}&type=${callType}`);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      toast({
        title: 'Call Failed',
        description: 'Unable to start call. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 py-2 border-b flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar>
          <AvatarImage src={otherUser?.avatar_url || ''} />
          <AvatarFallback>{otherUser?.display_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold text-card-foreground">{loading ? 'Loading...' : otherUser?.display_name || 'Unknown User'}</h2>
          {otherUser?.username && (
            <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => initiateCall('voice')} title="Voice call">
            <Phone className="w-5 h-5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => initiateCall('video')} title="Video call">
            <Video className="w-5 h-5 text-primary" />
          </Button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 w-full">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <p>Loading messages...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <EnhancedMessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user?.id}
                onReply={() => {}}
                onReact={() => {}}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input & Send Button */}
      <div className="px-4 py-3 border-t w-full bg-background">
        <form
          className="flex items-center gap-2 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            type="text"
            className="flex-1 px-4 py-2 rounded-full bg-muted text-sm"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            disabled={sending}
          />
          <Button type="submit" size="icon" className="rounded-full bg-primary text-primary-foreground" disabled={sending || !newMessage.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
