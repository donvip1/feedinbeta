import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useConversations } from '@/hooks/useConversations';
import { useRealtimePresence } from '@/hooks/useRealtimePresence';
import { format } from 'date-fns';

interface ConversationListProps {
  userId: string;
  searchQuery: string;
  onSelectConversation: (conversationId: string) => void;
}

export const ConversationList = ({ 
  userId, 
  searchQuery, 
  onSelectConversation 
}: ConversationListProps) => {
  const { conversations, loading } = useConversations(userId);
  const { onlineUsers } = useRealtimePresence('online-users', userId);

  const filteredConversations = conversations.filter(conv =>
    conv.participant.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.participant.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No conversations yet</p>
        <p className="text-sm mt-1">Start chatting with your friends!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {filteredConversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelectConversation(conv.id)}
          className="w-full p-3 flex items-start gap-3 hover:bg-accent transition-colors text-left"
        >
          <div className="relative">
            <Avatar>
              <AvatarImage src={conv.participant.avatar_url || undefined} />
              <AvatarFallback>
                {conv.participant.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            {onlineUsers.has(conv.participant.id) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold truncate">
                {conv.participant.display_name || conv.participant.username}
              </p>
              {conv.last_message && (
                <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                  {format(new Date(conv.last_message.created_at), 'HH:mm')}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground truncate">
                {conv.last_message ? (
                  <>
                    {conv.last_message.sender_id === userId && 'You: '}
                    {conv.last_message.content}
                  </>
                ) : (
                  `@${conv.participant.username}`
                )}
              </p>
              {conv.unread_count > 0 && (
                <Badge 
                  variant="default" 
                  className="bg-primary text-primary-foreground rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5 text-xs"
                >
                  {conv.unread_count}
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
