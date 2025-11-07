import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Smile, Phone, Video, Paperclip, Mic, X, Image as ImageIcon, File, Search } from 'lucide-react';
import { EnhancedMessageBubble } from './EnhancedMessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { UserMentionInput } from './UserMentionInput';
import { VoiceRecorder } from './VoiceRecorder';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { ImageViewerModal } from './ImageViewerModal';
import { MessageForwardModal } from './MessageForwardModal';
import { CompactNotification } from './CompactNotification';
import { MediaUploadModal } from './MediaUploadModal';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  edited_at?: string | null;
  is_read?: boolean;
  read_at?: string;
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
  const [isOnline, setIsOnline] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [compactNotif, setCompactNotif] = useState<{ sender: string; avatar: string | null; message: string; convId: string } | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadMessages();
    loadOtherUser();
    subscribeToMessages();
    subscribeToTyping();
    subscribeToReactions();
    markMessagesAsRead();
  }, [conversationId]);

  useEffect(() => {
    if (otherUser?.id) {
      const cleanup = subscribeToPresence();
      return cleanup;
    }
  }, [otherUser?.id]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_id, created_at, edited_at, is_read, read_at, media_url, media_type, reply_to_id, is_pinned, deleted_for_sender, deleted_for_receiver')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Get all unique message IDs that are being replied to
      const replyToIds = [...new Set((data || []).map(m => m.reply_to_id).filter(Boolean))];
      
      // Fetch replied-to messages
      let repliedMessages = new Map();
      if (replyToIds.length > 0) {
        const { data: repliedData } = await supabase
          .from('messages')
          .select('id, content, sender_id, profiles!messages_sender_id_fkey(display_name)')
          .in('id', replyToIds);
        
        if (repliedData) {
          repliedMessages = new Map(repliedData.map(m => [
            m.id, 
            { 
              content: m.content,
              sender: { 
                display_name: (m.profiles as any)?.display_name || 'User' 
              }
            }
          ]));
        }
      }
      
      const formattedMessages = (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        created_at: msg.created_at,
        edited_at: msg.edited_at || null,
        is_read: msg.is_read,
        read_at: msg.read_at,
        media_url: msg.media_url || null,
        media_type: msg.media_type || null,
        reply_to_id: msg.reply_to_id || null,
        is_pinned: (msg as any).is_pinned || false,
        deleted_for_sender: (msg as any).deleted_for_sender || false,
        deleted_for_receiver: (msg as any).deleted_for_receiver || false,
        reply_to_message: msg.reply_to_id ? repliedMessages.get(msg.reply_to_id) || null : null,
        profiles: {
          display_name: null,
          avatar_url: null,
        },
        reactions: [],
      }));

      // Filter out deleted messages based on who deleted them
      const visibleMessages = formattedMessages.filter(msg => {
        const isOwnMessage = msg.sender_id === user.id;
        if (isOwnMessage) {
          return !msg.deleted_for_sender;
        } else {
          return !msg.deleted_for_receiver;
        }
      });

      // Enrich with sender profiles
      const senderIds = Array.from(new Set((data || []).map((m: any) => m.sender_id)));
      if (senderIds.length) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', senderIds);
        const map = new Map((profileRows || []).map((p: any) => [p.id, p]));
        const enriched = visibleMessages.map(m => ({
          ...m,
          profiles: {
            display_name: map.get(m.sender_id)?.display_name ?? 'User',
            avatar_url: map.get(m.sender_id)?.avatar_url ?? null,
          }
        }));
        setMessages(enriched);
        setPinnedMessages(enriched.filter(m => m.is_pinned));
      } else {
        setMessages(visibleMessages);
        setPinnedMessages(visibleMessages.filter(m => (m as any).is_pinned));
      }

      // Load read receipts for each message
      if (data && data.length > 0) {
        const messageIds = data.map(m => m.id);
        const { data: receipts } = await supabase
          .from('message_read_receipts')
          .select('message_id, user_id, read_at')
          .in('message_id', messageIds);
        
        if (receipts) {
          // Update messages with read receipt info
          setMessages(prev => prev.map(msg => ({
            ...msg,
            read_receipts: receipts.filter(r => r.message_id === msg.id),
          })));
        }
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      // Get unread messages from other users
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (!unreadMessages || unreadMessages.length === 0) return;

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      // Insert read receipts for each message
      const receipts = unreadMessages.map(msg => ({
        message_id: msg.id,
        user_id: user.id,
        read_at: new Date().toISOString(),
      }));

      await supabase
        .from('message_read_receipts')
        .insert(receipts);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadOtherUser = async () => {
    if (!user) return;

    try {
      // Get the other participant's user_id first
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .maybeSingle();

      if (participantError) throw participantError;
      
      if (participantData?.user_id) {
        // Now fetch the profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', participantData.user_id)
          .maybeSingle();

        if (profileError) {
          console.error('Error loading profile:', profileError);
          // Set a fallback user object
          setOtherUser({
            id: participantData.user_id,
            display_name: 'User',
            username: null,
            avatar_url: null,
          });
          return;
        }
        
        if (profileData) {
          setOtherUser(profileData);
        } else {
          // Profile doesn't exist, set fallback
          setOtherUser({
            id: participantData.user_id,
            display_name: 'User',
            username: null,
            avatar_url: null,
          });
        }
      } else {
        console.warn('No other participant found in conversation');
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
        async (payload) => {
          console.log('New message received:', payload);
          await loadMessages();
          await markMessagesAsRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          await loadMessages();
        }
      )
      .subscribe((status) => {
        console.log('Message subscription status:', status);
      });

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
    const reactionsChannel = supabase
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

    // Subscribe to read receipts
    const receiptsChannel = supabase
      .channel(`read-receipts:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(receiptsChannel);
    };
  };

  const subscribeToPresence = () => {
    if (!otherUser?.id || !user?.id) return;

    const channel = supabase.channel(`presence:${conversationId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherUserPresent = Object.keys(state).some(key => key === otherUser.id);
        setIsOnline(otherUserPresent);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key === otherUser.id) {
          setIsOnline(true);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === otherUser.id) {
          setIsOnline(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
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

  const ensureParticipantExists = async (participantUserId: string): Promise<boolean> => {
    try {
      // Check if participant already exists
      const { data: existing } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', participantUserId)
        .maybeSingle();

      if (existing) return true;

      // Add participant if missing
      const { error } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversationId,
          user_id: participantUserId,
        });

      if (error) {
        console.error('Error adding participant:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error ensuring participant exists:', error);
      return false;
    }
  };

  const handleSend = async (mediaUrl?: string, mediaType?: string) => {
    if (!user || (!newMessage.trim() && !mediaUrl)) return;

    setSending(true);
    try {
      // Ensure both participants exist in conversation_participants
      const currentUserExists = await ensureParticipantExists(user.id);
      
      if (otherUser?.id) {
        const otherUserExists = await ensureParticipantExists(otherUser.id);
        if (!otherUserExists) {
          throw new Error('Could not add recipient to conversation');
        }
      }

      if (!currentUserExists) {
        throw new Error('Could not add you to conversation');
      }

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

      // Update typing indicator
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: false,
        });

      // Create notification for the other user if they exist
      if (otherUser?.id && newMsg) {
        await supabase.from('notifications').insert({
          user_id: otherUser.id,
          from_user_id: user.id,
          type: 'message',
          title: 'New Message',
          message: `${user.user_metadata?.display_name || 'Someone'} sent you a message`,
          related_id: conversationId,
          related_type: 'conversation',
        });
      }

      setNewMessage('');
      setReplyingTo(null);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        description: error.message || 'Could not send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleVoiceNote = async (audioBlob: Blob, duration: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileName = `${user.id}/${Date.now()}-voice.webm`;
      const { data, error: uploadError } = await supabase.storage
        .from('chat-audio')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-audio')
        .getPublicUrl(fileName);

      await handleSend(publicUrl, 'audio/webm');
      setShowVoiceRecorder(false);
    } catch (error: any) {
      toast({
        title: 'Failed to send voice note',
        description: error.message,
        variant: 'destructive',
      });
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

  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean = false) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const isOwnMessage = message.sender_id === user?.id;

      if (deleteForEveryone && isOwnMessage) {
        // Check if can delete for everyone
        const { data: canDelete } = await supabase.rpc('can_delete_for_everyone', {
          message_id: messageId,
          user_id: user!.id
        });

        if (canDelete) {
          // Mark as deleted for both
          await supabase
            .from('messages')
            .update({ 
              deleted_for_sender: true, 
              deleted_for_receiver: true,
              deleted_at: new Date().toISOString()
            })
            .eq('id', messageId);

          toast({
            title: 'Message deleted for everyone',
          });
        } else {
          toast({
            title: 'Cannot delete for everyone',
            description: '48 hours have passed since message was read',
            variant: 'destructive',
          });
          return;
        }
      } else {
        // Delete for me only
        const updateField = isOwnMessage ? 'deleted_for_sender' : 'deleted_for_receiver';
        await supabase
          .from('messages')
          .update({ 
            [updateField]: true,
            deleted_at: new Date().toISOString()
          })
          .eq('id', messageId);

        toast({
          title: 'Message deleted for you',
        });
      }

      loadMessages();
    } catch (error: any) {
      toast({
        title: 'Error deleting message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!user) return;

    try {
      // Get old content for history
      const { data: oldMsg } = await supabase
        .from('messages')
        .select('content')
        .eq('id', messageId)
        .single();

      if (oldMsg) {
        // Save edit history
        await supabase
          .from('message_edit_history')
          .insert({
            message_id: messageId,
            old_content: oldMsg.content,
          });
      }

      // Update message
      await supabase
        .from('messages')
        .update({
          content: newContent,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      toast({
        title: 'Message edited',
      });
      
      loadMessages();
    } catch (error: any) {
      toast({
        title: 'Error editing message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ is_pinned: !isPinned })
        .eq('id', messageId);

      toast({
        title: isPinned ? 'Message unpinned' : 'Message pinned',
      });
      
      loadMessages();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-600">{part}</mark>
      ) : (
        part
      )
    );
  };

  const handleQuickReply = (text: string) => {
    setNewMessage(text);
    setShowQuickReplies(false);
  };

  const quickReplies = [
    { emoji: '👍', text: 'Thanks!' },
    { emoji: '😊', text: 'Sure!' },
    { emoji: '✅', text: 'Okay' },
    { emoji: '❤️', text: 'Love it!' },
    { emoji: '🎉', text: 'Great!' },
    { emoji: '🤔', text: 'Let me think...' },
    { emoji: '👋', text: 'Hi!' },
    { emoji: '🙏', text: 'Please' },
  ];

  const filteredMessages = searchQuery 
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

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
      <div className="flex flex-col border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="relative">
            <Avatar>
              <AvatarImage src={otherUser?.avatar_url || ''} />
              <AvatarFallback>{otherUser?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{otherUser?.display_name || 'Loading...'}</h2>
            <p className="text-xs text-muted-foreground">{isOnline ? 'online' : 'offline'}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
              className="text-primary hover:text-primary/90"
              title="Search messages"
            >
              <Search className="w-5 h-5" />
            </Button>
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
        
        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-accent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && !searchQuery && (
            <div className="bg-accent/50 rounded-lg p-3 border border-border mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">📌 PINNED MESSAGES</p>
              <div className="space-y-2">
                {pinnedMessages.map((message) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.sender_id === user?.id}
                    onReply={(id, content) => setReplyingTo({ id, content })}
                    onReact={handleReaction}
                    onDelete={message.sender_id === user?.id ? handleDeleteMessage : undefined}
                    onEdit={message.sender_id === user?.id ? handleEditMessage : undefined}
                    onForward={(msg) => setForwardingMessage(msg)}
                    onImageClick={(url) => setViewingImage(url)}
                    onPin={handlePinMessage}
                    highlightQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}
          
          {searchQuery && filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No messages found matching "{searchQuery}"
            </div>
          ) : (
            <>
              {filteredMessages.map((message) => (
                <EnhancedMessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.sender_id === user?.id}
                  onReply={(id, content) => setReplyingTo({ id, content })}
                  onReact={handleReaction}
                  onDelete={message.sender_id === user?.id ? handleDeleteMessage : undefined}
                  onEdit={message.sender_id === user?.id ? handleEditMessage : undefined}
                  onForward={(msg) => setForwardingMessage(msg)}
                  onImageClick={(url) => setViewingImage(url)}
                  onPin={handlePinMessage}
                  highlightQuery={searchQuery}
                />
              ))}
            </>
          )}
          {isTyping && <TypingIndicator />}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-background">
        {/* Quick Replies */}
        {showQuickReplies && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickReply(reply.text)}
                  className="text-xs"
                >
                  <span className="mr-1">{reply.emoji}</span>
                  {reply.text}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4">
          {/* Reply Preview */}
          {replyingTo && (
            <div className="mb-3 p-3 bg-accent/80 rounded-lg flex items-start justify-between border-l-4 border-primary">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary mb-1">Replying to</p>
                <p className="text-sm truncate">{replyingTo.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setReplyingTo(null)}
                className="h-8 w-8 flex-shrink-0 ml-2"
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
          <div className="space-y-2">
            {/* Main input row */}
            <div className="flex items-end gap-2">
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
                disabled={sending}
                placeholder="Type a message..."
                conversationId={conversationId}
              />

              {newMessage.trim() ? (
                <Button
                  onClick={() => handleSend()}
                  disabled={sending}
                  size="icon"
                  className="bg-gradient-primary flex-shrink-0 h-11 w-11"
                >
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  onClick={() => setShowVoiceRecorder(true)}
                  size="icon"
                  className="bg-gradient-primary flex-shrink-0 h-11 w-11"
                >
                  <Mic className="w-5 h-5" />
                </Button>
              )}
            </div>
            
            {/* Action buttons below */}
            <div className="flex items-center gap-2 px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                title="Quick replies"
                className="h-8"
              >
                <Smile className="w-4 h-4 mr-1" />
                <span className="text-xs">Quick</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMediaUpload(true)}
                className="h-8"
              >
                <ImageIcon className="w-4 h-4 mr-1" />
                <span className="text-xs">Photo</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMediaUpload(true)}
                className="h-8"
              >
                <Paperclip className="w-4 h-4 mr-1" />
                <span className="text-xs">File</span>
              </Button>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Image Viewer */}
      <ImageViewerModal
        open={!!viewingImage}
        onOpenChange={(open) => !open && setViewingImage(null)}
        imageUrl={viewingImage || ''}
      />

      {/* Forward Message */}
      {forwardingMessage && (
        <MessageForwardModal
          open={!!forwardingMessage}
          onOpenChange={(open) => !open && setForwardingMessage(null)}
          message={forwardingMessage}
        />
      )}

      {/* Compact Notification */}
      {compactNotif && (
        <CompactNotification
          senderName={compactNotif.sender}
          senderAvatar={compactNotif.avatar}
          message={compactNotif.message}
          onOpen={() => {
            window.location.href = `/messages?conversation=${compactNotif.convId}`;
            setCompactNotif(null);
          }}
          onDismiss={() => setCompactNotif(null)}
        />
      )}
    </>
  );
};
