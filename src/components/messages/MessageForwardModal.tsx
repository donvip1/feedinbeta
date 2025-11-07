import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, Search } from 'lucide-react';

interface Conversation {
  id: string;
  participants: Array<{
    id: string;
    display_name: string;
    avatar_url: string | null;
  }>;
}

interface MessageForwardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: {
    id: string;
    content: string;
    media_url?: string | null;
    media_type?: string | null;
  };
}

export const MessageForwardModal = ({ open, onOpenChange, message }: MessageForwardModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data: convData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!convData) return;

      const conversationIds = convData.map(c => c.conversation_id);
      
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds);

      if (!allParticipants) return;

      const otherUserIds = allParticipants
        .filter(p => p.user_id !== user.id)
        .map(p => p.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', otherUserIds);

      if (!profiles) return;

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const groupedConvs = conversationIds.map(convId => {
        const participants = allParticipants
          .filter(p => p.conversation_id === convId && p.user_id !== user.id)
          .map(p => profileMap.get(p.user_id))
          .filter(Boolean) as Array<{ id: string; display_name: string; avatar_url: string | null }>;

        return {
          id: convId,
          participants,
        };
      }).filter(c => c.participants.length > 0);

      setConversations(groupedConvs);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const toggleSelection = (convId: string) => {
    const newSet = new Set(selectedConversations);
    if (newSet.has(convId)) {
      newSet.delete(convId);
    } else {
      newSet.add(convId);
    }
    setSelectedConversations(newSet);
  };

  const handleForward = async () => {
    if (!user || selectedConversations.size === 0) return;

    setSending(true);
    try {
      const messages = Array.from(selectedConversations).map(convId => ({
        conversation_id: convId,
        sender_id: user.id,
        content: message.content,
        media_url: message.media_url,
        media_type: message.media_type,
      }));

      const { error } = await supabase
        .from('messages')
        .insert(messages);

      if (error) throw error;

      toast({
        title: 'Messages forwarded',
        description: `Sent to ${selectedConversations.size} conversation${selectedConversations.size > 1 ? 's' : ''}`,
      });
      
      onOpenChange(false);
      setSelectedConversations(new Set());
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      toast({
        title: 'Forward failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = searchQuery
    ? conversations.filter(c => 
        c.participants.some(p => 
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : conversations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Forward Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => toggleSelection(conv.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedConversations.has(conv.id)
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-accent hover:bg-accent/80'
                  }`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={conv.participants[0]?.avatar_url || ''} />
                    <AvatarFallback>{conv.participants[0]?.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">
                      {conv.participants.map(p => p.display_name).join(', ')}
                    </p>
                  </div>
                  {selectedConversations.has(conv.id) && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleForward}
              disabled={sending || selectedConversations.size === 0}
              className="flex-1 bg-gradient-primary"
            >
              <Send className="w-4 h-4 mr-2" />
              Forward ({selectedConversations.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
