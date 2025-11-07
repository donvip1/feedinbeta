import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Search, ArrowLeft, Users, Lock, Globe, Plus, Check, X } from 'lucide-react';
import { EnhancedChatInterface } from '@/components/messages/EnhancedChatInterface';
import { NewConversationModal } from '@/components/messages/NewConversationModal';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useToast } from '@/hooks/use-toast';

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

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([
        loadFriendRequests(),
        loadChatListAndFriends(),
        loadGroups()
      ]);
    } catch (error: any) {
      console.error("Error loading page data:", error);
      toast({ title: "Error", description: `Could not load your data: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      loadData();
      const subscription = supabase.channel('public:friend_requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, loadData)
        .subscribe();
      return () => {
        supabase.removeChannel(subscription);
      };
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

  const loadChatListAndFriends = async () => {
    if (!user) return;

    const { data: convosData, error: convosError } = await supabase
      .from('conversation_participants')
      .select('conversations!inner(*)')
      .eq('user_id', user.id);

    if (convosError) throw new Error(`Failed to load conversations: ${convosError.message}`);

    const conversations = convosData.map((c: any) => c.conversations);

    const chatListItems = await Promise.all(conversations.map(async (convo: any) => {
        const { data: otherParticipantData } = await supabase
            .from('conversation_participants')
            .select(`
              participant:user_id (id, display_name, username, avatar_url)
            `)
            .eq('conversation_id', convo.id)
            .neq('user_id', user.id)
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

    const { data: sentRequests, error: sentError } = await supabase.from('friend_requests').select('receiver:receiver_id(id, display_name, username, avatar_url)').eq('sender_id', user.id).eq('status', 'accepted');
    const { data: receivedRequests, error: receivedError } = await supabase.from('friend_requests').select('sender:sender_id(id, display_name, username, avatar_url)').eq('receiver_id', user.id).eq('status', 'accepted');

    if(sentError || receivedError) throw new Error('Could not retrieve friends list');
    
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
      <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border`}>
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

              {filteredChatList.map(item => (
                <button key={item.id} onClick={() => handleItemClick(item)} className="w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors rounded-lg">
                  <Avatar>
                    <AvatarImage src={item.participant?.avatar_url || undefined} />
                    <AvatarFallback>{item.participant?.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="font-semibold truncate">{item.participant?.display_name}</p>
                    {item.last_message ? (
                      <p className="text-xs text-muted-foreground truncate">{item.last_message.content}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">@{item.participant?.username}</p>
                    )}
                  </div>
                  {item.last_message && <time className="text-xs text-muted-foreground self-start">{new Date(item.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}
                </button>
              ))}
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
          <EnhancedChatInterface conversationId={selectedConversationId} onBack={() => setSelectedConversationId(null)} />
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
