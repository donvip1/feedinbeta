import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Send, Smile, Phone, Video, Mic, X, Image as ImageIcon, 
  Paperclip, Search, MoreVertical, Circle, ChevronDown, Reply, Pin
} from 'lucide-react';
import { AttachmentPicker } from './AttachmentPicker';
import { ModernMessageBubble } from './ModernMessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { VoiceRecorder } from './VoiceRecorder';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

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
    media_url?: string | null;
    media_type?: string | null;
  } | null;
  reply_metadata?: {
    type?: string;
    story_id?: string;
    story_media_url?: string;
    story_media_type?: string;
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
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  is_pinned?: boolean;
  edited_at?: string | null;
}

interface ChatInterfaceProps {
  conversationId: string;
  onBack: () => void;
}

const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const ModernChatInterface = ({ conversationId, onBack }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; sender: string } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      await loadOtherUser();
      await loadMessages();
      subscribeToMessages();
      subscribeToTyping();
      subscribeToReactions();
      subscribeToReadReceipts();
      subscribeToPresence();
    };
    init();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(display_name, avatar_url),
          reactions:message_reactions(
            emoji,
            user_id,
            user:profiles(display_name)
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const messageIds = (data || []).map(msg => msg.id);
      let receipts: any[] = [];
      
      if (messageIds.length > 0) {
        const { data: receiptsData } = await supabase
          .rpc('get_message_read_receipts', { message_ids: messageIds })
          .returns<{ message_id: string; user_id: string; read_at: string }[]>();
        
        receipts = receiptsData || [];
      }
      
      const formattedMessages = (data || []).map(msg => {
        const msgReceipts = receipts.filter(r => r.message_id === msg.id);
        const isRead = msgReceipts.length > 0 && msgReceipts.some(r => r.user_id !== user?.id);
        const isDelivered = msg.sender_id === user?.id;
        
        return {
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
          media_url: msg.media_url || null,
          media_type: msg.media_type || null,
          reply_to_id: msg.reply_to_id || null,
          reply_to_message: null,
          profiles: {
            display_name: msg.sender?.display_name || 'Unknown User',
            avatar_url: msg.sender?.avatar_url || null,
          },
          reactions: msg.reactions || [],
          read_receipts: msgReceipts.map(r => ({
            user_id: r.user_id,
            read_at: r.read_at
          })),
          status: isRead ? 'read' : (isDelivered ? 'delivered' : 'sent') as Message['status'],
          is_pinned: msg.is_pinned || false,
          edited_at: msg.edited_at || null,
        };
      });
      
      setMessages(formattedMessages);
      setPinnedMessages(formattedMessages.filter(m => m.is_pinned));
      
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
      // First get the other participant's user_id
      const { data: participant, error: participantError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .maybeSingle();

      if (participantError) throw participantError;
      
      // Then fetch their profile separately
      if (participant?.user_id) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, bio, is_premium')
          .eq('id', participant.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching other user profile:', profileError);
        } else {
          setOtherUser(profile);
        }
      }
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
            status: (row.sender_id === user?.id ? 'delivered' : 'sent') as Message['status'],
            is_pinned: false,
            edited_at: null,
          } as Message;

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
        async (payload: any) => {
          const receipt = payload?.new;
          if (!receipt) return;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === receipt.message_id && receipt.user_id !== user?.id
                ? { ...msg, status: 'read' as Message['status'], read_receipts: [...(msg.read_receipts || []), { user_id: receipt.user_id, read_at: receipt.read_at }] }
                : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToPresence = () => {
    if (!otherUser?.id) return;

    const channel = supabase.channel(`presence:${otherUser.id}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const isUserOnline = Object.keys(state).length > 0;
        setIsOnline(isUserOnline);
      })
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

  const uploadFile = async (file: File): Promise<{ url: string; path: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user!.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return { url: publicUrl, path: filePath };
  };

  const handleSend = async (mediaUrl?: string, mediaType?: string) => {
    if (!user || (!newMessage.trim() && !mediaUrl)) return;

    setSending(true);
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: newMessage.trim() || (mediaType?.startsWith('audio') ? '🎤 Voice message' : '📎 Attachment'),
      sender_id: user.id,
      created_at: new Date().toISOString(),
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      reply_to_id: replyingTo?.id || null,
      reply_to_message: replyingTo ? {
        content: replyingTo.content,
        sender: { display_name: replyingTo.sender },
        media_url: null,
        media_type: null,
      } : null,
      profiles: {
        display_name: 'You',
        avatar_url: null,
      },
      reactions: [],
      read_receipts: [],
      status: 'sending',
      is_pinned: false,
      edited_at: null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom();

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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: newMsg.id,
                created_at: newMsg.created_at,
                status: 'delivered' as Message['status'],
              }
            : msg
        )
      );

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
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (file: File, type: 'image' | 'video' | 'file') => {
    if (!user) return;

    setUploadingFile(true);
    try {
      const { url, path } = await uploadFile(file);
      
      if (type === 'image' || type === 'video') {
        setPreviewMedia({ url, type: file.type });
      } else {
        await handleSend(url, 'file');
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleVoiceSend = async (audioBlob: Blob) => {
    if (!user) return;

    setUploadingFile(true);
    try {
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const { url } = await uploadFile(file);
      await handleSend(url, 'audio/webm');
    } catch (error: any) {
      toast({
        title: 'Voice upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
      setShowVoiceRecorder(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      const existingReaction = messages
        .find(m => m.id === messageId)
        ?.reactions?.find(r => r.user_id === user.id && r.emoji === emoji);

      if (existingReaction) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
      }
    } catch (error: any) {
      console.error('Error reacting:', error);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Function to initiate a call
  const initiateCall = async (callType: 'voice' | 'video') => {
    if (!user || !otherUser?.id) {
      toast({
        title: 'Cannot start call',
        description: 'User information not available',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: callData, error } = await supabase
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

      navigate(`/call?callId=${callData.id}&type=${callType}`);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      toast({
        title: 'Failed to start call',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const groupedMessages = messages.reduce((groups, message, index) => {
    const date = new Date(message.created_at).toDateString();
    const prevMessage = messages[index - 1];
    const nextMessage = messages[index + 1];
    
    const isFirstInGroup = !prevMessage || 
      prevMessage.sender_id !== message.sender_id ||
      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 60000;
    
    const isLastInGroup = !nextMessage || 
      nextMessage.sender_id !== message.sender_id ||
      new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime() > 60000;
    
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push({ ...message, isFirstInGroup, isLastInGroup });
    return groups;
  }, {} as Record<string, (Message & { isFirstInGroup: boolean; isLastInGroup: boolean })[]>);

  const filteredMessages = searchQuery 
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-background/95">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden shrink-0 hover:bg-primary/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => otherUser && navigate(`/profile/${otherUser.id}`)}
        >
          <div className="relative">
            <Avatar className="w-10 h-10 ring-2 ring-primary/20">
              <AvatarImage src={otherUser?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40">
                {otherUser?.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{otherUser?.display_name || 'Loading...'}</h2>
            <p className="text-xs text-muted-foreground">
              {isTyping ? (
                <span className="text-primary animate-pulse">typing...</span>
              ) : isOnline ? (
                <span className="text-emerald-500">online</span>
              ) : lastSeen ? (
                `last seen ${format(new Date(lastSeen), 'HH:mm')}`
              ) : (
                '@' + (otherUser?.username || 'user')
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10"
            onClick={() => initiateCall('voice')}
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10"
            onClick={() => initiateCall('video')}
          >
            <Video className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem className="gap-2">
                <Search className="w-4 h-4" />
                Search in chat
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Pin className="w-4 h-4" />
                Pinned messages ({pinnedMessages.length})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive">
                Clear chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="p-2 border-b border-border/50 bg-background/50 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-full bg-muted/50"
              autoFocus
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea 
        className="flex-1 px-3"
        onScrollCapture={handleScroll}
      >
        <div className="py-4 space-y-4">
          {Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex justify-center mb-4">
                <span className="px-3 py-1 text-xs text-muted-foreground bg-muted/50 rounded-full backdrop-blur-sm">
                  {formatDateHeader(dateMessages[0].created_at)}
                </span>
              </div>
              
              {/* Messages */}
              <div className="space-y-1">
                {dateMessages.map((msg) => (
                  <ModernMessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.sender_id === user?.id}
                    showAvatar={true}
                    isFirstInGroup={msg.isFirstInGroup}
                    isLastInGroup={msg.isLastInGroup}
                    onReply={(id, content) => setReplyingTo({ 
                      id, 
                      content, 
                      sender: msg.profiles.display_name || 'Unknown' 
                    })}
                    onReact={handleReact}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-center gap-2 pl-10">
              <TypingIndicator />
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-24 right-4 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2"
          onClick={scrollToBottom}
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      )}

      {/* Reply Preview */}
      {replyingTo && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-t border-border/50">
          <div className="w-1 h-10 bg-primary rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">Replying to {replyingTo.sender}</p>
            <p className="text-sm text-muted-foreground truncate">{replyingTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => setReplyingTo(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Media Preview */}
      {previewMedia && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-t border-border/50">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
            {previewMedia.type.startsWith('image') ? (
              <img src={previewMedia.url} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <video src={previewMedia.url} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Sending media</p>
            <p className="text-xs text-muted-foreground">Add a caption below</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewMedia(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Voice Recorder */}
      {showVoiceRecorder && (
        <div className="px-4 py-3 bg-muted/50 border-t border-border/50">
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}

      {/* Input Area */}
      {!showVoiceRecorder && (
        <div className="p-3 border-t border-border/50 bg-background/80 backdrop-blur-lg">
          <div className="flex items-end gap-2">
            <AttachmentPicker onFileSelect={handleFileSelect} />
            
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (previewMedia) {
                      handleSend(previewMedia.url, previewMedia.type);
                    } else {
                      handleSend();
                    }
                  }
                }}
                className="pr-10 rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
                disabled={sending || uploadingFile}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-primary/10"
                  >
                    <Smile className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 rounded-2xl" align="end">
                  <div className="flex gap-1">
                    {EMOJI_QUICK.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewMessage(prev => prev + emoji)}
                        className="text-2xl p-1.5 rounded-full hover:bg-accent transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {newMessage.trim() || previewMedia ? (
              <Button
                size="icon"
                className="shrink-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                onClick={() => {
                  if (previewMedia) {
                    handleSend(previewMedia.url, previewMedia.type);
                  } else {
                    handleSend();
                  }
                }}
                disabled={sending || uploadingFile}
              >
                <Send className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full hover:bg-primary/10"
                onClick={() => setShowVoiceRecorder(true)}
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Media Preview Dialog */}
      <Dialog open={!!previewMedia && previewMedia.type.startsWith('image')} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl">
          {previewMedia && (
            <img src={previewMedia.url} alt="Preview" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
