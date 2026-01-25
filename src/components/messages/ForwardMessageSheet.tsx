import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useForwardMessage, ForwardTarget, ForwardMessageParams } from '@/hooks/useForwardMessage';
import { Search, Send, Users, MessageCircle, Clock, Loader2, Forward, Image, FileText, Video } from 'lucide-react';

interface ForwardMessageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    senderId: string;
    senderName: string;
    timestamp: string;
    sourceType: 'dm' | 'group';
    sourceId: string;
  } | null;
}

interface ChatItem {
  id: string;
  type: 'conversation' | 'group';
  name: string;
  avatar?: string;
  lastMessage?: string;
  updatedAt: string;
}

export const ForwardMessageSheet: React.FC<ForwardMessageSheetProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  const { user } = useAuth();
  const { forwardToMultiple, loading: forwarding } = useForwardMessage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<ChatItem[]>([]);
  const [groups, setGroups] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      loadChats();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTargets(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadChats = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load conversations via conversation_participants
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations:conversation_id(id, updated_at)
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(50);

      if (participantData) {
        const convItems: ChatItem[] = [];
        for (const part of participantData) {
          if (!part.conversations) continue;
          const conv = part.conversations as any;
          
          // Get other participant
          const { data: otherPart } = await supabase
            .from('conversation_participants')
            .select('user_id, profiles:user_id(display_name, avatar_url)')
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id)
            .single();

          if (otherPart?.profiles) {
            const profile = otherPart.profiles as any;
            convItems.push({
              id: conv.id,
              type: 'conversation',
              name: profile.display_name || 'Unknown',
              avatar: profile.avatar_url,
              updatedAt: conv.updated_at,
            });
          }
        }
        setConversations(convItems);
      }

      // Load groups
      const { data: groupData } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups:group_id(id, name, avatar_url, last_message_at)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (groupData) {
        const groupItems: ChatItem[] = groupData
          .filter((g: any) => g.groups)
          .map((g: any) => ({
            id: g.groups.id,
            type: 'group' as const,
            name: g.groups.name,
            avatar: g.groups.avatar_url,
            updatedAt: g.groups.last_message_at || new Date().toISOString(),
          }));
        setGroups(groupItems);
      }
    } finally {
      setLoading(false);
    }
  };

  const allChats = useMemo(() => {
    return [...conversations, ...groups].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations, groups]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return allChats;
    const query = searchQuery.toLowerCase();
    return allChats.filter(chat => chat.name.toLowerCase().includes(query));
  }, [allChats, searchQuery]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => c.name.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  const toggleTarget = (id: string) => {
    setSelectedTargets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleForward = async () => {
    if (!message || selectedTargets.size === 0) return;

    const targets: ForwardTarget[] = [];
    selectedTargets.forEach(id => {
      const chat = allChats.find(c => c.id === id);
      if (chat) {
        targets.push({
          type: chat.type,
          id: chat.id,
          name: chat.name,
          avatar: chat.avatar,
        });
      }
    });

    const params: ForwardMessageParams = {
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      originalSenderId: message.senderId,
      originalSenderName: message.senderName,
      originalTimestamp: message.timestamp,
      sourceType: message.sourceType,
      sourceId: message.sourceId,
    };

    await forwardToMultiple(targets, params);
    onClose();
  };

  const renderChatItem = (chat: ChatItem) => (
    <button
      key={chat.id}
      onClick={() => toggleTarget(chat.id)}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
    >
      <Checkbox
        checked={selectedTargets.has(chat.id)}
        className="shrink-0"
      />
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={chat.avatar} />
        <AvatarFallback>
          {chat.type === 'group' ? (
            <Users className="w-5 h-5" />
          ) : (
            chat.name.charAt(0).toUpperCase()
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium truncate">{chat.name}</p>
        <p className="text-xs text-muted-foreground">
          {chat.type === 'group' ? 'Group' : 'Chat'}
        </p>
      </div>
    </button>
  );

  const getMediaIcon = () => {
    if (!message?.mediaType) return null;
    if (message.mediaType.includes('image')) return <Image className="w-4 h-4" />;
    if (message.mediaType.includes('video')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Forward className="w-5 h-5" />
            Forward Message
          </SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search chats and groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recent" className="flex-1 flex flex-col h-[calc(100%-200px)]">
          <TabsList className="grid grid-cols-3 mx-4 mt-2">
            <TabsTrigger value="recent" className="text-xs">
              <Clock className="w-4 h-4 mr-1" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">
              <Users className="w-4 h-4 mr-1" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs">
              <MessageCircle className="w-4 h-4 mr-1" />
              Contacts
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="flex-1 px-4 py-2">
              <TabsContent value="recent" className="mt-0 space-y-1">
                {filteredChats.length > 0 ? (
                  filteredChats.map(renderChatItem)
                ) : (
                  <p className="text-center text-muted-foreground py-8">No chats found</p>
                )}
              </TabsContent>

              <TabsContent value="groups" className="mt-0 space-y-1">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map(renderChatItem)
                ) : (
                  <p className="text-center text-muted-foreground py-8">No groups found</p>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="mt-0 space-y-1">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map(renderChatItem)
                ) : (
                  <p className="text-center text-muted-foreground py-8">No contacts found</p>
                )}
              </TabsContent>
            </ScrollArea>
          )}
        </Tabs>

        {/* Message Preview & Forward Button */}
        <div className="border-t border-border p-4 bg-background">
          {message && (
            <div className="mb-3 p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Forwarding:</p>
              <div className="flex items-start gap-2">
                {message.mediaUrl && (
                  <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center shrink-0">
                    {getMediaIcon()}
                  </div>
                )}
                <p className="text-sm line-clamp-2 flex-1">
                  {message.content || (message.mediaType ? 'Media' : 'Message')}
                </p>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={selectedTargets.size === 0 || forwarding}
            onClick={handleForward}
          >
            {forwarding ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Forward to {selectedTargets.size} chat{selectedTargets.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
