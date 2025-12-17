import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Search, ArrowLeft, Users, Lock, Globe, Plus } from 'lucide-react';
import { ChatInterface } from '@/components/messages/ChatInterface';
import { ModernChatInterface } from '@/components/messages/ModernChatInterface';
import { NewConversationModal } from '@/components/messages/NewConversationModal';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { UnreadBadge } from '@/components/shared/UnreadBadge';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  updated_at: string;
  other_participant: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);

  // Handle shared image from location state
  useEffect(() => {
    const state = location.state as { sharedImage?: string; conversationId?: string };
    if (state?.sharedImage) {
      setSharedImageUrl(state.sharedImage);
      setShowNewConversation(true);
      // Clear the state
      navigate(location.pathname, { replace: true });
    }
    
    // Handle navigation from notification to specific conversation
    if (state?.conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === state.conversationId);
      if (conversation) {
        setSelectedConversationId(state.conversationId);
        setActiveTab('chats');
      }
      // Clear the state
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, conversations]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadGroups();
      
      // Subscribe to new messages to update unread counts
      const channel = supabase
        .channel('messages-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          () => {
            loadConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages'
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: participantData, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id, conversations!inner(id, updated_at)')
        .eq('user_id', user.id);

      if (error) throw error;

      // Deduplicate conversation IDs
      const conversationIds = [...new Set(participantData?.map(p => p.conversation_id) || [])];
      
      const conversationsWithDetails = await Promise.all(
        conversationIds.map(async (convId) => {
          // Get other participant's user_id first
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', convId)
            .neq('user_id', user.id)
            .maybeSingle();

          // Now fetch the profile separately using the user_id
          let participantProfile = null;
          if (otherParticipant?.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url')
              .eq('id', otherParticipant.user_id)
              .maybeSingle();
            participantProfile = profile;
          }

          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Count unread messages
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convId)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          const conv = participantData?.find(p => p.conversation_id === convId);

          return {
            id: convId,
            updated_at: conv?.conversations?.updated_at || '',
            other_participant: {
              id: participantProfile?.id || otherParticipant?.user_id || '',
              display_name: participantProfile?.display_name || 'Unknown',
              username: participantProfile?.username || null,
              avatar_url: participantProfile?.avatar_url || null,
            },
            last_message: lastMessage || undefined,
            unread_count: unreadCount || 0,
          };
        })
      );

      setConversations(conversationsWithDetails.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ));
    } catch (error: any) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = async (userId: string) => {
    if (!user) return;

    try {
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .in('user_id', [user.id, userId]);

      if (existingParticipants && existingParticipants.length > 0) {
        const conversationCounts: { [key: string]: number } = {};
        existingParticipants.forEach(p => {
          conversationCounts[p.conversation_id] = (conversationCounts[p.conversation_id] || 0) + 1;
        });

        const existingConvId = Object.keys(conversationCounts).find(
          convId => conversationCounts[convId] === 2
        );

        if (existingConvId) {
          setSelectedConversationId(existingConvId);
          setShowNewConversation(false);
          return;
        }
      }

      // Use secure function to create conversation
      const { data: conversationId, error } = await supabase.rpc('create_conversation', {
        other_user_id: userId
      });

      if (error) throw error;

      await loadConversations();
      setSelectedConversationId(conversationId);
      setShowNewConversation(false);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      
      // Check if it's a mutual friends error
      const errorMessage = error?.message || '';
      const isFriendshipError = errorMessage.includes('mutual friends') || 
                                errorMessage.includes('friend') ||
                                error?.code === 'P0001';
      
      toast({
        title: isFriendshipError ? 'Not Friends Yet' : 'Unable to create conversation',
        description: isFriendshipError 
          ? 'You can only chat with users who are your friends. Please send them a friend request first, and both of you must accept each other as friends.'
          : 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const loadGroups = async () => {
    if (!user) return;
    
    try {
      const { data: allGroups, error: allError } = await supabase
        .from('groups')
        .select('*')
        .order('member_count', { ascending: false });

      if (allError) throw allError;

      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const myGroupIds = memberGroups?.map(m => m.group_id) || [];
      const userGroups = allGroups?.filter(g => myGroupIds.includes(g.id)) || [];
      const otherGroups = allGroups?.filter(g => !myGroupIds.includes(g.id)) || [];

      setMyGroups(userGroups);
      setGroups(otherGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_participant.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_participant.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMyGroups = myGroups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/feed')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Chats & Groups</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => activeTab === 'chats' ? setShowNewConversation(true) : setShowCreateGroup(true)}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquarePlus className="w-12 h-12 mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowNewConversation(true)}
                  >
                    Start a conversation
                  </Button>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={async () => {
                      setSelectedConversationId(conv.id);
                      // Mark messages as read when conversation is opened
                      if (user && conv.unread_count && conv.unread_count > 0) {
                        await supabase
                          .from('messages')
                          .update({ is_read: true, read_at: new Date().toISOString() })
                          .eq('conversation_id', conv.id)
                          .neq('sender_id', user.id)
                          .eq('is_read', false);
                        loadConversations();
                      }
                    }}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors ${
                      selectedConversationId === conv.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={conv.other_participant.avatar_url || ''} />
                        <AvatarFallback>
                          {conv.other_participant.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread_count && conv.unread_count > 0 && (
                        <UnreadBadge count={conv.unread_count} size="sm" />
                      )}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate">
                          {conv.other_participant.display_name || 'Unknown User'}
                        </p>
                        {conv.last_message && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(conv.last_message.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className={`text-sm truncate ${conv.unread_count && conv.unread_count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {conv.last_message.sender_id === user?.id ? 'You: ' : ''}
                          {conv.last_message.content}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </TabsContent>

            <TabsContent value="groups" className="m-0">
              {filteredMyGroups.length > 0 && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">My Groups</h3>
                  {filteredMyGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors rounded-lg mb-2"
                    >
                      <Avatar>
                        <AvatarImage src={group.avatar_url} />
                        <AvatarFallback>{group.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{group.name}</p>
                          {group.is_private ? (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Globe className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{group.member_count} members</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Discover</h3>
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No groups found
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors rounded-lg mb-2"
                    >
                      <Avatar>
                        <AvatarImage src={group.avatar_url} />
                        <AvatarFallback>{group.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{group.name}</p>
                          {group.requires_subscription && (
                            <Badge variant="secondary" className="text-xs">Premium</Badge>
                          )}
                          {group.is_private ? (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Globe className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Users className="w-3 h-3" />
                          <span>{group.member_count} members</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
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
          <ModernChatInterface
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="hidden md:flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquarePlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <NewConversationModal
        open={showNewConversation}
        onClose={() => {
          setShowNewConversation(false);
          setSharedImageUrl(null);
        }}
        onSelectUser={handleNewConversation}
        initialImageUrl={sharedImageUrl}
      />

      <CreateGroupModal
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onSuccess={loadGroups}
      />
    </div>
  );
}
