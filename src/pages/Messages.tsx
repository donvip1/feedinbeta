import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquarePlus, Search, ArrowLeft } from 'lucide-react';
import { ChatInterface } from '@/components/messages/ChatInterface';
import { NewConversationModal } from '@/components/messages/NewConversationModal';

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
}

export default function Messages() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadConversations();
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

      const conversationIds = participantData?.map(p => p.conversation_id) || [];
      
      const conversationsWithDetails = await Promise.all(
        conversationIds.map(async (convId) => {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id, participant:profiles!conversation_participants_user_id_fkey(id, display_name, username, avatar_url)')
            .eq('conversation_id', convId)
            .neq('user_id', user.id)
            .maybeSingle();

          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const conv = participantData?.find(p => p.conversation_id === convId);

          return {
            id: convId,
            updated_at: conv?.conversations?.updated_at || '',
            other_participant: {
              id: participants?.participant?.id || '',
              display_name: participants?.participant?.display_name || 'Unknown',
              username: participants?.participant?.username || null,
              avatar_url: participants?.participant?.avatar_url || null,
            },
            last_message: lastMessage || undefined,
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

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: userId },
        ]);

      if (participantsError) throw participantsError;

      await loadConversations();
      setSelectedConversationId(newConv.id);
      setShowNewConversation(false);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_participant.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_participant.username?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h1 className="text-xl font-bold">Messages</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewConversation(true)}
            >
              <MessageSquarePlus className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
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
                onClick={() => setSelectedConversationId(conv.id)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors ${
                  selectedConversationId === conv.id ? 'bg-accent' : ''
                }`}
              >
                <Avatar>
                  <AvatarImage src={conv.other_participant.avatar_url || ''} />
                  <AvatarFallback>
                    {conv.other_participant.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
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
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message.sender_id === user?.id ? 'You: ' : ''}
                      {conv.last_message.content}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <ChatInterface
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
        onClose={() => setShowNewConversation(false)}
        onSelectUser={handleNewConversation}
      />
    </div>
  );
}
