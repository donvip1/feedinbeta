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
        loadChatList(),
        loadGroups()
      ]);
    } catch (error) {
      console.error("Error loading page data:", error);
      toast({ title: "Error", description: "Could not load your data. Please refresh the page.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const loadFriendRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, sender:profiles!friend_requests_sender_id_fkey(id, display_name, username, avatar_url)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');
    if (error) throw error;
    setFriendRequests(data as FriendRequest[] || []);
  };

  const loadChatList = async () => {
    if (!user) return;

    // 1. Get all friends
    const { data: friendData, error: friendError } = await supabase.rpc('get_friends', { p_user_id: user.id });
    if (friendError) throw friendError;
    const friends = friendData || [];

    // 2. Get all conversations
    const { data: convoData, error: convoError } = await supabase.rpc('get_conversations', { p_user_id: user.id });
    if (convoError) throw convoError;
    const conversations = convoData || [];

    // 3. Merge friends and conversations
    const chatMap = new Map<string, ChatListItem>();

    // Add conversations to the map
    conversations.forEach(c => {
      chatMap.set(c.other_participant.id, {
        id: c.conversation_id,
        type: 'conversation',
        updated_at: c.last_message_created_at,
        participant: c.other_participant,
        last_message: c.last_message_content ? {
          content: c.last_message_content,
          created_at: c.last_message_created_at,
          sender_id: c.last_message_sender_id,
        } : undefined,
      });
    });

    // Add friends who don't have a conversation yet
    friends.forEach(f => {
      if (!chatMap.has(f.id)) {
        chatMap.set(f.id, {
          id: f.id, // Use friend's user ID as the key for starting a new chat
          type: 'friend',
          participant: f,
        });
      }
    });
    
    const combinedList = Array.from(chatMap.values());

    // Sort: conversations with messages first, then friends. Sort by date.
    combinedList.sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
    });

    setChatList(combinedList);
  };

  const respondToRequest = async (requestId: string, accepted: boolean) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: accepted ? 'accepted' : 'rejected' })
        .eq('id', requestId);
      if (error) throw error;

      if(accepted) {
         const request = friendRequests.find(r => r.id === requestId);
         if(request && user) {
            await supabase.from('notifications').insert({
                user_id: request.sender.id,
                type: 'info',
                message: `${user.user_metadata.display_name} accepted your friend request.`,
            });
         }
      }

      toast({ title: accepted ? "Friend request accepted" : "Friend request declined" });
      loadData(); // Reload all data
    } catch (error) {
      console.error("Error responding to request:", error);
      toast({ title: "Error", description: "Could not process your response.", variant: "destructive" });
    }
  };

  const handleItemClick = async (item: ChatListItem) => {
    if (item.type === 'conversation') {
      setSelectedConversationId(item.id);
    } else {
      // It's a friend without a conversation, so create one.
      if (!user) return;
      try {
        const { data, error } = await supabase.rpc('create_conversation', { other_user_id: item.participant.id });
        if (error) throw error;
        await loadData(); // Refresh the list
        setSelectedConversationId(data);
      } catch (e) {
        console.error("Error starting new conversation:", e);
        toast({ title: "Error", description: "Could not start a conversation.", variant: "destructive" });
      }
    }
  };

  const loadGroups = async () => { /* ... existing loadGroups logic ... */ };

  const filteredChatList = chatList.filter(item =>
    item.participant.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.participant.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
      /* ... existing loading UI ... */
  }

  return (
    <div className="flex h-screen bg-background">
      <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border`}>
         {/* ... existing header ... */}
        <ScrollArea className="flex-1">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="chats" className="m-0">
              {/* Friend Requests Section */}
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

              {/* Chat List Section */}
              {filteredChatList.map(item => (
                <button key={item.id} onClick={() => handleItemClick(item)} className="w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors rounded-lg">
                  <Avatar>
                    <AvatarImage src={item.participant.avatar_url || undefined} />
                    <AvatarFallback>{item.participant.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="font-semibold truncate">{item.participant.display_name}</p>
                    {item.last_message ? (
                      <p className="text-xs text-muted-foreground truncate">{item.last_message.content}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">@{item.participant.username}</p>
                    )}
                  </div>
                  {item.last_message && <time className="text-xs text-muted-foreground self-start">{new Date(item.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}
                </button>
              ))}
              {filteredChatList.length === 0 && friendRequests.length === 0 && (
                 <div className="text-center py-12 text-muted-foreground">No chats or requests.</div>
              )}
            </TabsContent>

            {/* ... other tabs (groups, stories) ... */}
          </Tabs>
        </ScrollArea>
      </div>
      
      {/* ... rest of the component ... */}
       <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <EnhancedChatInterface
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="hidden md:flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquarePlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Select a conversation or a friend to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
