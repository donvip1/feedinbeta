import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Image, Shield, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface P2PChatProps {
  transactionId: string;
  buyerId: string;
  sellerId: string;
  moderatorId?: string;
  disabled?: boolean;
}

interface ChatMessage {
  id: string;
  transaction_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const P2PChat = ({ 
  transactionId, 
  buyerId, 
  sellerId, 
  moderatorId,
  disabled = false 
}: P2PChatProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isModerator = user?.id === moderatorId;
  const isBuyer = user?.id === buyerId;
  const isSeller = user?.id === sellerId;

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['p2p-chat', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_chat_messages')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id)
      })) as ChatMessage[];
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`p2p-chat-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'p2p_chat_messages',
          filter: `transaction_id=eq.${transactionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['p2p-chat', transactionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('p2p_chat_messages')
        .insert({
          transaction_id: transactionId,
          sender_id: user?.id,
          content,
          message_type: 'text',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['p2p-chat', transactionId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const filePath = `chat/${transactionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('p2p-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('p2p-proofs')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('p2p_chat_messages')
        .insert({
          transaction_id: transactionId,
          sender_id: user?.id,
          message_type: 'image',
          media_url: publicUrl,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['p2p-chat', transactionId] });
      toast.success('Image sent');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send image');
    },
  });

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      uploadImageMutation.mutate(file);
    }
  };

  const getRoleLabel = (senderId: string) => {
    if (senderId === buyerId) return { label: 'Buyer', variant: 'default' as const };
    if (senderId === sellerId) return { label: 'Seller', variant: 'secondary' as const };
    if (senderId === moderatorId) return { label: 'Moderator', variant: 'destructive' as const };
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Transaction Chat</h3>
          {moderatorId && (
            <Badge variant="outline" className="gap-1">
              <Shield className="w-3 h-3" />
              Moderated
            </Badge>
          )}
        </div>
        {disabled && (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Closed
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation with the other party</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender_id === user?.id;
              const role = getRoleLabel(msg.sender_id);

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={msg.sender?.avatar_url || undefined} />
                    <AvatarFallback>
                      {msg.sender?.display_name?.charAt(0) || msg.sender?.username?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className={`max-w-[70%] ${isOwnMessage ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                      <span className="text-sm font-medium">
                        {msg.sender?.display_name || msg.sender?.username || 'Unknown'}
                      </span>
                      {role && (
                        <Badge variant={role.variant} className="text-xs py-0">
                          {role.label}
                        </Badge>
                      )}
                    </div>

                    {msg.message_type === 'image' && msg.media_url ? (
                      <a
                        href={msg.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={msg.media_url}
                          alt="Shared image"
                          className="rounded-lg max-w-full max-h-48 object-cover border border-border"
                        />
                      </a>
                    ) : msg.message_type === 'system' ? (
                      <div className="bg-muted/50 text-muted-foreground px-3 py-2 rounded-lg text-sm italic">
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className={`px-3 py-2 rounded-lg ${
                          isOwnMessage
                            ? 'bg-primary text-primary-foreground'
                            : msg.sender_id === moderatorId
                            ? 'bg-destructive/10 border border-destructive/20'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}

                    <span className="text-xs text-muted-foreground mt-1 block">
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      {!disabled && (
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadImageMutation.isPending}
            >
              <Image className="w-5 h-5" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sendMessageMutation.isPending}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          {isModerator && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              You are moderating this transaction
            </p>
          )}
        </div>
      )}
    </div>
  );
};
