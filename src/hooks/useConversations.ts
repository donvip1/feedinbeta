import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  updated_at: string;
  participant: Profile;
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export const useConversations = (userId?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Optimized single-query load
  const loadConversations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Get all conversations with last message in one query
      const { data: participations, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner (
            id,
            updated_at,
            messages (
              content,
              created_at,
              sender_id
            )
          )
        `)
        .eq('user_id', userId)
        .order('conversations.updated_at', { ascending: false });

      if (error) throw error;

      // Get other participants for each conversation
      const conversationIds = participations?.map((p: any) => p.conversation_id) || [];
      
      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .in('conversation_id', conversationIds)
        .neq('user_id', userId);

      // Get unread counts
      const { data: unreadCounts } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .eq('is_read', false);

      const unreadMap = new Map<string, number>();
      unreadCounts?.forEach((msg: any) => {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
      });

      const participantMap = new Map<string, Profile>();
      otherParticipants?.forEach((p: any) => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        if (profile) {
          participantMap.set(p.conversation_id, profile);
        }
      });

      const formatted: Conversation[] = participations
        ?.map((p: any) => {
          const convo = p.conversations;
          const messages = Array.isArray(convo.messages) ? convo.messages : [convo.messages];
          const lastMsg = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          const participant = participantMap.get(p.conversation_id);
          if (!participant) return null;

          return {
            id: convo.id,
            updated_at: convo.updated_at,
            participant,
            last_message: lastMsg || null,
            unread_count: unreadMap.get(convo.id) || 0,
          };
        })
        .filter(Boolean) as Conversation[];

      // Sort by last message time
      formatted.sort((a, b) => {
        const timeA = a.last_message?.created_at || a.updated_at;
        const timeB = b.last_message?.created_at || b.updated_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setConversations(formatted);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Real-time updates for conversations
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('conversations-updates');

    // Listen for new messages to update conversation list
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Reload conversations on new message
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Update unread count when message is read
          const msg = payload.new as any;
          if (msg.is_read) {
            setConversations(prev =>
              prev.map(conv =>
                conv.id === msg.conversation_id
                  ? { ...conv, unread_count: Math.max(0, conv.unread_count - 1) }
                  : conv
              )
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    loadConversations();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, loadConversations]);

  return {
    conversations,
    loading,
    refresh: loadConversations,
  };
};
