import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StarredMessage {
  id: string;
  messageId: string;
  messageType: 'dm' | 'group';
  conversationId?: string;
  groupId?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
  starredAt: string;
  groupName?: string;
  conversationPartnerName?: string;
}

interface UseStarredMessagesResult {
  starredMessages: StarredMessage[];
  starredIds: Set<string>;
  loading: boolean;
  isStarred: (messageId: string, type: 'dm' | 'group') => boolean;
  toggleStar: (
    messageId: string,
    type: 'dm' | 'group',
    conversationId?: string,
    groupId?: string
  ) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStarredMessages(): UseStarredMessagesResult {
  const { user } = useAuth();
  const [starredMessages, setStarredMessages] = useState<StarredMessage[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchStarredMessages = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch starred message IDs first
      const { data: starredData, error: starredError } = await supabase
        .from('starred_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (starredError) throw starredError;

      if (!starredData || starredData.length === 0) {
        setStarredMessages([]);
        setStarredIds(new Set());
        setLoading(false);
        return;
      }

      // Separate DM and group message IDs
      const dmIds = starredData
        .filter(s => s.message_type === 'dm' && s.message_id)
        .map(s => s.message_id!);
      const groupIds = starredData
        .filter(s => s.message_type === 'group' && s.group_message_id)
        .map(s => s.group_message_id!);

      // Fetch DM messages with sender info
      let dmMessages: any[] = [];
      if (dmIds.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            media_url,
            media_type,
            created_at,
            conversation_id,
            sender_id,
            profiles:sender_id(display_name, avatar_url)
          `)
          .in('id', dmIds);
        dmMessages = data || [];
      }

      // Fetch group messages with sender and group info
      let groupMessages: any[] = [];
      if (groupIds.length > 0) {
        const { data } = await supabase
          .from('group_messages')
          .select(`
            id,
            content,
            media_url,
            media_type,
            created_at,
            group_id,
            sender_id,
            profiles:sender_id(display_name, avatar_url),
            groups:group_id(name)
          `)
          .in('id', groupIds);
        groupMessages = data || [];
      }

      // Build starred messages array
      const messages: StarredMessage[] = [];
      const ids = new Set<string>();

      for (const starred of starredData) {
        if (starred.message_type === 'dm' && starred.message_id) {
          const msg = dmMessages.find(m => m.id === starred.message_id);
          if (msg) {
            ids.add(starred.message_id);
            messages.push({
              id: starred.id,
              messageId: starred.message_id,
              messageType: 'dm',
              conversationId: msg.conversation_id,
              content: msg.content || '',
              mediaUrl: msg.media_url,
              mediaType: msg.media_type,
              senderName: msg.profiles?.display_name || 'Unknown',
              senderAvatar: msg.profiles?.avatar_url,
              createdAt: msg.created_at,
              starredAt: starred.created_at,
            });
          }
        } else if (starred.message_type === 'group' && starred.group_message_id) {
          const msg = groupMessages.find(m => m.id === starred.group_message_id);
          if (msg) {
            ids.add(starred.group_message_id);
            messages.push({
              id: starred.id,
              messageId: starred.group_message_id,
              messageType: 'group',
              groupId: msg.group_id,
              groupName: msg.groups?.name,
              content: msg.content || '',
              mediaUrl: msg.media_url,
              mediaType: msg.media_type,
              senderName: msg.profiles?.display_name || 'Unknown',
              senderAvatar: msg.profiles?.avatar_url,
              createdAt: msg.created_at,
              starredAt: starred.created_at,
            });
          }
        }
      }

      setStarredMessages(messages);
      setStarredIds(ids);
    } catch (error) {
      console.error('Error fetching starred messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStarredMessages();
  }, [fetchStarredMessages]);

  const isStarred = useCallback((messageId: string, type: 'dm' | 'group') => {
    return starredIds.has(messageId);
  }, [starredIds]);

  const toggleStar = useCallback(async (
    messageId: string,
    type: 'dm' | 'group',
    conversationId?: string,
    groupId?: string
  ) => {
    if (!user) return;

    const isCurrentlyStarred = isStarred(messageId, type);

    try {
      if (isCurrentlyStarred) {
        // Remove star
        const query = supabase
          .from('starred_messages')
          .delete()
          .eq('user_id', user.id);

        if (type === 'dm') {
          await query.eq('message_id', messageId);
        } else {
          await query.eq('group_message_id', messageId);
        }

        setStarredIds(prev => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        setStarredMessages(prev => prev.filter(m => m.messageId !== messageId));
        toast.success('Message unstarred');
      } else {
        // Add star
        const insertData: any = {
          user_id: user.id,
          message_type: type,
        };

        if (type === 'dm') {
          insertData.message_id = messageId;
          insertData.conversation_id = conversationId;
        } else {
          insertData.group_message_id = messageId;
          insertData.group_id = groupId;
        }

        const { error } = await supabase
          .from('starred_messages')
          .insert(insertData);

        if (error) throw error;

        setStarredIds(prev => new Set(prev).add(messageId));
        toast.success('Message starred');
        
        // Refresh to get full message details
        await fetchStarredMessages();
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      toast.error('Failed to update star');
    }
  }, [user, isStarred, fetchStarredMessages]);

  return {
    starredMessages,
    starredIds,
    loading,
    isStarred,
    toggleStar,
    refresh: fetchStarredMessages,
  };
}
