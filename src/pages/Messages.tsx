import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Search, ArrowLeft, Users, Lock, Globe, Plus, CheckCheck } from 'lucide-react';
import { ModernChatInterface } from '@/components/messages/ModernChatInterface';
import { NewConversationModal } from '@/components/messages/NewConversationModal';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { UnreadBadge } from '@/components/shared/UnreadBadge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { useConversationCache, useGroupCache } from '@/hooks/useConversationCache';
import { useConversationListRealtime } from '@/hooks/useMessageRealtime';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityBadge, ActivityType, getActivityIcon, getActivityColor } from '@/components/messages/TypingIndicator';
import { usePageRefresh } from '@/context/RefreshContext';
import { realtimeManager } from '@/lib/unified-realtime';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { QueryErrorFallback } from '@/components/shared/QueryErrorFallback';

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
  isOnline?: boolean;
  isTyping?: boolean;
  activityType?: ActivityType;
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
  
  // Cache hooks for instant loading
  const { cachedConversations, hasCachedData, saveToCache } = useConversationCache();
  const { cachedGroups, cachedMyGroups, hasGroupCache, saveGroupsToCache } = useGroupCache();
  
  // Initialize with cached data for instant display
  const [conversations, setConversations] = useState<Conversation[]>(cachedConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(!hasCachedData); // Only show loading if no cache
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [groups, setGroups] = useState<Group[]>(cachedGroups);
  const [myGroups, setMyGroups] = useState<Group[]>(cachedMyGroups);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const handledLocationStateRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Subscribe to silent refresh from navigation
  usePageRefresh('chats', useCallback(() => {
    // Silent background refresh - no loading indicator
    loadConversations(false);
    loadGroups();
  }, []));

  // Handle shared image from location state - only once on mount
  useEffect(() => {
    if (handledLocationStateRef.current) return;
    
    const state = location.state as { sharedImage?: string; conversationId?: string };
    if (state?.sharedImage) {
      setSharedImageUrl(state.sharedImage);
      setShowNewConversation(true);
      handledLocationStateRef.current = true;
      // Clear the state without causing navigation
      window.history.replaceState({}, '', location.pathname);
    }
    
    if (state?.conversationId) {
      setSelectedConversationId(state.conversationId);
      setActiveTab('chats');
      handledLocationStateRef.current = true;
      // Clear the state without causing navigation
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.pathname, location.state]);

  // Enable chat mode for fixed positioning
  useEffect(() => {
    document.body.classList.add('chat-mode');
    return () => {
      document.body.classList.remove('chat-mode');
    };
  }, []);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Initialize realtime manager for this user
  useEffect(() => {
    if (user?.id) {
      realtimeManager.initialize(user.id);
    }
  }, [user?.id]);

  // Track my own presence so others know I'm online
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel(`user-presence:${user.id}`)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.id]);

  // Update conversations state when cache loads
  useEffect(() => {
    if (hasCachedData && cachedConversations.length > 0 && conversations.length === 0) {
      setConversations(cachedConversations);
      setLoading(false);
    }
  }, [hasCachedData, cachedConversations]);

  // Update groups state when cache loads
  useEffect(() => {
    if (hasGroupCache) {
      if (cachedGroups.length > 0 && groups.length === 0) setGroups(cachedGroups);
      if (cachedMyGroups.length > 0 && myGroups.length === 0) setMyGroups(cachedMyGroups);
    }
  }, [hasGroupCache, cachedGroups, cachedMyGroups]);

  // Handle new message from unified realtime
  const handleRealtimeMessage = useCallback((message: { conversation_id: string; content: string; created_at: string; sender_id: string }) => {
    console.log('[Messages Page] Realtime message:', message.conversation_id);
    
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === message.conversation_id) {
          const isFromOther = message.sender_id !== user?.id;
          return {
            ...conv,
            updated_at: message.created_at,
            last_message: {
              content: message.content,
              created_at: message.created_at,
              sender_id: message.sender_id,
            },
            // Only increment unread if message is from other user and not viewing this conversation
            unread_count: isFromOther && selectedConversationId !== message.conversation_id 
              ? (conv.unread_count || 0) + 1 
              : conv.unread_count,
          };
        }
        return conv;
      });
      // Sort by most recent
      return updated.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [user?.id, selectedConversationId]);

  // Handle typing indicator from unified realtime
  const handleRealtimeTyping = useCallback((typing: { user_id: string; conversation_id: string; is_typing: boolean; activity_type?: string }) => {
    if (typing.user_id === user?.id) return;
    
    setConversations(prev => prev.map(conv => 
      conv.id === typing.conversation_id 
        ? { 
            ...conv, 
            isTyping: typing.is_typing,
            activityType: typing.activity_type as ActivityType || 'typing'
          } 
        : conv
    ));
  }, [user?.id]);

  // Use unified realtime hook - SINGLE subscription for conversation list
  useConversationListRealtime({
    onNewMessage: handleRealtimeMessage,
    onTyping: handleRealtimeTyping,
  });

  // Initial data load
  useEffect(() => {
    if (user && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      // Load fresh data in background (don't show loading if we have cache)
      loadConversations(!hasCachedData);
      loadGroups();
    }
  }, [user, hasCachedData]);

  // Subscribe to presence for each conversation participant using unified manager
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    conversations.forEach(conv => {
      if (!conv.other_participant?.id) return;
      
      const unsubscribe = realtimeManager.subscribeToPresence(
        conv.other_participant.id,
        ({ isOnline }) => {
          setConversations(prev => prev.map(c => 
            c.id === conv.id ? { ...c, isOnline } : c
          ));
        }
      );
      
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user?.id, conversations.length]);

  const loadConversations = async (showLoading = true) => {
    if (!user) return;

    if (showLoading) setLoading(true);
    setLoadError(null);
    try {
      // Use optimized RPC function - single query instead of 4+ per conversation
      const { data, error } = await supabase
        .rpc('get_conversations_with_details', { p_user_id: user.id });

      if (error) throw error;

      const sortedConversations = (data || []).map((row: any) => ({
        id: row.conversation_id,
        updated_at: row.updated_at,
        other_participant: {
          id: row.other_user_id || '',
          display_name: row.other_user_display_name || 'Unknown',
          username: row.other_user_username || null,
          avatar_url: row.other_user_avatar_url || null,
        },
        last_message: row.last_message_content ? {
          content: row.last_message_content,
          created_at: row.last_message_created_at,
          sender_id: row.last_message_sender_id,
        } : undefined,
        unread_count: row.unread_count || 0,
      }));

      setConversations(sortedConversations);
      // Save to cache for instant loading next time
      saveToCache(sortedConversations);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      setLoadError(error);
      // Show error toast only if we have no cached data
      if (conversations.length === 0) {
        toast({
          title: 'Failed to load conversations',
          description: 'Please check your connection and try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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

      // Fetch the new user's profile for local state update
      const { data: newUserProfile } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', userId)
        .single();

      // Add new conversation to state without reloading
      const newConversation: Conversation = {
        id: conversationId,
        updated_at: new Date().toISOString(),
        other_participant: {
          id: userId,
          display_name: newUserProfile?.display_name || 'Unknown',
          username: newUserProfile?.username || null,
          avatar_url: newUserProfile?.avatar_url || null,
        },
        unread_count: 0,
      };

      setConversations(prev => [newConversation, ...prev]);
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
      // Save to cache
      saveGroupsToCache(otherGroups, userGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const markAllMessagesAsRead = async () => {
    if (!user) return;
    
    try {
      // Get all conversation IDs with unread messages
      const conversationsWithUnread = conversations.filter(c => (c.unread_count || 0) > 0);
      
      if (conversationsWithUnread.length === 0) return;
      
      // Mark all unread messages as read using the RPC function for each conversation
      await Promise.all(
        conversationsWithUnread.map(conv => 
          supabase.rpc('mark_conversation_read', { conv_id: conv.id })
        )
      );
      
      // Update local state
      setConversations(prev => prev.map(conv => ({ ...conv, unread_count: 0 })));
      
      toast({
        title: 'All messages marked as read',
      });
    } catch (error) {
      console.error('Error marking all messages as read:', error);
    }
  };

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

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

  // Only show full loading screen if no cached data and still loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show skeleton only if loading and no cached conversations
  const showSkeleton = loading && conversations.length === 0;

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
            <div className="flex items-center gap-1">
              {activeTab === 'chats' && totalUnreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={markAllMessagesAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => activeTab === 'chats' ? setShowNewConversation(true) : setShowCreateGroup(true)}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
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
              <TabsTrigger value="chats" className="relative">
                Chats
                {totalUnreadCount > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="stories">Stories</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="chats" className="m-0">
              {loadError && conversations.length === 0 ? (
                <div className="p-4">
                  <QueryErrorFallback 
                    error={loadError} 
                    onRetry={() => loadConversations()} 
                    compact 
                  />
                </div>
              ) : showSkeleton ? (
                // Skeleton loading for instant perceived performance
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-full p-4 flex items-start gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
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
                    onClick={() => {
                      setSelectedConversationId(conv.id);
                      // Mark messages as read locally and in database without reloading
                      if (user && conv.unread_count != null && conv.unread_count > 0) {
                        // Update local state immediately
                        setConversations(prev => prev.map(c => 
                          c.id === conv.id ? { ...c, unread_count: 0 } : c
                        ));
                        // Update database in background (no await)
                        supabase
                          .from('messages')
                          .update({ is_read: true, read_at: new Date().toISOString() })
                          .eq('conversation_id', conv.id)
                          .neq('sender_id', user.id)
                          .eq('is_read', false)
                          .then(() => {});
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
                      {/* Online indicator */}
                      {conv.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                      )}
                      {conv.unread_count != null && conv.unread_count > 0 ? (
                        <UnreadBadge count={conv.unread_count} size="sm" />
                      ) : null}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">
                            {conv.other_participant.display_name || 'Unknown User'}
                          </p>
                          {conv.isOnline && (
                            <span className="text-[10px] text-emerald-500 font-medium">online</span>
                          )}
                        </div>
                        {conv.last_message && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(conv.last_message.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {conv.isTyping ? (
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <span className={getActivityColor(conv.activityType || 'typing')}>
                            {getActivityIcon(conv.activityType || 'typing')}
                          </span>
                          <span className={`text-xs ${getActivityColor(conv.activityType || 'typing')}`}>
                            {conv.activityType === 'typing' ? 'typing...' :
                             conv.activityType === 'emoji' ? 'choosing emoji...' :
                             conv.activityType === 'sticker' ? 'picking sticker...' :
                             conv.activityType === 'voice_recording' ? 'recording voice...' :
                             conv.activityType === 'uploading_image' ? 'sending image...' :
                             conv.activityType === 'uploading_video' ? 'sending video...' :
                             conv.activityType === 'uploading_file' ? 'sending file...' :
                             conv.activityType === 'focused' ? 'composing...' :
                             'typing...'}
                          </span>
                        </div>
                      ) : conv.last_message ? (
                        <p className={`text-sm truncate ${conv.unread_count != null && conv.unread_count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {conv.last_message.sender_id === user?.id ? 'You: ' : ''}
                          {conv.last_message.content}
                        </p>
                      ) : null}
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
            onMessagesRead={() => {
              // Clear unread count for this conversation
              setConversations(prev => prev.map(conv => 
                conv.id === selectedConversationId 
                  ? { ...conv, unread_count: 0 }
                  : conv
              ));
            }}
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
      
      <BottomNav transparent={false} />
    </div>
  );
}
