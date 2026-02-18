import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { usePresence, formatLastSeen } from '@/hooks/usePresence';
import { useMessageCache } from '@/hooks/useMessageCache';
import { useMessageRealtime } from '@/hooks/useMessageRealtime';
import { MessagePayload, TypingPayload } from '@/lib/unified-realtime';
import { chatSounds } from '@/lib/chat-sounds';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, Send, Smile, Phone, Video, Mic, X, Image as ImageIcon, 
  Paperclip, Search, MoreVertical, Circle, ChevronDown, Reply, Pin,
  Gift, Sparkles, Clock
} from 'lucide-react';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { AttachmentPicker } from './AttachmentPicker';
import { ModernMessageBubble } from './ModernMessageBubble';
import { CallLogBubble } from './CallLogBubble';
import { TypingIndicator, getActivityText, getActivityIcon, ActivityType } from './TypingIndicator';
import { VoiceRecorder } from './VoiceRecorder';
import { MediaUploadModal } from './MediaUploadModal';
import { MediaPreviewBar } from './MediaPreviewBar';
import { DeleteMessageModal, DeleteOption } from './DeleteMessageModal';
import { AIReplySuggestions } from './AIReplySuggestions';
import { ChatGiftButton } from './ChatGiftButton';
import { ForwardMessageSheet } from './ForwardMessageSheet';
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
      avatar_url?: string | null;
    };
  }>;
  read_receipts?: Array<{
    user_id: string;
    read_at: string;
  }>;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  is_pinned?: boolean;
  edited_at?: string | null;
  forwarded_from?: {
    original_sender_id: string;
    original_sender_name: string;
    original_timestamp: string;
    source_type: 'dm' | 'group';
    source_id: string;
  } | null;
}

interface ChatInterfaceProps {
  conversationId: string;
  onBack: () => void;
  onMessagesRead?: () => void;
  highlightMessageId?: string | null;
  onHighlightCleared?: () => void;
}

