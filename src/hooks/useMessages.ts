import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface FriendRequest {
  id: string;
  sender: Profile;
}

interface ChatListItem {
  id: string;
  type: 'conversation' | 'friend';
  updated_at?: string;
  participant: Profile;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
}

interface Group {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  is_private: boolean;
  requires_subscription: boolean;
  member_count: number;
  post_count: number;
}

export const useMessages = (userId?: string) => {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadFriendRequests = useCallback(async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender:sender_id (id, display_name, username, avatar_url)
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (error) throw new Error(`Failed to load friend requests: ${error.message}`);
    setFriendRequests(data as any[] || []);
  }, [userId]);

  const loadChatListAndFriends = useCallback(async () => {
    if (!userId) return;

    const { data: convosData, error: convosError } = await supabase
      .from('conversation_participants')
      .select('conversations!inner(*)')
      .eq('user_id', userId);

    if (convosError) throw new Error(`Failed to load conversations: ${convosError.message}`);

    const conversations = convosData.map((c: any) => c.conversations);

    const chatListItems = await Promise.all(conversations.map(async (convo: any) => {
      const { data: otherParticipantData } = await supabase
        .from('conversation_participants')
        .select(`participant:user_id (id, display_name, username, avatar_url)`)
        .eq('conversation_id', convo.id)
        .neq('user_id', userId)
        .maybeSingle();

      const { data: lastMessage } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otherParticipantData?.participant) return null;

      return {
        id: convo.id,
        type: 'conversation',
        updated_at: convo.updated_at,
        participant: otherParticipantData.participant,
        last_message: lastMessage,
      } as ChatListItem;
    }));

    const validChatListItems = chatListItems.filter(Boolean) as ChatListItem[];

    const { data: sentRequests } = await supabase
      .from('friend_requests')
      .select('receiver:receiver_id(id, display_name, username, avatar_url)')
      .eq('sender_id', userId)
      .eq('status', 'accepted');
    
    const { data: receivedRequests } = await supabase
      .from('friend_requests')
      .select('sender:sender_id(id, display_name, username, avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'accepted');

    const friends = [
      ...(sentRequests?.map((r: any) => r.receiver) || []),
      ...(receivedRequests?.map((r: any) => r.sender) || [])
    ].filter(Boolean) as Profile[];

    const chatMap = new Map<string, ChatListItem>();
    validChatListItems.forEach(item => chatMap.set(item.participant.id, item));
    friends.forEach(friend => {
      if (!chatMap.has(friend.id)) {
        chatMap.set(friend.id, { id: friend.id, type: 'friend', participant: friend });
      }
    });

    const combinedList = Array.from(chatMap.values());
    combinedList.sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    });

    setChatList(combinedList);
  }, [userId]);

  const loadGroups = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data: allGroups, error: allError } = await supabase
        .from('groups')
        .select('*')
        .order('member_count', { ascending: false });
      
      if (allError) throw allError;
      
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);
      
      if (memberError) throw memberError;
      
      const myGroupIds = memberGroups?.map(m => m.group_id) || [];
      setMyGroups(allGroups?.filter(g => myGroupIds.includes(g.id)) || []);
      setGroups(allGroups?.filter(g => !myGroupIds.includes(g.id)) || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  }, [userId]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      await Promise.all([
        loadFriendRequests().catch(err => console.error('Friend requests error:', err)),
        loadChatListAndFriends().catch(err => console.error('Chat list error:', err)),
        loadGroups().catch(err => console.error('Groups error:', err))
      ]);
    } catch (error: any) {
      console.error('Error loading page data:', error);
      toast({ 
        title: 'Error', 
        description: 'Could not load messages. Please refresh the page.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [userId, loadFriendRequests, loadChatListAndFriends, loadGroups, toast]);

  return {
    chatList,
    friendRequests,
    groups,
    myGroups,
    loading,
    loadData,
    setChatList,
    setFriendRequests,
  };
};
