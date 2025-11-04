import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Conversation {
  id: string;
  updated_at: string;
  other_user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
    is_read: boolean;
  } | null;
  unread_count: number;
}

export const InboxList = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();

    // Subscribe to new messages
    const channel = supabase
      .channel('inbox-updates')
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
  }, []);

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all conversations user is part of
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations) return;

      const conversationIds = participations.map(p => p.conversation_id);

      // Get conversation details with last message
      const conversationsData: Conversation[] = [];

      for (const convId of conversationIds) {
        // Get other participant
        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles(id, username, display_name, avatar_url)')
          .eq('conversation_id', convId)
          .neq('user_id', user.id)
          .single();

        if (!otherParticipant || !otherParticipant.profiles) continue;

        // Get last message
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, is_read')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Count unread messages
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        // Get conversation updated_at
        const { data: conv } = await supabase
          .from('conversations')
          .select('updated_at')
          .eq('id', convId)
          .single();

        conversationsData.push({
          id: convId,
          updated_at: conv?.updated_at || new Date().toISOString(),
          other_user: {
            id: otherParticipant.profiles.id,
            username: otherParticipant.profiles.username,
            display_name: otherParticipant.profiles.display_name,
            avatar_url: otherParticipant.profiles.avatar_url
          },
          last_message: lastMessage,
          unread_count: unreadCount || 0
        });
      }

      // Sort by most recent
      conversationsData.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setConversations(conversationsData);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No conversations found' : 'No messages yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate(`/messages?conversation=${conv.id}`)}
                className="w-full p-4 hover:bg-accent transition-colors text-left flex gap-3"
              >
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <img
                    src={conv.other_user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.other_user.username}`}
                    alt={conv.other_user.display_name || conv.other_user.username}
                  />
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold truncate">
                      {conv.other_user.display_name || conv.other_user.username}
                    </p>
                    {conv.last_message && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message ? conv.last_message.content : 'No messages yet'}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge variant="destructive" className="flex-shrink-0">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};