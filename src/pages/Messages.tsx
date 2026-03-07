import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Search, ArrowLeft, Users, Lock, Globe, Plus, CheckCheck, Shield, MoreVertical, ChevronLeft, Archive, Bell, Settings, UserPlus, Users2 } from 'lucide-react';
import { MessageSettingsSheet } from '@/components/messages/MessageSettingsSheet';
import { ModernChatInterface } from '@/components/messages/ModernChatInterface';
import { NewConversationModal } from '@/components/messages/NewConversationModal';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { TikTokStoriesBar } from '@/components/stories/TikTokStoriesBar';
import { InboxActivitySection } from '@/components/messages/InboxActivitySection';
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
import { MessagingTabs } from '@/components/messages/MessagingTabs';
import { TikTokConversationItem } from '@/components/messages/TikTokConversationItem';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
  is_archived?: boolean;
  is_muted?: boolean;
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
  const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'live'>('chats');
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const [secretMode, setSecretMode] = useState(false);
  const [showMessageSettings, setShowMessageSettings] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
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
    
    const state = location.state as { 
      sharedImage?: string; 
      conversationId?: string; 
      highlightMessageId?: string 
    };
    
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
      
      // Handle highlight message ID for deep-linking to specific messages
      if (state?.highlightMessageId) {
        setHighlightMessageId(state.highlightMessageId);
      }
      
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
            // Auto-unarchive on new message from other user
            is_archived: isFromOther ? false : conv.is_archived,
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
      const [rpcResult, participantResult] = await Promise.all([
        supabase.rpc('get_conversations_with_details', { p_user_id: user.id }),
        supabase
          .from('conversation_participants')
          .select('conversation_id, is_archived, is_muted, muted_until')
          .eq('user_id', user.id),
      ]);

      if (rpcResult.error) throw rpcResult.error;

      // Build a lookup for archive/mute state
      const participantMap = new Map<string, { is_archived: boolean; is_muted: boolean; muted_until: string | null }>();
      (participantResult.data || []).forEach((p: any) => {
        const mutedUntil = p.muted_until ? new Date(p.muted_until) : null;
        const stillMuted = p.is_muted && (!mutedUntil || mutedUntil > new Date());
        participantMap.set(p.conversation_id, {
          is_archived: p.is_archived || false,
          is_muted: stillMuted,
          muted_until: p.muted_until,
        });
      });

      const sortedConversations = (rpcResult.data || []).map((row: any) => {
        const pState = participantMap.get(row.conversation_id);
        return {
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
          is_archived: pState?.is_archived || false,
          is_muted: pState?.is_muted || false,
        };
      });

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

  const handleArchiveConversation = async (conversationId: string) => {
    if (!user) return;
    const conv = conversations.find(c => c.id === conversationId);
    const newState = !conv?.is_archived;
    
    // Optimistic update
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, is_archived: newState } : c
    ));
    
    await supabase
      .from('conversation_participants')
      .update({ is_archived: newState })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    
    toast({ title: newState ? 'Chat archived' : 'Chat unarchived' });
  };

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  const archivedConversations = conversations.filter(c => c.is_archived);
  const activeConversations = conversations.filter(c => !c.is_archived);

  const filteredConversations = (showArchived ? archivedConversations : activeConversations).filter(conv =>
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
    <div className={cn(
      "flex h-screen transition-colors duration-300",
      secretMode ? "bg-slate-950" : "bg-background"
    )}>
      {/* Secret Mode Pattern Overlay */}
      {secretMode && (
        <div 
          className="fixed inset-0 opacity-5 pointer-events-none z-0" 
          style={{ 
            backgroundImage: 'radial-gradient(hsl(var(--destructive)) 1px, transparent 1px)', 
            backgroundSize: '20px 20px' 
          }} 
        />
      )}
      
      {/* Sidebar - with transition effect when chat is selected */}
      <div className={cn(
        "flex-col w-full md:w-80 border-r z-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        selectedConversationId ? 'hidden md:flex' : 'flex',
        secretMode ? "bg-slate-900 border-slate-800" : "bg-background border-border"
      )}>
        {/* Premium Header */}
        <div className={cn(
          "pt-[max(1.5rem,env(safe-area-inset-top))] border-b transition-colors duration-300",
          secretMode ? "border-slate-800 bg-slate-900/80" : "border-border bg-background/80 backdrop-blur-md"
        )}>
          {/* Title & Actions */}
          <div className="flex items-center justify-between mb-4 px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/feed')}
                className={cn("w-9 h-9", secretMode ? "hover:bg-slate-800" : "")}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <h1 className={cn(
                "text-2xl font-black tracking-tight",
                secretMode 
                  ? "bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400" 
                  : "bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent"
              )}>
                {secretMode ? "Secret" : "FeedIn"}
              </h1>
              {!secretMode && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-background shadow-sm animate-pulse" />
              )}
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSecretMode(!secretMode)}
                className={cn(
                  "w-9 h-9 rounded-xl transition-colors",
                  secretMode 
                    ? "bg-destructive/20 text-destructive hover:bg-destructive/30" 
                    : "bg-muted hover:bg-muted/80"
                )}
                title={secretMode ? "Exit Secret Mode" : "Enter Secret Mode"}
              >
                <Shield className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMessageSettings(true)}
                className={cn(
                  "w-9 h-9 rounded-xl",
                  secretMode ? "bg-slate-800 hover:bg-slate-700" : "bg-muted hover:bg-muted/80"
                )}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative px-4 mb-3 group">
            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search chats..." 
              className={cn(
                "w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none border border-transparent transition-all",
                secretMode 
                  ? "bg-slate-800 text-white placeholder:text-slate-500 focus:border-red-500/20" 
                  : "bg-muted focus:border-primary/20 focus:bg-card"
              )} 
            />
          </div>
          
          {/* TikTok-style Stories Bar */}
          <TikTokStoriesBar />
          
          {/* Bold Text Tabs */}
          <div className="pb-0.5">
            <MessagingTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              unreadCount={totalUnreadCount}
              secretMode={secretMode}
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          {/* Chats Content with TikTok-style Stories at top */}
          {activeTab === 'chats' && (
            <div className="pb-20">
              {/* Activity Section - TikTok Style */}
              <InboxActivitySection
                totalUnreadCount={totalUnreadCount}
                onMarkAllRead={markAllMessagesAsRead}
              />
              
              {/* Archived Chats Toggle */}
              {archivedConversations.length > 0 && !showArchived && (
                <button
                  onClick={() => setShowArchived(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Archive className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">Archived</p>
                    <p className="text-xs text-muted-foreground">{archivedConversations.length} chat{archivedConversations.length !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              )}
              
              {showArchived && (
                <button
                  onClick={() => setShowArchived(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-primary font-medium hover:bg-accent/50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to chats
                </button>
              )}
              
              {/* Conversations List */}
              {loadError && conversations.length === 0 ? (
                <div className="p-4">
                  <QueryErrorFallback 
                    error={loadError} 
                    onRetry={() => loadConversations()} 
                    compact 
                  />
                </div>
              ) : showSkeleton ? (
                <div className="space-y-1 px-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-full p-3 flex items-center gap-3">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                    <MessageSquarePlus className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-foreground font-semibold mb-1">
                    {showArchived ? 'No archived chats' : 'No conversations yet'}
                  </p>
                  <p className="text-muted-foreground text-sm mb-4">
                    {showArchived ? 'Archived chats will appear here' : 'Start chatting with friends'}
                  </p>
                  {!showArchived && (
                    <Button
                      onClick={() => setShowNewConversation(true)}
                      className="bg-gradient-to-r from-primary to-accent text-white"
                    >
                      Start a conversation
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {filteredConversations.map((conv, index) => (
                    <TikTokConversationItem
                      key={conv.id}
                      id={conv.id}
                      avatarUrl={conv.other_participant.avatar_url}
                      displayName={conv.other_participant.display_name || 'Unknown User'}
                      username={conv.other_participant.username}
                      userId={conv.other_participant.id}
                      lastMessage={
                        conv.last_message 
                          ? `${conv.last_message.sender_id === user?.id ? 'You: ' : ''}${conv.last_message.content}`
                          : undefined
                      }
                      lastMessageTime={
                        conv.last_message 
                          ? new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : undefined
                      }
                      lastMessageSenderId={conv.last_message?.sender_id}
                      currentUserId={user?.id}
                      unreadCount={conv.unread_count}
                      isOnline={conv.isOnline}
                      isTyping={conv.isTyping}
                      activityType={conv.activityType}
                      isSelected={selectedConversationId === conv.id}
                      isMuted={conv.is_muted}
                      index={index}
                      onArchive={() => handleArchiveConversation(conv.id)}
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        if (user && conv.unread_count != null && conv.unread_count > 0) {
                          setConversations(prev => prev.map(c => 
                            c.id === conv.id ? { ...c, unread_count: 0 } : c
                          ));
                          supabase
                            .from('messages')
                            .update({ is_read: true, read_at: new Date().toISOString() })
                            .eq('conversation_id', conv.id)
                            .neq('sender_id', user.id)
                            .eq('is_read', false)
                            .then(() => {});
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Groups Content - Separate tab */}
          {activeTab === 'groups' && (
            <div className="pb-20">
              {filteredMyGroups.length > 0 && (
                <div className="p-4">
                  <h3 className={cn(
                    "text-sm font-semibold mb-2",
                    secretMode ? "text-slate-400" : "text-muted-foreground"
                  )}>My Groups</h3>
                  {filteredMyGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}/chat`)}
                      className={cn(
                        "w-full p-3 flex items-start gap-3 transition-colors rounded-lg mb-2",
                        secretMode ? "hover:bg-slate-800" : "hover:bg-accent"
                      )}
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
                <h3 className={cn(
                  "text-sm font-semibold mb-2",
                  secretMode ? "text-slate-400" : "text-muted-foreground"
                )}>Discover Groups</h3>
                {filteredGroups.length === 0 && filteredMyGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="w-12 h-12 mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No groups found</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowCreateGroup(true)}
                    >
                      Create a group
                    </Button>
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className={cn(
                        "w-full p-3 flex items-start gap-3 transition-colors rounded-lg mb-2",
                        secretMode ? "hover:bg-slate-800" : "hover:bg-accent"
                      )}
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
            </div>
          )}


          {/* Live Content */}
          {activeTab === 'live' && (
            <div className="p-4 text-center">
              <div className="py-12">
                <div className={cn(
                  "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center",
                  secretMode ? "bg-red-500/20" : "bg-primary/10"
                )}>
                  <Users className={cn(
                    "w-8 h-8",
                    secretMode ? "text-red-400" : "text-primary"
                  )} />
                </div>
                <h3 className="font-bold text-lg mb-2">Live Streams</h3>
                <p className="text-muted-foreground text-sm">
                  No active streams right now.
                </p>
                <Button 
                  className="mt-4 bg-gradient-to-r from-red-500 to-orange-500 text-white"
                  onClick={() => navigate('/live')}
                >
                  Go Live
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Expandable FAB */}
      {!selectedConversationId && (
        <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2.5 md:hidden">
          {isFabExpanded && (
            <motion.div 
              className="flex flex-col gap-2.5"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <button 
                onClick={() => { setShowCreateGroup(true); setIsFabExpanded(false); }} 
                className="flex items-center gap-2.5 px-4 py-3 bg-foreground text-background rounded-2xl shadow-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                <Users2 className="w-4 h-4" /> Create Space
              </button>
              <button 
                onClick={() => { setShowNewConversation(true); setIsFabExpanded(false); }} 
                className="flex items-center gap-2.5 px-4 py-3 bg-card rounded-2xl shadow-2xl border border-border text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                <UserPlus className="w-4 h-4 text-primary" /> New Contact
              </button>
            </motion.div>
          )}
          <button 
            onClick={() => setIsFabExpanded(!isFabExpanded)} 
            className={cn(
              "w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center transition-all",
              isFabExpanded ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            )}
          >
            <Plus className={cn("w-6 h-6 transition-transform duration-200", isFabExpanded && "rotate-45")} />
          </button>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <ModernChatInterface
            conversationId={selectedConversationId}
            onBack={() => {
              setSelectedConversationId(null);
              setHighlightMessageId(null);
            }}
            onMessagesRead={() => {
              // Clear unread count for this conversation
              setConversations(prev => prev.map(conv => 
                conv.id === selectedConversationId 
                  ? { ...conv, unread_count: 0 }
                  : conv
              ));
            }}
            highlightMessageId={highlightMessageId}
            onHighlightCleared={() => setHighlightMessageId(null)}
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

      <MessageSettingsSheet
        isOpen={showMessageSettings}
        onClose={() => setShowMessageSettings(false)}
        secretMode={secretMode}
      />
    </div>
  );
}
