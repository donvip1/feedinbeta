import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useRealtimeMessages = (conversationId: string, userId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Optimistic message add
  const addOptimisticMessage = useCallback((content: string, tempId: string) => {
    if (!userId) return;
    
    const optimisticMsg: Message = {
      id: tempId,
      content,
      sender_id: userId,
      created_at: new Date().toISOString(),
      is_read: false,
      read_at: null,
      profiles: {
        display_name: null,
        avatar_url: null,
      },
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
  }, [userId]);

  // Replace optimistic with real message
  const replaceOptimisticMessage = useCallback((tempId: string, realMessage: Message) => {
    setMessages(prev => prev.map(msg => msg.id === tempId ? realMessage : msg));
  }, []);

  // Load initial messages - single optimized query
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          created_at,
          is_read,
          read_at,
          profiles:sender_id (display_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map(msg => ({
        ...msg,
        profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles,
      }));

      setMessages(formatted);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!userId || !conversationId) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [conversationId, userId]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(`messages:${conversationId}`);

    // Listen for new messages
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const formattedMsg: Message = {
            id: newMessage.id,
            content: newMessage.content,
            sender_id: newMessage.sender_id,
            created_at: newMessage.created_at,
            is_read: newMessage.is_read,
            read_at: newMessage.read_at,
            profiles: profile || { display_name: null, avatar_url: null },
          };

          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === formattedMsg.id)) return prev;
            return [...prev, formattedMsg];
          });

          // Mark as read if not own message
          if (newMessage.sender_id !== userId) {
            markAsRead();
          }
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
        (payload) => {
          const updatedMsg = payload.new as any;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === updatedMsg.id
                ? { ...msg, is_read: updatedMsg.is_read, read_at: updatedMsg.read_at }
                : msg
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Initial load and mark as read
    loadMessages().then(() => markAsRead());

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, userId, loadMessages, markAsRead]);

  // Typing indicator subscription
  useEffect(() => {
    if (!conversationId || !userId) return;

    const typingChannel = supabase.channel(`typing:${conversationId}`);

    typingChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const indicator = payload.new as any;
          if (indicator?.user_id !== userId) {
            setIsTyping(indicator?.is_typing || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, userId]);

  return {
    messages,
    isTyping,
    loading,
    addOptimisticMessage,
    replaceOptimisticMessage,
    markAsRead,
  };
};
