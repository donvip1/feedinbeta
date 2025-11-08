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

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ChatInterfaceProps {
  conversationId: string;
  onBack: () => void;
}

export const ChatInterface = ({ conversationId, onBack }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const initializeChat = async () => {
      setLoading(true);
      await loadOtherUser();
      await loadMessages();
      setLoading(false);
      subscribeToMessages();
      subscribeToTyping();
      markMessagesAsRead();
    };
    initializeChat();
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(display_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const formattedMessages = (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        created_at: msg.created_at,
        is_read: msg.is_read,
        read_at: msg.read_at,
        profiles: {
          display_name: msg.sender?.display_name || null,
          avatar_url: msg.sender?.avatar_url || null,
        }
      }));
      
      setMessages(formattedMessages);
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      // Mark all unread messages from other users as read
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadOtherUser = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('user_id, participant:profiles!conversation_participants_user_id_fkey(*)')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setOtherUser(data?.participant);
    } catch (error: any) {
      console.error('Error loading other user:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
          markMessagesAsRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToTyping = () => {
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: any) => {
          if (payload.new?.user_id !== user?.id) {
            setIsTyping(payload.new?.is_typing || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    setSending(true);
    try {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: newMessage.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Check message with moderation bot
      if (newMsg) {
        const { data: modResult } = await supabase.functions.invoke('moderation-bot', {
          body: {
            messageId: newMsg.id,
            content: newMessage.trim(),
            senderId: user.id,
          },
        });

        if (modResult?.deleted) {
          toast({
            title: 'Message blocked',
            description: modResult.reason,
            variant: 'destructive',
          });
          // Reload messages to remove the deleted one
          loadMessages();
        }
      }

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

      setNewMessage('');
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
