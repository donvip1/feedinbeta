import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Lock, Globe, Plus, Check, X, Search, MessageSquarePlus } from 'lucide-react';
import { ChatInterface } from '@/components/messages/ChatInterface';
import { ConversationList } from '@/components/messages/ConversationList';
import { NewConversationModal } from '@/components/messages/NewConversationModal';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';

// Types
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
  id: string; // This can be conversationId or userId for friends without a convo
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

export default function Messages() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);

  // Subscribe to friend request changes
  useRealtimeChannel({
    channelName: 'friend-requests-updates',
    table: 'friend_requests',
    onChange: () => loadData(),
  });

  useEffect(() => {
    const state = location.state as { sharedImage?: string };
    if (state?.sharedImage) {
      setSharedImageUrl(state.sharedImage);
      setShowNewConversation(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Open conversation from URL (e.g., notifications deep link)
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    const convoId = params.get('conversation');
    const userId = params.get('user');

    const openFromParams = async () => {
      if (convoId) {
        setSelectedConversationId(convoId);
        return;
      }
      if (userId) {
        const conv = await openOrCreateConversationWithUser(userId);
        if (conv) setSelectedConversationId(conv);
      }
    };

    openFromParams();
  }, [location.search, user]);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([
        loadFriendRequests().catch(err => console.error("Friend requests error:", err)),
        loadFriends().catch(err => console.error("Friends error:", err)),
        loadGroups().catch(err => console.error("Groups error:", err))
      ]);
    } catch (error: any) {
      console.error("Error loading page data:", error);
      toast({ title: "Error", description: "Could not load messages. Please refresh the page.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

 const loadFriendRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender:sender_id (id, display_name, username, avatar_url)
      `)
      .eq('receiver_id', user.id)
      .eq('status', 'pending');

    if (error) throw new Error(`Failed to load friend requests: ${error.message}`);
    setFriendRequests(data as any[] || []);
  };

  // Simplified - conversations now handled by ConversationList component
  const loadFriends = async () => {
    if (!user) return;

    const { data: sentRequests } = await supabase
      .from('friend_requests')
      .select('receiver:receiver_id(id, display_name, username, avatar_url)')
      .eq('sender_id', user.id)
      .eq('status', 'accepted');
    
    const { data: receivedRequests } = await supabase
      .from('friend_requests')
      .select('sender:sender_id(id, display_name, username, avatar_url)')
      .eq('receiver_id', user.id)
      .eq('status', 'accepted');

    const friends = [
      ...(sentRequests?.map((r: any) => r.receiver) || []),
      ...(receivedRequests?.map((r: any) => r.sender) || [])
    ].filter(Boolean) as Profile[];

    const friendsList = friends.map(friend => ({
      id: friend.id,
      type: 'friend' as const,
      participant: friend,
    }));

    setChatList(friendsList);
  };
  
  const findExistingConversationWithUser = async (otherUserId: string): Promise<string | null> => {
    if (!user) return null;
    const { data: myConvos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);
    const ids = myConvos?.map((r: any) => r.conversation_id) || [];
    if (ids.length === 0) return null;
    const { data: rows } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .in('conversation_id', ids)
      .eq('user_id', otherUserId)
      .limit(1);
    return rows && rows.length ? rows[0].conversation_id : null;
  };

  const openOrCreateConversationWithUser = async (otherUserId: string): Promise<string | null> => {
    if (!user) return null;
    // Try existing
    const existing = await findExistingConversationWithUser(otherUserId);
    if (existing) return existing;

    // Try RPC helper if available
    const { data: rpcId, error: rpcErr } = await supabase.rpc('create_conversation', { other_user_id: otherUserId });
    if (!rpcErr && rpcId) return rpcId as string;

    // Fallback: create convo and add current user as participant (other user will be added on first message or by backend job)
    const { data: conv, error: convErr } = await supabase.from('conversations').insert({}).select('id').single();
    if (convErr) {
      console.error('Failed to create conversation:', convErr);
      toast({ title: 'Error', description: 'Could not start a conversation.', variant: 'destructive' });
      return null;
    }
    await supabase.from('conversation_participants').insert({ conversation_id: conv.id, user_id: user.id });
    return conv.id as string;
  };

  const respondToRequest = async (requestId: string, accepted: boolean) => {
    try {
      const { error } = await supabase.from('friend_requests').update({ status: accepted ? 'accepted' : 'rejected' }).eq('id', requestId);
      if (error) throw error;

      if(accepted) {
         const request = friendRequests.find(r => r.id === requestId);
         if(request && user) {
            await supabase.from('notifications').insert([{
                user_id: request.sender.id, 
                from_user_id: user.id, 
                type: 'info', 
                title: 'Message Request Accepted',
                message: `${user.user_metadata.display_name} accepted your message request.`,
            }]);
         }
      }
      toast({ title: accepted ? "Message request accepted" : "Message request declined" });
      loadData();
    } catch (error) {
      console.error("Error responding to request:", error);
      toast({ title: "Error", description: "Could not process your response.", variant: "destructive" });
    }
  };

  const handleItemClick = async (item: ChatListItem) => {
    if (item.type === 'conversation') {
      setSelectedConversationId(item.id);
    } else {
      if (!user) return;
      try {
        const { data, error } = await supabase.rpc('create_conversation', { other_user_id: item.participant.id });
        if (error) throw error;
        await loadData();
        setSelectedConversationId(data);
      } catch (e) {
        console.error("Error starting new conversation:", e);
        toast({ title: "Error", description: "Could not start a conversation.", variant: "destructive" });
      }
    }
  };

  const loadGroups = async () => {
    if (!user) return;
    try {
      const { data: allGroups, error: allError } = await supabase.from('groups').select('*').order('member_count', { ascending: false });
      if (allError) throw allError;
      const { data: memberGroups, error: memberError } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
      if (memberError) throw memberError;
      const myGroupIds = memberGroups?.map(m => m.group_id) || [];
      setMyGroups(allGroups?.filter(g => myGroupIds.includes(g.id)) || []);
      setGroups(allGroups?.filter(g => !myGroupIds.includes(g.id)) || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const filteredChatList = chatList.filter(item =>
    item.participant && (
      item.participant.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.participant.username?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredMyGroups = myGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDiscoverGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));


  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <div className={`flex flex-col w-full md:w-96 border-r border-border ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/feed')}><ArrowLeft className="w-5 h-5" /></Button>
            <h1 className="text-xl font-bold">Chats & Groups</h1>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={() => activeTab === 'chats' ? setShowNewConversation(true) : setShowCreateGroup(true)}><Plus className="w-5 h-5" /></Button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={`Search ${activeTab}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9"/>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="chats">Chats</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="stories">Stories</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="chats" className="m-0">
              {friendRequests.length > 0 && (
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Friend Requests</h3>
                  {friendRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                       <Avatar onClick={() => navigate(`/profile/${req.sender.id}`)} className="cursor-pointer">
                        <AvatarImage src={req.sender.avatar_url || undefined} />
                        <AvatarFallback>{req.sender.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left overflow-hidden" onClick={() => navigate(`/profile/${req.sender.id}`)}>
                        <p className="font-semibold truncate">{req.sender.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{req.sender.username}</p>
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <Button size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600" onClick={() => respondToRequest(req.id, true)}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => respondToRequest(req.id, false)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {user && (
                <ConversationList 
                  userId={user.id}
                  searchQuery={searchQuery}
                  onSelectConversation={setSelectedConversationId}
                />
              )}

              {filteredChatList.length === 0 && friendRequests.length === 0 && (
                 <div className="text-center py-12 text-muted-foreground">No chats or requests. Start a new conversation!</div>
              )}
            </TabsContent>

            <TabsContent value="groups" className="m-0">
                {/* Groups content will be added here */}
            </TabsContent>

            <TabsContent value="stories" className="m-0">
              <StoriesBar />
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <ChatInterface conversationId={selectedConversationId} onBack={() => setSelectedConversationId(null)} />
        ) : (
          <div className="hidden md:flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquarePlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Select a conversation or a friend to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <NewConversationModal open={showNewConversation} onClose={() => { setShowNewConversation(false); setSharedImageUrl(null); }} onSelectUser={(userId) => handleItemClick({ id: userId, type: 'friend', participant: { id: userId, display_name: null, username: null, avatar_url: null }})} initialImageUrl={sharedImageUrl} />
      <CreateGroupModal open={showCreateGroup} onOpenChange={setShowCreateGroup} onSuccess={loadGroups} />
    </div>
  );
}
