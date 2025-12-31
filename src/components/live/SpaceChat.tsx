import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SpaceMentionInput } from './SpaceMentionInput';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SpaceChatProps {
  spaceId: string;
  onClose: () => void;
  navigateToLive?: boolean; // If true, navigate to /live instead of just closing
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const SpaceChat = ({ spaceId, onClose, navigateToLive = false }: SpaceChatProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Format message content with highlighted mentions
  const formatMessageWithMentions = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className={cn("text-primary font-semibold")}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  useEffect(() => {
    console.log('[SpaceChat] Initializing chat for space:', spaceId);
    fetchMessages();

    const channel = supabase
      .channel(`space-chat-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_messages',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload) => {
        console.log('[SpaceChat] New message received:', payload.new);
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .eq('id', payload.new.user_id)
          .single();

        const newMsg: ChatMessage = {
          id: payload.new.id,
          content: payload.new.content,
          created_at: payload.new.created_at,
          user_id: payload.new.user_id,
          profile: profile || undefined,
        };

        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe((status) => {
        console.log('[SpaceChat] Subscription status:', status);
      });

    return () => {
      console.log('[SpaceChat] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data: messagesData } = await supabase
      .from('live_space_messages')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (messagesData && messagesData.length > 0) {
      const userIds = [...new Set(messagesData.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setMessages(messagesData.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id),
      })));
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    console.log('[SpaceChat] Sending message:', newMessage.trim());
    
    try {
      const { data, error } = await supabase.from('live_space_messages').insert({
        space_id: spaceId,
        user_id: user.id,
        content: newMessage.trim(),
      }).select().single();
      
      if (error) {
        console.error('[SpaceChat] Error sending message:', error);
        toast.error('Failed to send message');
      } else {
        console.log('[SpaceChat] Message sent successfully:', data);
        setNewMessage('');
      }
    } catch (error) {
      console.error('[SpaceChat] Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (navigateToLive) {
      navigate('/live');
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with drag indicator */}
      <div className="flex flex-col items-center pt-2 pb-1">
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mb-2" />
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-semibold flex-1">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <Avatar 
              className="w-8 h-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => navigate(`/profile/${msg.user_id}`)}
            >
              <AvatarImage src={msg.profile?.avatar_url || ''} />
              <AvatarFallback>{msg.profile?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p 
                className="text-xs font-semibold text-primary cursor-pointer hover:underline"
                onClick={() => navigate(`/profile/${msg.user_id}`)}
              >
                {msg.profile?.display_name || 'User'}
              </p>
              <p className="text-sm break-words">
                {formatMessageWithMentions(msg.content)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t flex gap-2 pb-safe">
        <SpaceMentionInput
          value={newMessage}
          onChange={(value) => setNewMessage(value)}
          placeholder="Say something... (@ to mention)"
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={sending}
          spaceId={spaceId}
        />
        <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
