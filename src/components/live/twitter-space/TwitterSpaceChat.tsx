import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Camera, MoreHorizontal, Heart, MessageCircle, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface TwitterSpaceChatProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spaceTitle: string;
  hostName: string;
  startedAt?: string;
  viewerCount: number;
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

export const TwitterSpaceChat = ({
  isOpen,
  onClose,
  spaceId,
  spaceTitle,
  hostName,
  startedAt,
  viewerCount,
}: TwitterSpaceChatProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const duration = startedAt 
    ? formatDistanceToNow(new Date(startedAt), { addSuffix: false })
    : '0:00';

  const dateStr = startedAt 
    ? format(new Date(startedAt), 'dd MMM yy')
    : format(new Date(), 'dd MMM yy');

  useEffect(() => {
    if (!isOpen) return;
    
    fetchMessages();

    const channel = supabase
      .channel(`twitter-space-chat-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_messages',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload) => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, spaceId]);

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
    
    try {
      await supabase.from('live_space_messages').insert({
        space_id: spaceId,
        user_id: user.id,
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-950 z-50 flex flex-col border-l border-zinc-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-white font-semibold">Space</h2>
              <button className="p-2 text-zinc-400 hover:text-white">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Space Info Header */}
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-lg">
                  🎙️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">{hostName}</span>
                    <span className="text-xs text-red-500 font-semibold">• LIVE</span>
                  </div>
                  <h3 className="text-white font-bold text-lg leading-tight mt-1">{spaceTitle}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-950" />
                      <div className="w-6 h-6 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                      <div className="w-6 h-6 rounded-full bg-zinc-500 border-2 border-zinc-950" />
                    </div>
                    <span className="text-zinc-500 text-sm">Joined</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 text-zinc-500 text-sm">
                {duration} • {dateStr} • {viewerCount} Views
              </div>
              
              <div className="flex gap-4 mt-2 text-zinc-500 text-sm">
                <span>5 Reposts</span>
                <span>10 Likes</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Most relevant replies</span>
                <button className="text-zinc-500 text-xs">▼</button>
              </div>

              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      <Avatar 
                        className="w-10 h-10 cursor-pointer"
                        onClick={() => navigate(`/profile/${msg.user_id}`)}
                      >
                        <AvatarImage src={msg.profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-400">
                          {msg.profile?.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">
                            {msg.profile?.display_name || 'User'}
                          </span>
                          <span className="text-zinc-600 text-xs">
                            @{msg.profile?.username || 'user'}
                          </span>
                          <span className="text-zinc-600 text-xs">
                            · {formatDistanceToNow(new Date(msg.created_at), { addSuffix: false })}
                          </span>
                        </div>
                        
                        <p className="text-zinc-400 text-sm mt-1">{msg.content}</p>
                        
                        <div className="flex items-center gap-6 mt-2 text-zinc-600">
                          <button className="flex items-center gap-1 hover:text-zinc-400">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button className="flex items-center gap-1 hover:text-zinc-400">
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button className="flex items-center gap-1 hover:text-red-500">
                            <Heart className="w-4 h-4" />
                            <span className="text-xs">2</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-zinc-800 pb-safe">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-zinc-800 text-zinc-400">U</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-full border border-zinc-800 px-4 py-2">
                  <Input
                    placeholder="Reply to this Space"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="border-0 bg-transparent text-white placeholder:text-zinc-500 p-0 h-auto focus-visible:ring-0"
                  />
                  <button className="text-zinc-500 hover:text-zinc-400">
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="p-2 text-purple-500 hover:text-purple-400 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
