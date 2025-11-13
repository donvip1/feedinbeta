import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Smile, Phone, Video, Paperclip, Mic, X, Image as ImageIcon, File } from 'lucide-react';
import { EnhancedMessageBubble } from './EnhancedMessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { UserMentionInput } from './UserMentionInput';
import { VoiceRecorder } from './VoiceRecorder';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  reply_to_id?: string | null;
  reply_to_message?: {
    content: string;
    sender: {
      display_name: string;
    };
  } | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
  reactions?: Array<{
    emoji: string;
    user_id: string;
    user: {
      display_name: string;
    };
  }>;
  read_receipts?: Array<{
    user_id: string;
    read_at: string;
  }>;
}

interface ChatInterfaceProps {
  conversationId: string;
  onBack: () => void;
}

export const EnhancedChatInterface = ({ conversationId, onBack }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadMessages();
    loadOtherUser();
    subscribeToMessages();
    subscribeToTyping();
    subscribeToReactions();
    subscribeToReadReceipts();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey(display_name, avatar_url),
          reactions:message_reactions(
            emoji,
            user_id,
            user:profiles(display_name)
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch read receipts separately
      const messageIds = (data || []).map(msg => msg.id);
      let receipts: any[] = [];
      
      if (messageIds.length > 0) {
        const { data: receiptsData } = await supabase
          .rpc('get_message_read_receipts', { message_ids: messageIds })
          .returns<{ message_id: string; user_id: string; read_at: string }[]>();
        
        receipts = receiptsData || [];
      }
      
      const formattedMessages = (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        created_at: msg.created_at,
        media_url: msg.media_url || null,
        media_type: msg.media_type || null,
        reply_to_id: msg.reply_to_id || null,
        reply_to_message: null,
        profiles: {
          display_name: msg.profiles?.display_name || 'Unknown User',
          avatar_url: msg.profiles?.avatar_url || null,
        },
        reactions: msg.reactions || [],
        read_receipts: receipts.filter(r => r.message_id === msg.id).map(r => ({
          user_id: r.user_id,
          read_at: r.read_at
        })),
      }));
      
      setMessages(formattedMessages);
      
      // Mark incoming messages as read
      if (user) {
        markMessagesAsRead(formattedMessages);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  };

  const loadOtherUser = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('user_id, participant:profiles!conversation_participants_user_id_fkey(*)')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setOtherUser(data?.participant);
    } catch (error: any) {
      console.error('Error loading other user:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;

          const profile = row.sender_id === user?.id
            ? { display_name: 'You', avatar_url: null }
            : { display_name: otherUser?.display_name || 'Unknown User', avatar_url: otherUser?.avatar_url || null };

          const incoming = {
            id: row.id,
            content: row.content,
            sender_id: row.sender_id,
            created_at: row.created_at,
            media_url: row.media_url || null,
            media_type: row.media_type || null,
            reply_to_id: row.reply_to_id || null,
            reply_to_message: null,
            profiles: profile,
            reactions: [],
            read_receipts: [],
          } as Message;

          // Avoid duplicates
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };


  const subscribeToTyping = () => {
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: any) => {
          if (payload.new?.user_id !== user?.id) {
            setIsTyping(payload.new?.is_typing || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToReactions = () => {
    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToReadReceipts = () => {
    const channel = supabase
      .channel(`read_receipts:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        async () => {
          // Reload messages to show updated read receipts
          await loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markMessagesAsRead = async (messagesToMark: Message[]) => {
    if (!user) return;

    try {
      const unreadMessages = messagesToMark.filter(
        msg => msg.sender_id !== user.id && 
        !msg.read_receipts?.some(receipt => receipt.user_id === user.id)
      );

      if (unreadMessages.length === 0) return;

      // Insert read receipts one by one to avoid conflicts
      for (const msg of unreadMessages) {
        await supabase
          .from('message_read_receipts' as any)
          .insert({
            message_id: msg.id,
            user_id: user.id,
          })
          .select()
          .maybeSingle();
      }
    } catch (error: any) {
      // Silently handle errors (e.g., duplicate entries)
      console.debug('Mark as read info:', error);
    }
  };

  const handleTyping = async () => {
    if (!user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    await supabase
      .from('typing_indicators')
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        is_typing: true,
        updated_at: new Date().toISOString(),
      });

    typingTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: false,
          updated_at: new Date().toISOString(),
        });
    }, 2000);
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user!.id}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSend = async (mediaUrl?: string, mediaType?: string) => {
    if (!user || (!newMessage.trim() && !mediaUrl)) return;

    setSending(true);
    try {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: newMessage.trim() || (mediaType?.startsWith('audio') ? '🎤 Voice message' : '📎 Attachment'),
          media_url: mediaUrl,
          media_type: mediaType,
          reply_to_id: replyingTo?.id,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: false,
        });

      setNewMessage('');
      setReplyingTo(null);
      setPreviewMedia(null);
    } catch (error: any) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const url = await uploadFile(file);
      const type = file.type;
      
      if (type.startsWith('image') || type.startsWith('video')) {
        setPreviewMedia({ url, type });
      } else {
        await handleSend(url, type);
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVoiceNote = async (audioBlob: Blob, duration: number) => {
    setUploadingFile(true);
    try {
      // Create a proper File object from the Blob
      const file = Object.assign(audioBlob, {
        name: `voice-${Date.now()}.webm`,
        lastModified: Date.now(),
      }) as File;
      
      const url = await uploadFile(file);
      await handleSend(url, 'audio/webm');
      setShowVoiceRecorder(false);
    } catch (error: any) {
      toast({
        title: 'Failed to send voice note',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        // Remove reaction
        await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        // Add reaction
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
      }
    } catch (error: any) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user!.id);

      toast({
        title: 'Message deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const initiateCall = async (callType: 'video' | 'voice') => {
    if (!user || !otherUser) return;

    try {
      const { data: callLog, error } = await supabase
        .from('call_logs')
        .insert({
          caller_id: user.id,
          receiver_id: otherUser.id,
          call_type: callType,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Calling...',
        description: `Starting ${callType} call`,
      });

      navigate(`/call?callId=${callLog.id}&type=${callType}`);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      toast({
        title: 'Call Failed',
        description: 'Unable to start call. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-background sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar>
          <AvatarImage src={otherUser?.avatar_url || ''} />
          <AvatarFallback>{otherUser?.display_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold">{otherUser?.display_name || 'Unknown User'}</h2>
          {otherUser?.username && (
            <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => initiateCall('voice')}
            className="text-primary hover:text-primary/90"
            title="Voice call"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => initiateCall('video')}
            className="text-primary hover:text-primary/90"
            title="Video call"
          >
            <Video className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <EnhancedMessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === user?.id}
              onReply={(id, content) => setReplyingTo({ id, content })}
              onReact={handleReaction}
              onDelete={message.sender_id === user?.id ? handleDeleteMessage : undefined}
            />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-background">
        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-2 p-2 bg-accent rounded-lg flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Replying to</p>
              <p className="text-sm truncate">{replyingTo.content}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setReplyingTo(null)}
              className="h-6 w-6"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {showVoiceRecorder ? (
          <VoiceRecorder
            onSend={handleVoiceNote}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingFile}
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <UserMentionInput
              value={newMessage}
              onChange={(val) => {
                setNewMessage(val);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending || uploadingFile}
              placeholder="Type a message..."
              conversationId={conversationId}
            />

            {newMessage.trim() ? (
              <Button
                onClick={() => handleSend()}
                disabled={sending || uploadingFile}
                size="icon"
                className="bg-gradient-primary flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => setShowVoiceRecorder(true)}
                disabled={uploadingFile}
                size="icon"
                className="bg-gradient-primary flex-shrink-0"
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Media Preview Dialog */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-2xl">
          <DialogDescription className="sr-only">Preview and send media</DialogDescription>
          {previewMedia && (
            <div className="space-y-4">
              {previewMedia.type.startsWith('image') ? (
                <img src={previewMedia.url} alt="Preview" className="w-full rounded-lg" />
              ) : (
                <video src={previewMedia.url} controls className="w-full rounded-lg" />
              )}
              <div className="flex gap-2">
                <UserMentionInput
                  value={newMessage}
                  onChange={setNewMessage}
                  placeholder="Add a caption..."
                  conversationId={conversationId}
                />
                <Button
                  onClick={() => handleSend(previewMedia.url, previewMedia.type)}
                  disabled={sending}
                  className="bg-gradient-primary"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
