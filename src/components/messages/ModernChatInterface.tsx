import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { usePresence, getStatusText, getStatusColor, formatLastSeen, PresenceStatus } from '@/hooks/usePresence';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, Send, Smile, Phone, Video, Mic, X, Image as ImageIcon, 
  Paperclip, Search, MoreVertical, Circle, ChevronDown, Reply, Pin
} from 'lucide-react';
import { AttachmentPicker } from './AttachmentPicker';
import { ModernMessageBubble } from './ModernMessageBubble';
import { CallLogBubble } from './CallLogBubble';
import { TypingIndicator, getActivityText, getActivityIcon, ActivityType } from './TypingIndicator';
import { VoiceRecorder } from './VoiceRecorder';
import { MediaUploadModal } from './MediaUploadModal';
import { DeleteMessageModal, DeleteOption } from './DeleteMessageModal';
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
import { format, isToday, isYesterday, isSameDay, differenceInHours } from 'date-fns';

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
  onMessagesRead?: () => void;
}

const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const ModernChatInterface = ({ conversationId, onBack, onMessagesRead }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>('typing');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; sender: string } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  
  // Media upload modal state
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadType, setMediaUploadType] = useState<'image' | 'video' | 'file'>('image');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const hasScrolledToUnread = useRef(false);
  const isUserScrolling = useRef(false);
  const isNearBottomRef = useRef(true);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  // Use the global presence hook to track other user's status
  const { 
    isOnline: otherUserOnline, 
    status: otherUserStatus,
    getUserStatus,
    getUserSection,
    isUserActive,
    userStatuses
  } = usePresence(otherUser?.id);

  // Track own presence so others know we're online
  useEffect(() => {
    if (!user || !conversationId) return;

    const presenceChannel = supabase.channel(`user-presence:${user.id}`)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            conversation_id: conversationId,
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.id, conversationId]);

  // Initialize data and subscriptions
  useEffect(() => {
    let messageChannel: ReturnType<typeof supabase.channel> | null = null;
    let typingChannel: ReturnType<typeof supabase.channel> | null = null;
    let reactionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let receiptsChannel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      await loadOtherUser();
      await loadMessages();
      
      // Subscribe to real-time message updates with unique channel name
      messageChannel = supabase
        .channel(`chat-messages-${conversationId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload: any) => {
            const newMsg = payload?.new;
            if (!newMsg) return;
            
            // Skip messages from current user - we handle those via optimistic update
            // This prevents the flickering/duplicate issue
            if (newMsg.sender_id === user?.id) {
              console.log('[Realtime] Own message, handled optimistically');
              return;
            }
            
            console.log('[Realtime] New message from other user:', newMsg.id);
            
            // Add message from other user instantly
            setMessages(prev => {
              // Double-check we don't already have it
              if (prev.some(m => m.id === newMsg.id)) {
                return prev;
              }
              
              const formattedMsg: Message = {
                id: newMsg.id,
                content: newMsg.content,
                sender_id: newMsg.sender_id,
                created_at: newMsg.created_at,
                media_url: newMsg.media_url || null,
                media_type: newMsg.media_type || null,
                reply_to_id: newMsg.reply_to_id || null,
                reply_to_message: null,
                profiles: {
                  display_name: otherUser?.display_name || 'Unknown',
                  avatar_url: otherUser?.avatar_url || null
                },
                reactions: [],
                read_receipts: [],
                status: 'sent',
                is_pinned: false,
                edited_at: null,
              };
              
              return [...prev, formattedMsg];
            });
            
            // Only scroll to bottom if user is near the bottom
            if (isNearBottomRef.current) {
              setTimeout(() => scrollToBottom(), 100);
            } else {
              // Show scroll button to indicate new messages
              setShowScrollButton(true);
            }
            
            // Mark as read if near bottom
            if (isNearBottomRef.current) {
              markMessagesAsRead([{ id: newMsg.id, sender_id: newMsg.sender_id, read_receipts: [] } as Message]);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: any) => {
            const deletedMsg = payload?.old;
            if (deletedMsg?.id) {
              setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
            }
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Messages channel status:', status);
        });

      // Subscribe to typing indicators with unique channel name
      typingChannel = supabase
        .channel(`chat-typing-${conversationId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_indicators',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: any) => {
            console.log('[Realtime] Typing indicator:', payload);
            if (payload.new?.user_id !== user?.id) {
              setIsTyping(payload.new?.is_typing || false);
              setActivityType(payload.new?.activity_type || 'typing');
            }
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Typing channel status:', status);
        });

      // Subscribe to reactions with unique channel name
      reactionsChannel = supabase
        .channel(`chat-reactions-${conversationId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'message_reactions' },
          () => loadMessages()
        )
        .subscribe();

      // Subscribe to read receipts with unique channel name
      receiptsChannel = supabase
        .channel(`chat-receipts-${conversationId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'message_read_receipts' },
          (payload: any) => {
            console.log('[Realtime] Read receipt:', payload);
            const receipt = payload?.new;
            if (!receipt || receipt.user_id === user?.id) return;
            
            setMessages(prev => prev.map(msg =>
              msg.id === receipt.message_id
                ? { ...msg, status: 'read', read_receipts: [...(msg.read_receipts || []), { user_id: receipt.user_id, read_at: receipt.read_at }] }
                : msg
            ));
          }
        )
        .subscribe();
    };

    init();

    return () => {
      console.log('[Realtime] Cleaning up channels');
      if (messageChannel) supabase.removeChannel(messageChannel);
      if (typingChannel) supabase.removeChannel(typingChannel);
      if (reactionsChannel) supabase.removeChannel(reactionsChannel);
      if (receiptsChannel) supabase.removeChannel(receiptsChannel);
    };
  }, [conversationId, user?.id, otherUser]);

  // Get other user's presence data for display
  const otherUserPresence = otherUser?.id ? userStatuses.get(otherUser.id) : null;
  const isOnline = otherUserOnline;
  const lastSeen = otherUserPresence?.last_seen || null;
  const currentSection = otherUserPresence?.current_section || null;

  // Scroll to first unread message or bottom - only on initial load
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Only auto-scroll on initial load or if user is near bottom
    if (firstUnreadId && firstUnreadRef.current && !hasScrolledToUnread.current) {
      hasScrolledToUnread.current = true;
      setTimeout(() => {
        firstUnreadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else if (!firstUnreadId && !hasScrolledToUnread.current) {
      // Initial load, scroll to bottom
      hasScrolledToUnread.current = true;
      scrollToBottom();
    }
    // Don't auto-scroll on subsequent message updates - let user control
  }, [firstUnreadId]); // Remove messages dependency to stop auto-scrolling on new messages

  // Scroll to bottom when keyboard opens to keep messages visible
  useEffect(() => {
    if (isKeyboardOpen && isNearBottomRef.current) {
      // Give keyboard animation time to complete
      setTimeout(() => {
        scrollToBottom();
      }, 150);
    }
  }, [isKeyboardOpen]);

  // Only scroll to bottom for own messages or if user is near bottom
  const scrollToBottomIfNeeded = useCallback(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    }
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // User is "near bottom" if within 150px of the bottom
    const nearBottom = distanceFromBottom < 150;
    isNearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
    
    // Track that user is actively scrolling
    isUserScrolling.current = true;
  }, []);

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
      
      // Find first unread message to scroll to
      const unreadMessages = formattedMessages.filter(
        msg => msg.sender_id !== user?.id && 
        !msg.read_receipts?.some(r => r.user_id === user?.id)
      );
      
      if (unreadMessages.length > 0 && !hasScrolledToUnread.current) {
        setFirstUnreadId(unreadMessages[0].id);
        // Mark all messages as read after a short delay (user is viewing the chat)
        setTimeout(() => {
          markMessagesAsRead(unreadMessages);
        }, 1500);
      } else {
        setFirstUnreadId(null);
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
      
      // Then fetch their profile separately using public_profiles (secure view)
      if (participant?.user_id) {
        const { data: profile, error: profileError } = await supabase
          .from('public_profiles')
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

  const markMessagesAsRead = useCallback(async (messagesToMark: Message[]) => {
    if (!user) return;

    try {
      const unreadMessages = messagesToMark.filter(
        msg => msg.sender_id !== user.id && 
        !msg.read_receipts?.some(receipt => receipt.user_id === user.id)
      );

      if (unreadMessages.length === 0) return;

      // Use the efficient database function to mark all messages as read
      await supabase.rpc('mark_conversation_read', { conv_id: conversationId });

      // Also insert read receipts for detailed tracking
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
      
      // Clear the unread indicator
      setFirstUnreadId(null);
      
      // Notify parent that messages were read
      onMessagesRead?.();
    } catch (error: any) {
      console.debug('Mark as read info:', error);
    }
  }, [user, conversationId, onMessagesRead]);

  const handleTyping = async (activity: ActivityType = 'typing') => {
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
        activity_type: activity,
        updated_at: new Date().toISOString(),
      });

    // Auto-stop after 3 seconds for typing, longer for other activities
    const timeout = ['voice_recording', 'uploading_image', 'uploading_video', 'uploading_file'].includes(activity) 
      ? 30000 
      : 3000;

    typingTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          is_typing: false,
          activity_type: 'typing',
          updated_at: new Date().toISOString(),
        });
    }, timeout);
  };

  const stopTyping = async () => {
    if (!user) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    await supabase
      .from('typing_indicators')
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        is_typing: false,
        activity_type: 'typing',
        updated_at: new Date().toISOString(),
      });
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

  const handleSend = async (mediaUrl?: string, mediaType?: string, customContent?: string) => {
    if (!user || (!newMessage.trim() && !mediaUrl && !customContent)) return;

    setSending(true);
    
    const messageContent = customContent || newMessage.trim() || (mediaType?.startsWith('audio') ? '🎤 Voice message' : '📎 Attachment');
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
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
          content: messageContent,
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

    // Show media upload modal for preview/editing
    setMediaUploadFile(file);
    setMediaUploadType(type);
    setShowMediaUpload(true);
    
    // Set activity type
    const activityMap: Record<string, ActivityType> = {
      'image': 'uploading_image',
      'video': 'uploading_video',
      'file': 'uploading_file',
    };
    handleTyping(activityMap[type] || 'uploading_file');
  };

  const handleMediaSend = async (file: File, caption: string) => {
    if (!user) return;

    setUploadingFile(true);
    setUploadProgress(0);
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const { url } = await uploadFile(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Send with caption if provided
      const content = caption || (file.type.startsWith('audio') ? '🎤 Voice message' : '📎 Attachment');
      await handleSend(url, file.type, content);
      
      setShowMediaUpload(false);
      setMediaUploadFile(null);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      stopTyping();
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

  const openDeleteModal = (msg: Message) => {
    setMessageToDelete(msg);
    setDeleteModalOpen(true);
  };

  const handleDeleteWithOption = async (option: DeleteOption) => {
    if (!user || !messageToDelete) return;

    try {
      const isOwnMessage = messageToDelete.sender_id === user.id;
      
      if (option === 'for_me') {
        // Mark as deleted for sender only
        await supabase
          .from('messages')
          .update({ deleted_for_sender: true })
          .eq('id', messageToDelete.id);
      } else if (option === 'for_everyone') {
        // Delete message and notify other user
        await supabase
          .from('messages')
          .update({ 
            content: 'This message was deleted',
            deleted_at: new Date().toISOString(),
            media_url: null,
            media_type: null,
          })
          .eq('id', messageToDelete.id);
      } else if (option === 'for_everyone_silent') {
        // Check if message is unread
        const isUnread = !messageToDelete.read_receipts?.some(r => r.user_id !== user.id);
        if (isUnread) {
          // Completely delete
          await supabase
            .from('messages')
            .delete()
            .eq('id', messageToDelete.id);
        } else {
          // Show regular delete notification
          await supabase
            .from('messages')
            .update({ 
              content: 'This message was deleted',
              deleted_at: new Date().toISOString(),
              media_url: null,
              media_type: null,
            })
            .eq('id', messageToDelete.id);
        }
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
      setDeleteModalOpen(false);
      setMessageToDelete(null);
      
      toast({ title: 'Message deleted' });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      openDeleteModal(msg);
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

  // Calculate input bottom position based on keyboard
  const inputBottom = isKeyboardOpen ? keyboardHeight : 0;

  return (
    <div className="relative h-screen w-full bg-gradient-to-b from-background to-background/95">
      {/* Header - FIXED at top, never moves with keyboard */}
      <header className="chat-header-fixed flex items-center gap-3 p-3 border-b border-border/50 bg-background/95 backdrop-blur-lg z-50 min-h-[60px]">
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
          onClick={() => otherUser && navigate(`/profile/${otherUser.username || otherUser.id}`)}
        >
          <div className="relative">
            <Avatar className="w-10 h-10 ring-2 ring-primary/20">
              <AvatarImage src={otherUser?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40">
                {otherUser?.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {isOnline && (
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background",
                currentSection === 'messages' ? 'bg-blue-500' : 'bg-emerald-500'
              )} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{otherUser?.display_name || 'Loading...'}</h2>
            <p className="text-xs text-muted-foreground">
              {isTyping ? (
                <span className="text-primary flex items-center gap-1 animate-pulse">
                  {getActivityIcon(activityType)}
                  {getActivityText(activityType)}
                </span>
              ) : isOnline ? (
                <span className={currentSection === 'messages' ? 'text-blue-500' : 'text-emerald-500'}>
                  {currentSection === 'messages' ? 'Active now' : 'Online'}
                </span>
              ) : lastSeen ? (
                `last seen ${formatLastSeen(lastSeen)}`
              ) : (
                <span className="text-gray-400">Offline</span>
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
      </header>

      {/* Search Bar - FIXED below header */}
      {showSearch && (
        <div className="fixed top-[60px] left-0 right-0 p-2 border-b border-border/50 bg-background/50 backdrop-blur-sm z-40">
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

      {/* Messages - FIXED scrollable area between header and input */}
      <div 
        className="chat-messages-area left-0 right-0 px-3"
        style={{ 
          top: showSearch ? 110 : 60,
          bottom: showVoiceRecorder ? 80 : (replyingTo || previewMedia ? 140 : 76) + inputBottom 
        }}
        onScroll={handleScroll}
        ref={scrollAreaRef}
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
                {dateMessages.map((msg) => {
                  const isFirstUnread = msg.id === firstUnreadId;
                  const isCallLog = msg.media_type === 'call_log' && msg.content.startsWith('CALL_LOG:');
                  
                  // Parse call log data
                  let callLogData = null;
                  if (isCallLog) {
                    const parts = msg.content.split(':');
                    // Format: CALL_LOG:type:status:duration:isOutgoing
                    if (parts.length >= 5) {
                      callLogData = {
                        callType: parts[1] as 'voice' | 'video',
                        callStatus: parts[2] as 'answered' | 'missed' | 'declined',
                        duration: parseInt(parts[3]) || 0,
                        isOutgoing: parts[4] === 'true',
                      };
                    }
                  }
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {isFirstUnread && (
                        <div 
                          ref={firstUnreadRef}
                          className="flex items-center gap-3 py-2 my-2"
                        >
                          <div className="flex-1 h-px bg-primary/50" />
                          <span className="text-xs font-medium text-primary px-2">
                            Unread messages
                          </span>
                          <div className="flex-1 h-px bg-primary/50" />
                        </div>
                      )}
                      
                      {isCallLog && callLogData ? (
                        <div className={cn(
                          "flex py-2",
                          msg.sender_id === user?.id ? "justify-end" : "justify-start"
                        )}>
                          <CallLogBubble
                            callType={callLogData.callType}
                            callStatus={callLogData.callStatus}
                            duration={callLogData.duration}
                            isOutgoing={msg.sender_id === user?.id}
                            createdAt={msg.created_at}
                            isOwn={msg.sender_id === user?.id}
                          />
                        </div>
                      ) : (
                        <ModernMessageBubble
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
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-center pl-4 pb-2">
              <TypingIndicator 
                activityType={activityType} 
                userName={otherUser?.display_name?.split(' ')[0] || 'User'} 
              />
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="fixed right-4 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 z-50"
          style={{ bottom: (showVoiceRecorder ? 100 : 96) + inputBottom }}
          onClick={scrollToBottom}
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      )}

      {/* Reply Preview - FIXED above input */}
      {replyingTo && (
        <div 
          className="chat-input-fixed flex items-center gap-3 px-4 py-2 bg-primary/5 border-t border-border/50 z-40"
          style={{ bottom: 64 + inputBottom }}
        >
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

      {/* Media Preview - FIXED above input */}
      {previewMedia && (
        <div 
          className="chat-input-fixed flex items-center gap-3 px-4 py-2 bg-muted/50 border-t border-border/50 z-40"
          style={{ bottom: 64 + inputBottom }}
        >
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

      {/* Voice Recorder - FIXED at bottom */}
      {showVoiceRecorder && (
        <div 
          className="chat-input-fixed px-4 py-3 bg-muted/50 border-t border-border/50 z-40"
          style={{ bottom: inputBottom }}
        >
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => {
              setShowVoiceRecorder(false);
              stopTyping();
            }}
            onStartRecording={() => handleTyping('voice_recording')}
          />
        </div>
      )}

      {/* Input Area - FIXED at bottom, adjusts with keyboard */}
      {!showVoiceRecorder && (
        <div 
          className="chat-input-fixed p-3 border-t border-border/50 bg-background/95 backdrop-blur-lg z-40"
          style={{ bottom: inputBottom, paddingBottom: `max(12px, env(safe-area-inset-bottom))` }}
        >
          <div className="flex items-end gap-2">
            <AttachmentPicker onFileSelect={handleFileSelect} />
            
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={newMessage}
                onFocus={() => {
                  handleTyping('focused');
                  // Scroll to bottom when input is focused to keep messages visible
                  setTimeout(() => {
                    scrollToBottom();
                  }, 300);
                }}
                onBlur={() => {
                  if (!newMessage.trim()) stopTyping();
                }}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (e.target.value.trim()) {
                    handleTyping('typing');
                  }
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
              <Popover onOpenChange={(open) => open && handleTyping('emoji')}>
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
                        onClick={() => {
                          setNewMessage(prev => prev + emoji);
                          handleTyping('typing');
                        }}
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

      {/* Media Upload Modal */}
      <MediaUploadModal
        open={showMediaUpload}
        onClose={() => {
          setShowMediaUpload(false);
          setMediaUploadFile(null);
          stopTyping();
        }}
        file={mediaUploadFile}
        fileType={mediaUploadType}
        onSend={handleMediaSend}
        uploading={uploadingFile}
        uploadProgress={uploadProgress}
      />

      {/* Delete Message Modal */}
      <DeleteMessageModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setMessageToDelete(null);
        }}
        onDelete={handleDeleteWithOption}
        isOwnMessage={messageToDelete?.sender_id === user?.id}
        messageContent={messageToDelete?.content || ''}
        canDeleteForEveryone={
          messageToDelete 
            ? differenceInHours(new Date(), new Date(messageToDelete.created_at)) < 24 
            : false
        }
      />
    </div>
  );
};
