import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SpaceMentionInput } from './SpaceMentionInput';
import { MentionText } from './MentionText';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SpaceChatProps {
  spaceId: string;
  onClose: () => void;
  navigateToLive?: boolean;
  coverImageUrl?: string;
  spaceTitle?: string;
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

export const SpaceChat = ({ spaceId, onClose, navigateToLive = false, coverImageUrl, spaceTitle }: SpaceChatProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleMentionClick = async (username: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();
    if (profile) {
      navigate(`/profile/${profile.id}`, { state: { returnTo: `/live/space/${spaceId}` } });
    }
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
      } else {
        console.log('[SpaceChat] Message sent successfully:', data);
        setNewMessage('');
      }
    } catch (error) {
      console.error('[SpaceChat] Error sending message:', error);
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
    <div className="flex flex-col h-full bg-[#050505] text-white">
      {/* Drag indicator */}
      <div className="flex flex-col items-center pt-2 pb-1">
        <div className="w-12 h-1 bg-white/20 rounded-full mb-1" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <button onClick={handleBack} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-sm text-white">Live Chat</h3>
        </div>
        <div className="w-9" />
      </div>

      {/* Cover Image Banner */}
      {coverImageUrl && (
        <div className="relative w-full h-28 overflow-hidden">
          <img src={coverImageUrl} alt={spaceTitle || 'Space'} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            {spaceTitle && (
              <p className="text-sm font-black text-white drop-shadow-lg truncate">
                {spaceTitle}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Live</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold">{messages.length} messages</span>
            </div>
          </div>
        </div>
      )}

      {/* No cover fallback header */}
      {!coverImageUrl && spaceTitle && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-sm font-black text-white truncate">{spaceTitle}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live · {messages.length} messages</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-[1.5rem] bg-white/5 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">No messages yet</p>
            <p className="text-[10px] text-zinc-700 mt-1">Be the first to say something</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3 group">
            <Avatar 
              className="w-9 h-9 flex-shrink-0 cursor-pointer rounded-xl border-2 border-white/5 hover:border-purple-500/50 transition-all"
              onClick={() => navigate(`/profile/${msg.user_id}`)}
            >
              <AvatarImage src={msg.profile?.avatar_url || ''} />
              <AvatarFallback className="bg-zinc-800 text-zinc-400 rounded-xl text-xs">
                {msg.profile?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span 
                  className="text-xs font-bold text-white cursor-pointer hover:text-purple-400 transition-colors"
                  onClick={() => navigate(`/profile/${msg.profile?.username || msg.user_id}`, { state: { returnTo: `/live/space/${spaceId}` } })}
                >
                  {msg.profile?.display_name || 'User'}
                </span>
                <span className="text-[10px] text-zinc-600">@{msg.profile?.username || 'user'}</span>
                <span className="text-[10px] text-zinc-700">
                  · {formatDistanceToNow(new Date(msg.created_at), { addSuffix: false })}
                </span>
              </div>
              <MentionText
                text={msg.content}
                className="text-sm text-zinc-300 break-words mt-0.5"
                onMentionClick={handleMentionClick}
              />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5 pb-safe">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SpaceMentionInput
              value={newMessage}
              onChange={(value) => setNewMessage(value)}
              placeholder="Say something... (@ to mention)"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={sending}
              spaceId={spaceId}
            />
          </div>
          <button 
            onClick={sendMessage} 
            disabled={sending || !newMessage.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-[1rem] bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 transition-all active:scale-90 shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