const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const ModernChatInterface = ({ 
  conversationId, 
  onBack, 
  onMessagesRead,
  highlightMessageId,
  onHighlightCleared 
}: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { cachedMessages, hasCachedData, saveToCache, appendMessage } = useMessageCache(conversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>('typing');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ 
    id: string; 
    content: string; 
    sender: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
  } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  
  // Media upload modal state
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadType, setMediaUploadType] = useState<'image' | 'video' | 'file'>('image');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  
  // Pending file for inline preview (before sending)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  
  // AI suggestions state
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  
  // Scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Forwarding state
  const [forwardingMessage, setForwardingMessage] = useState<{
    id: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    senderId: string;
    senderName: string;
    timestamp: string;
  } | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const hasScrolledToUnread = useRef(false);
  const isUserScrolling = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastScrollPositionRef = useRef<number>(0);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasScrolledToHighlight = useRef(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(highlightMessageId || null);

  // Load cached messages immediately on mount
  useEffect(() => {
    if (hasCachedData && cachedMessages.length > 0 && messages.length === 0) {
      // Show cached messages immediately while loading fresh data
      const formattedCached = cachedMessages.map(msg => ({
        ...msg,
        reactions: [],
        read_receipts: [],
        status: 'delivered' as Message['status'],
        is_pinned: false,
        edited_at: null,
        reply_to_id: null,
        reply_to_message: null,
      }));
      setMessages(formattedCached);
      setIsLoading(false);
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [hasCachedData, cachedMessages]);

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

  // Handle new message from realtime
  const handleRealtimeMessage = useCallback((message: MessagePayload) => {
    console.log('[Realtime] New message from other user:', message.id);
    
    setMessages(prev => {
      // Don't add duplicates
      if (prev.some(m => m.id === message.id)) return prev;
      
      const formattedMsg: Message = {
        id: message.id,
        content: message.content,
        sender_id: message.sender_id,
        created_at: message.created_at,
        media_url: message.media_url || null,
        media_type: message.media_type || null,
        reply_to_id: message.reply_to_id || null,
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
    
    // Cache the message
    appendMessage({
      id: message.id,
      content: message.content,
      sender_id: message.sender_id,
      created_at: message.created_at,
      media_url: message.media_url || null,
      media_type: message.media_type || null,
      profiles: {
        display_name: otherUser?.display_name || 'Unknown',
        avatar_url: otherUser?.avatar_url || null
      },
    });
    
    // Scroll to bottom if near bottom
    if (isNearBottomRef.current) {
      setTimeout(() => scrollToBottom(), 100);
      markMessagesAsRead([{ id: message.id, sender_id: message.sender_id, read_receipts: [] } as Message]);
    } else {
      setShowScrollButton(true);
      setNewMessagesCount(prev => prev + 1);
    }
    
    // Play receive sound for messages from other users
    chatSounds.playReceive();
  }, [otherUser, appendMessage]);

  // Handle typing indicator from realtime
  const handleRealtimeTyping = useCallback((typing: TypingPayload) => {
    setIsTyping(typing.is_typing);
    setActivityType((typing.activity_type as ActivityType) || 'typing');
  }, []);

  // Handle message delete from realtime
  const handleRealtimeDelete = useCallback((payload: { id: string }) => {
    setMessages(prev => prev.filter(m => m.id !== payload.id));
  }, []);

  // Handle read receipt from realtime
  const handleRealtimeReceipt = useCallback((receipt: { message_id: string; user_id: string; read_at: string }) => {
    setMessages(prev => prev.map(msg =>
      msg.id === receipt.message_id
        ? { ...msg, status: 'read' as Message['status'], read_receipts: [...(msg.read_receipts || []), { user_id: receipt.user_id, read_at: receipt.read_at }] }
        : msg
    ));
  }, []);

  // Handle presence change from realtime  
  const handleRealtimePresence = useCallback((isOnline: boolean) => {
    // Presence is now handled by the unified manager
    console.log('[Realtime] Other user presence:', isOnline);
  }, []);

  // Use unified realtime hook - SINGLE subscription for everything
  useMessageRealtime({
    conversationId,
    otherUserId: otherUser?.id,
    onNewMessage: handleRealtimeMessage,
    onMessageDelete: handleRealtimeDelete,
    onTyping: handleRealtimeTyping,
    onReadReceipt: handleRealtimeReceipt,
    onPresenceChange: handleRealtimePresence,
  });

  // Initialize data on mount
  useEffect(() => {
    const init = async () => {
      await loadOtherUser();
      await loadMessages();
    };
    init();
  }, [conversationId, user?.id]);

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

  // Scroll to highlighted message from notification deep-link
  useEffect(() => {
    if (highlightMessageId && messages.length > 0 && !hasScrolledToHighlight.current) {
      // Wait for DOM to update
      setTimeout(() => {
        const messageEl = messageRefs.current.get(highlightMessageId);
        if (messageEl) {
          messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolledToHighlight.current = true;
          
          // Clear highlight after animation
          setTimeout(() => {
            setHighlightedMessageId(null);
            onHighlightCleared?.();
          }, 3000);
        }
      }, 300);
    }
  }, [highlightMessageId, messages, onHighlightCleared]);

  // With flexbox layout, browser handles keyboard automatically
  // No need for manual keyboard offset calculations

  // Only scroll to bottom for own messages or if user is near bottom
  const scrollToBottomIfNeeded = useCallback(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    }
  }, []);

  const scrollToBottom = useCallback((immediate = false) => {
    if (scrollRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ 
            behavior: immediate ? 'auto' : 'smooth',
            block: 'end'
          });
        }
      });
    }
  }, []);

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
    
    // Reset new messages count when user scrolls to bottom
    if (nearBottom) {
      setNewMessagesCount(0);
    }
    
    // Track that user is actively scrolling
    isUserScrolling.current = true;
  }, []);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      // Load ALL messages without limit - important for full history
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(display_name, avatar_url),
          reactions:message_reactions(
            emoji,
            user_id,
            user:profiles(display_name, avatar_url)
          )
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null) // Exclude soft-deleted messages
        .order('created_at', { ascending: true })
        .limit(1000); // Explicitly set high limit to get all messages

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
          reply_to_message: null, // Loaded separately if needed
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
      setIsLoading(false);
      
      // Save to cache for instant load next time
      saveToCache(formattedMessages.map(m => ({
        id: m.id,
        content: m.content,
        sender_id: m.sender_id,
        created_at: m.created_at,
        media_url: m.media_url,
        media_type: m.media_type,
        profiles: m.profiles,
      })));
      
      // Scroll to bottom to show recent messages (most important fix)
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
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
      setIsLoading(false);
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
    
    // Play send sound
    chatSounds.playSend();
    
    // Scroll to bottom after adding message - use setTimeout to ensure DOM update
    setTimeout(() => {
      scrollToBottom(false);
    }, 50);

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
      
      // Keep input focused for continuous typing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
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

    // Set pending file for inline preview
    setPendingFile(file);
    
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

  const handleClearPendingFile = () => {
    setPendingFile(null);
    setShowMediaUpload(false);
    setMediaUploadFile(null);
    stopTyping();
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

    // Check if user already has ANY reaction on this message
    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions?.find(r => r.user_id === user.id);
    const isSameEmoji = existingReaction?.emoji === emoji;

    // Optimistically update UI first
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const currentReactions = msg.reactions || [];
      
      if (isSameEmoji) {
        // Remove the reaction (toggle off)
        return {
          ...msg,
          reactions: currentReactions.filter(r => r.user_id !== user.id),
        };
      } else if (existingReaction) {
        // Replace existing reaction with new emoji
        return {
          ...msg,
          reactions: currentReactions.map(r => 
            r.user_id === user.id 
              ? { ...r, emoji } 
              : r
          ),
        };
      } else {
        // Add new reaction
        return {
          ...msg,
          reactions: [
            ...currentReactions,
            {
              emoji,
              user_id: user.id,
              user: {
                display_name: user.user_metadata?.display_name || 'You',
                avatar_url: user.user_metadata?.avatar_url || null,
              },
            },
          ],
        };
      }
    }));

    try {
      if (isSameEmoji) {
        // Remove the reaction
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id);
      } else if (existingReaction) {
        // Delete old reaction then insert new one (replace)
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id);
        
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
      } else {
        // Insert new reaction
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

  // Schedule message handler
  const handleScheduleMessage = async (scheduledAt: Date) => {
    if (!user || !newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          content: newMessage.trim(),
          scheduled_at: scheduledAt.toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Message scheduled',
        description: `Your message will be sent on ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });

      setNewMessage('');
      setShowScheduleModal(false);
    } catch (error: any) {
      toast({
        title: 'Error scheduling message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Function to initiate a call
  const initiateCall = async (callType: 'voice' | 'video') => {
    if (!user) {
      toast({
        title: 'Cannot start call',
        description: 'Please sign in to make calls',
        variant: 'destructive',
      });
      return;
    }

    // If otherUser is not loaded yet, fetch it on-demand
    let targetUserId = otherUser?.id;
    
    if (!targetUserId) {
      toast({
        title: 'Loading...',
        description: 'Getting user information, please wait',
      });
      
      try {
        // Fetch other user on-demand from the conversation
        const { data: participant, error: participantError } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .neq('user_id', user.id)
          .maybeSingle();
        
        if (participantError || !participant?.user_id) {
          throw new Error('Could not find other user in conversation');
        }
        
        targetUserId = participant.user_id;
        
        // Also fetch and cache their profile for display
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url')
          .eq('id', targetUserId)
          .single();
        
        if (profile) {
          setOtherUser(profile);
        }
      } catch (error: any) {
        console.error('[Call] Error fetching other user:', error);
        toast({
          title: 'Cannot start call',
          description: 'User information not available. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const { data: callData, error } = await supabase
        .from('call_logs')
        .insert({
          caller_id: user.id,
          receiver_id: targetUserId,
          call_type: callType,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Send push notification to receiver
      console.log('[Call] Sending push notification for call:', callData.id);
      supabase.functions.invoke('send-call-notification', {
        body: {
          callId: callData.id,
          callerId: user.id,
          receiverId: targetUserId,
          callType,
          callerName: user.user_metadata?.display_name || user.email,
        },
      }).then(result => {
        console.log('[Call] Push notification result:', result.data);
      }).catch(err => {
        console.error('[Call] Failed to send push notification:', err);
      });

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

  // inputBottom is already calculated at the top of the component

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gradient-to-b from-background to-background/95 overflow-hidden">
      {/* Header - Flex shrink 0 to stay at top */}
      <header className="flex-shrink-0 flex items-center gap-2 px-2 py-2 border-b border-border/50 bg-background/95 backdrop-blur-lg z-50 min-h-[52px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden shrink-0 h-8 w-8 hover:bg-primary/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div 
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer overflow-hidden"
          onClick={() => otherUser && navigate(`/profile/${otherUser.username || otherUser.id}`)}
        >
          <div className="relative shrink-0">
            <Avatar className="w-9 h-9 ring-2 ring-primary/20">
              <AvatarImage src={otherUser?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-sm">
                {otherUser?.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {isOnline && (
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                currentSection === 'messages' ? 'bg-blue-500' : 'bg-emerald-500'
              )} />
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <h2 className="font-semibold truncate text-sm flex items-center gap-1">{otherUser?.display_name || 'Loading...'} {otherUser?.id && <VerifiedBadge userId={otherUser.id} size="sm" />}</h2>
            <p className="text-xs text-muted-foreground truncate">
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

        {/* Action buttons - Always visible, never shrink */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10"
            onClick={() => initiateCall('voice')}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10"
            onClick={() => initiateCall('video')}
          >
            <Video className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
                <MoreVertical className="w-4 h-4" />
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

      {/* Search Bar - Below header */}
      {showSearch && (
        <div className="flex-shrink-0 p-2 border-b border-border/50 bg-background/50 backdrop-blur-sm z-40">
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

      {/* Messages - Flex grow to fill remaining space, scrollable */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3"
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
                  
                  const isHighlighted = msg.id === highlightedMessageId;
                  
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
                      
                      <div 
                        ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                        className={cn(
                          "transition-all duration-500",
                          isHighlighted && "bg-primary/20 ring-2 ring-primary/50 rounded-lg animate-pulse"
                        )}
                      >
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
                          currentUserId={user?.id}
                          onReply={(id, content) => setReplyingTo({ 
                            id, 
                            content, 
                            sender: msg.profiles.display_name || 'Unknown',
                            mediaUrl: msg.media_url,
                            mediaType: msg.media_type
                          })}
                          onReact={handleReact}
                          onDelete={handleDelete}
                          onForward={(id) => {
                            const message = messages.find(m => m.id === id);
                            if (message) {
                              setForwardingMessage({
                                id: message.id,
                                content: message.content,
                                mediaUrl: message.media_url,
                                mediaType: message.media_type,
                                senderId: message.sender_id,
                                senderName: message.profiles.display_name || 'Unknown',
                                timestamp: message.created_at,
                              });
                            }
                          }}
                        />
                        )}
                      </div>
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
          
          <div ref={scrollRef} className="h-1" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-4 bottom-24 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 z-50 gap-1 px-3"
          onClick={() => {
            scrollToBottom();
            setNewMessagesCount(0);
          }}
        >
          {newMessagesCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {newMessagesCount}
            </span>
          )}
          <ChevronDown className="w-4 h-4" />
        </Button>
      )}

      {/* Reply Preview - Above input in flex layout - Enhanced with media thumbnail */}
      {replyingTo && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-primary/5 border-t border-border/50 z-40">
          <div className="w-1 h-12 bg-primary rounded-full" />
          
          {/* Media Thumbnail Preview */}
          {replyingTo.mediaUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-primary/30 bg-muted">
              {replyingTo.mediaType?.startsWith('video') ? (
                <video 
                  src={replyingTo.mediaUrl} 
                  className="w-full h-full object-cover"
                  muted
                />
              ) : replyingTo.mediaType?.startsWith('image') ? (
                <img 
                  src={replyingTo.mediaUrl} 
                  alt="Reply media" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">Replying to {replyingTo.sender}</p>
            <p className="text-sm text-muted-foreground truncate">
              {replyingTo.mediaUrl && !replyingTo.content ? (
                <span className="flex items-center gap-1">
                  {replyingTo.mediaType?.startsWith('image') ? '📷 Photo' : 
                   replyingTo.mediaType?.startsWith('video') ? '🎬 Video' : 
                   replyingTo.mediaType?.startsWith('audio') ? '🎵 Audio' : '📎 File'}
                </span>
              ) : replyingTo.content}
            </p>
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

      {/* Media Preview Bar - Telegram/WhatsApp style with file size */}
      {pendingFile && !showMediaUpload && (
        <MediaPreviewBar
          file={pendingFile}
          onRemove={handleClearPendingFile}
        />
      )}

      {/* Voice Recorder - At bottom in flex layout */}
      {showVoiceRecorder && (
        <div className="flex-shrink-0 px-4 py-3 bg-muted/50 border-t border-border/50 z-40 pb-[max(12px,env(safe-area-inset-bottom))]">
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

      {/* AI Reply Suggestions */}
      {showAiSuggestions && messages.length > 0 && !showVoiceRecorder && user && (
        <div className="flex-shrink-0 px-3 pt-2 pb-0 border-t border-border/50 bg-background/95 backdrop-blur-lg z-40">
          <AIReplySuggestions
            conversationId={conversationId}
            lastMessages={messages.slice(-5).map(m => ({
              content: m.content,
              sender_id: m.sender_id
            }))}
            currentUserId={user.id}
            onSelectSuggestion={(suggestion) => {
              setNewMessage(suggestion);
              setShowAiSuggestions(false);
            }}
            onClose={() => setShowAiSuggestions(false)}
          />
        </div>
      )}

      {/* Input Area - At bottom in flex layout */}
      {!showVoiceRecorder && (
        <div className="flex-shrink-0 p-3 border-t border-border/50 bg-background/95 backdrop-blur-lg z-40 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <AttachmentPicker onFileSelect={handleFileSelect} />
            
            {/* Gift Button */}
            {otherUser?.id && (
              <ChatGiftButton 
                recipientId={otherUser.id} 
                recipientName={otherUser.display_name || 'User'}
                recipientAvatar={otherUser.avatar_url}
                conversationId={conversationId}
              />
            )}
            
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
              <div className="flex items-center gap-1">
                {/* Schedule Button - only show for text messages */}
                {newMessage.trim() && !previewMedia && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 rounded-full hover:bg-primary/10"
                    onClick={() => setShowScheduleModal(true)}
                    title="Schedule message"
                  >
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  </Button>
                )}
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
              </div>
            ) : (
              <div className="flex gap-1">
                {/* AI Suggestions Toggle */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "shrink-0 rounded-full",
                    showAiSuggestions ? "text-primary bg-primary/10" : "hover:bg-primary/10"
                  )}
                  onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                  title="AI Smart Replies"
                >
                  <Sparkles className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 rounded-full hover:bg-primary/10"
                  onClick={() => setShowVoiceRecorder(true)}
                >
                  <Mic className="w-5 h-5" />
                </Button>
              </div>
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
          setPendingFile(null);
          stopTyping();
        }}
        file={mediaUploadFile}
        fileType={mediaUploadType}
        onSend={(file, caption) => {
          setPendingFile(null);
          handleMediaSend(file, caption);
        }}
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
      
      {/* Forward Message Sheet */}
      <ForwardMessageSheet
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage ? {
          ...forwardingMessage,
          sourceType: 'dm',
          sourceId: conversationId,
        } : null}
      />
      
      {/* Schedule Message Modal */}
      <ScheduleMessageModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleScheduleMessage}
        messageContent={newMessage}
      />
    </div>
  );
};
