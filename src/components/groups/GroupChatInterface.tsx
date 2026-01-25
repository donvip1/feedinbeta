import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useGroupRealtime, useGroupTyping, GroupMessagePayload } from '@/hooks/useGroupRealtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Send, Smile, Mic, X, Image as ImageIcon, 
  Paperclip, ChevronDown, Reply, Camera, MapPin, FileText, User,
  Shield, Clock, EyeOff, RefreshCw, Sparkles, Calendar, UserPlus, UserCheck,
  MoreVertical, ArrowLeft, BarChart3
} from 'lucide-react';
import { GroupChatHeader } from './GroupChatHeader';
import { GroupMessageBubble } from './GroupMessageBubble';
import { GroupTypingIndicator } from './GroupTypingIndicator';
import { GroupChatMenu } from './GroupChatMenu';
import { GroupInfoSheet } from './GroupInfoSheet';
import { GroupMembersSheet } from './GroupMembersSheet';
import { AttachmentPicker } from '@/components/messages/AttachmentPicker';
import { VoiceRecorder } from '@/components/messages/VoiceRecorder';
import { MediaUploadModal } from '@/components/messages/MediaUploadModal';
import { MediaPreviewBar } from '@/components/messages/MediaPreviewBar';
import { CreatePollModal } from './polls/CreatePollModal';
import { PollCard } from './polls/PollCard';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { chatSounds } from '@/lib/chat-sounds';

// Retention options matching the reference design
const RETENTION_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '24 Hours', value: 24 * 60 * 60 * 1000 },
  { label: '3 Days', value: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 Days', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '1 Month', value: 30 * 24 * 60 * 60 * 1000 },
];

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  file_size?: number | null;
  reply_to_id?: string | null;
  reply_to_message?: {
    content: string;
    sender: {
      display_name: string;
    };
    media_url?: string | null;
    media_type?: string | null;
  } | null;
  sender: {
    id: string;
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
  is_pinned?: boolean;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  is_secret?: boolean;
  view_once_timer?: number;
}

interface Group {
  id: string;
  name: string;
  avatar_url?: string | null;
  description?: string | null;
  is_private?: boolean;
}

interface Member {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface GroupChatInterfaceProps {
  groupId: string;
  onBack: () => void;
}

export const GroupChatInterface = ({ groupId, onBack }: GroupChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [isLoading, setIsLoading] = useState(true);
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; displayName: string; activityType?: string }>>([]);
  
  // New features from reference design
  const [secretMode, setSecretMode] = useState(false);
  const [viewOnceTimer, setViewOnceTimer] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [chatRetention, setChatRetention] = useState(0);
  const [showRetentionMenu, setShowRetentionMenu] = useState(false);
  const [isMember, setIsMember] = useState(true);
  const [pendingJoin, setPendingJoin] = useState(false);
  
  // Sheet states for new Telegram-style menu
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showMembersSheet, setShowMembersSheet] = useState(false);
  
  // Media upload modal state
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadType, setMediaUploadType] = useState<'image' | 'video' | 'file'>('image');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  
  // Pending file for inline preview (before sending)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  // Poll state
  const [showPollModal, setShowPollModal] = useState(false);
  const [polls, setPolls] = useState<Record<string, any>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const { setTyping, stopTyping } = useGroupTyping(groupId);
  
  // Handle new message from realtime
  const handleRealtimeMessage = useCallback((payload: GroupMessagePayload) => {
    fetchSingleMessage(payload.id);
    chatSounds.playReceive();
    
    if (isNearBottomRef.current) {
      setTimeout(() => scrollToBottom(), 100);
    } else {
      setShowScrollButton(true);
      setNewMessagesCount(prev => prev + 1);
    }
  }, []);
  
  // Handle typing from realtime
  const handleRealtimeTyping = useCallback((typing: { user_id: string; is_typing: boolean; activity_type?: string }) => {
    const member = members.find(m => m.user_id === typing.user_id);
    
    setTypingUsers(prev => {
      if (typing.is_typing) {
        const existing = prev.findIndex(u => u.userId === typing.user_id);
        const userData = {
          userId: typing.user_id,
          displayName: member?.display_name || 'User',
          activityType: typing.activity_type,
        };
        
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = userData;
          return next;
        }
        return [...prev, userData];
      } else {
        return prev.filter(u => u.userId !== typing.user_id);
      }
    });
  }, [members]);
  
  // Setup realtime subscription
  useGroupRealtime({
    groupId,
    onNewMessage: handleRealtimeMessage,
    onMessageUpdate: (msg) => {
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, ...msg } : m
      ));
    },
    onMessageDelete: ({ id }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    },
    onTyping: handleRealtimeTyping,
  });
  
  // Load group data
  useEffect(() => {
    if (!user?.id || !groupId) return;
    loadGroup();
    loadMembers();
    loadMessages();
  }, [user?.id, groupId]);
  
  const fetchSingleMessage = async (messageId: string) => {
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (data) {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', data.sender_id)
        .single();
      
      const formattedMsg: GroupMessage = {
        ...data,
        sender: senderProfile || { id: data.sender_id, display_name: 'Unknown', avatar_url: null },
        reactions: [],
      };
      
      setMessages(prev => {
        if (prev.some(m => m.id === messageId)) return prev;
        return [...prev, formattedMsg];
      });
    }
  };
  
  const loadGroup = async () => {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();
    
    if (data) {
      setGroup(data);
    }
  };
  
  const loadMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select(`
        user_id,
        role,
        profile:profiles!group_members_user_id_fkey(display_name, avatar_url)
      `)
      .eq('group_id', groupId);
    
    if (data) {
      const formattedMembers = data.map(m => ({
        user_id: m.user_id,
        role: m.role,
        display_name: (m.profile as any)?.display_name || 'Unknown',
        avatar_url: (m.profile as any)?.avatar_url || null,
      }));
      
      setMembers(formattedMembers);
      setMemberCount(formattedMembers.length);
      
      const currentMember = formattedMembers.find(m => m.user_id === user?.id);
      const userRole = currentMember?.role || 'member';
      setCurrentUserRole(userRole);
      setIsAdmin(userRole === 'admin' || userRole === 'owner' || userRole === 'moderator');
      setIsMember(!!currentMember);
    }
  };
  
  const loadMessages = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(500);
      
      if (error) throw error;
      
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', senderIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      let formattedMessages: GroupMessage[] = (data || []).map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || { id: msg.sender_id, display_name: 'Unknown', avatar_url: null },
        reactions: [],
      }));
      
      // Apply retention filter
      if (chatRetention > 0) {
        formattedMessages = formattedMessages.filter(msg => {
          const age = Date.now() - new Date(msg.created_at).getTime();
          return age <= chatRetention;
        });
      }
      
      setMessages(formattedMessages);
      
      if (formattedMessages.length > 0) {
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        await supabase.rpc('mark_group_messages_read', {
          p_group_id: groupId,
          p_message_id: lastMessage.id,
        });
      }
      
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
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
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const nearBottom = distanceFromBottom < 150;
    isNearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
    
    if (nearBottom) {
      setNewMessagesCount(0);
    }
  }, []);
  
  const handleSend = async (mediaUrl?: string, mediaType?: string, customContent?: string) => {
    if (!user || (!newMessage.trim() && !mediaUrl && !customContent)) return;
    
    setSending(true);
    stopTyping();
    chatSounds.playSend();
    
    const messageContent = customContent || newMessage.trim() || (mediaType?.startsWith('audio') ? '🎤 Voice message' : '📎 Attachment');
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: GroupMessage = {
      id: tempId,
      group_id: groupId,
      content: messageContent,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      reply_to_id: replyingTo?.id || null,
      reply_to_message: replyingTo ? {
        content: replyingTo.content,
        sender: { display_name: replyingTo.sender },
      } : null,
      sender: {
        id: user.id,
        display_name: 'You',
        avatar_url: null,
      },
      reactions: [],
      is_pinned: false,
      is_secret: secretMode,
      view_once_timer: viewOnceTimer,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setIsEmojiOpen(false);
    setIsMenuOpen(false);
    
    // Play send sound
    chatSounds.playSend();
    
    // Scroll to bottom after adding message - use setTimeout to ensure DOM update
    setTimeout(() => {
      scrollToBottom(false);
    }, 50);
    
    try {
      const { data: newMsg, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.id,
          content: messageContent,
          media_url: mediaUrl,
          media_type: mediaType,
          reply_to_id: replyingTo?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...optimisticMessage, id: newMsg.id, created_at: newMsg.created_at } : msg
      ));
      
      setReplyingTo(null);
    } catch (error: any) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
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
    // Set pending file for inline preview
    setPendingFile(file);
    
    setMediaUploadFile(file);
    setMediaUploadType(type);
    setShowMediaUpload(true);
    setTyping(true, type === 'image' ? 'uploading_image' : type === 'video' ? 'uploading_video' : 'uploading_file');
  };
  
  const handleClearPendingFile = () => {
    setPendingFile(null);
    setShowMediaUpload(false);
    setMediaUploadFile(null);
    stopTyping();
  };
  
  const handleMediaSend = async (file: File, caption: string) => {
    setUploadingFile(true);
    setUploadProgress(0);
    
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `groups/${groupId}/${user!.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);
      
      clearInterval(progressInterval);
      
      if (uploadError) throw uploadError;
      
      setUploadProgress(100);
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);
      
      const mediaType = file.type || 'application/octet-stream';
      await handleSend(publicUrl, mediaType, caption || undefined);
      
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
    try {
      const fileName = `${Date.now()}.webm`;
      const filePath = `groups/${groupId}/${user!.id}/voice/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, audioBlob);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);
      
      await handleSend(publicUrl, 'audio/webm');
      setShowVoiceRecorder(false);
    } catch (error: any) {
      toast({
        title: 'Failed to send voice message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    try {
      const { data: existing } = await supabase
        .from('group_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from('group_message_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('group_message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
      }
      
      loadMessages();
    } catch (error: any) {
      console.error('Error reacting:', error);
    }
  };
  
  const handleDelete = async (messageId: string) => {
    try {
      await supabase
        .from('group_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error: any) {
      toast({
        title: 'Error deleting message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const handlePin = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      await supabase
        .from('group_messages')
        .update({ is_pinned: !message.is_pinned })
        .eq('id', messageId);
      
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, is_pinned: !m.is_pinned } : m
      ));
    } catch (error: any) {
      toast({
        title: 'Error pinning message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const handleJoinGroup = async () => {
    setPendingJoin(true);
    // Simulate join request - in real app would insert to group_members
    setTimeout(() => {
      setIsMember(true);
      setPendingJoin(false);
      toast({ title: 'Joined group successfully!' });
    }, 1500);
  };
  
  const formatDateHeader = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };
  
  const shouldShowDateHeader = (index: number): boolean => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].created_at);
    const prevDate = new Date(messages[index - 1].created_at);
    return !isSameDay(currentDate, prevDate);
  };
  
  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true;
    const current = messages[index];
    const prev = messages[index - 1];
    return current.sender_id !== prev.sender_id || shouldShowDateHeader(index);
  };
  
  const isLastInGroup = (index: number): boolean => {
    if (index === messages.length - 1) return true;
    const current = messages[index];
    const next = messages[index + 1];
    return current.sender_id !== next.sender_id;
  };

  const cycleViewOnceTimer = () => {
    setViewOnceTimer(v => {
      if (v === 0) return 1;
      if (v === 1) return 10;
      if (v === 10) return 30;
      if (v === 30) return 60;
      return 0;
    });
  };
  
  if (!group) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <div className={cn(
      "flex flex-col h-[100dvh] relative font-sans transition-colors duration-300",
      secretMode ? 'bg-black' : 'bg-slate-950'
    )}>
      {/* Secret Mode Overlay Pattern */}
      {secretMode && (
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none z-0" 
          style={{ 
            backgroundImage: 'radial-gradient(#ef4444 1px, transparent 1px)', 
            backgroundSize: '20px 20px' 
          }} 
        />
      )}
      
      {/* Header - Telegram style with clickable title and 3-dot menu */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          {/* Clickable group info - opens info sheet */}
          <div 
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowGroupInfo(true)}
          >
            <img 
              src={group.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=6366f1&color=fff`} 
              className="w-9 h-9 rounded-full border border-slate-700" 
            />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white truncate">{group.name}</h3>
              <p className="text-xs text-slate-500">
                {secretMode ? 'Secret Chat' : `${memberCount} members`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-1 text-slate-400 items-center">
          {/* Secret Mode Toggle - only show for private groups */}
          {group.is_private && (
            <button 
              onClick={() => setSecretMode(!secretMode)} 
              className={cn(
                "p-2 rounded-lg transition-colors",
                secretMode ? 'bg-red-500/20 text-red-400' : 'hover:bg-slate-800 hover:text-white'
              )}
            >
              <Shield size={18} />
            </button>
          )}
          
          {/* 3-dot Menu - Telegram style */}
          <button 
            onClick={() => setShowChatMenu(true)}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative z-10 custom-scrollbar"
        onScroll={handleScroll}
        onContextMenu={e => secretMode && e.preventDefault()}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="font-semibold text-lg text-white mb-1">No messages yet</h3>
            <p className="text-slate-500 text-sm">Send the first message to start the conversation!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((message, index) => (
              <React.Fragment key={message.id}>
                {shouldShowDateHeader(index) && (
                  <div className="flex justify-center py-3">
                    <span className="text-xs text-slate-500 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-800">
                      {formatDateHeader(new Date(message.created_at))}
                    </span>
                  </div>
                )}
                <GroupMessageBubble
                  message={message}
                  isOwn={message.sender_id === user?.id}
                  isFirstInGroup={isFirstInGroup(index)}
                  isLastInGroup={isLastInGroup(index)}
                  isAdmin={isAdmin}
                  secretMode={secretMode}
                  onReply={(id, content) => setReplyingTo({ 
                    id, 
                    content, 
                    sender: message.sender.display_name || 'User',
                    mediaUrl: message.media_url,
                    mediaType: message.media_type
                  })}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onPin={handlePin}
                />
              </React.Fragment>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>
      
      {/* Typing Indicator */}
      <GroupTypingIndicator typingUsers={typingUsers} />
      
      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className={cn(
            "absolute bottom-24 right-4 z-50",
            "w-10 h-10 rounded-full",
            "bg-slate-800 text-white border border-slate-700",
            "shadow-lg hover:bg-slate-700",
            "flex items-center justify-center",
            "transition-all duration-200"
          )}
        >
          <ChevronDown className="w-5 h-5" />
          {newMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
              {newMessagesCount > 9 ? '9+' : newMessagesCount}
            </span>
          )}
        </button>
      )}
      
      {/* Reply Preview - Enhanced with media thumbnail */}
      {replyingTo && (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-t border-slate-800 z-30">
          <div className="w-1 h-12 bg-purple-500 rounded-full" />
          
          {/* Media Thumbnail Preview */}
          {replyingTo.mediaUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-purple-500/30 bg-slate-800">
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
                <div className="w-full h-full flex items-center justify-center">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-purple-400">{replyingTo.sender}</p>
            <p className="text-xs text-slate-500 truncate">
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
            className="h-6 w-6 text-slate-500 hover:text-white hover:bg-slate-800" 
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
      
      {/* Voice Recorder */}
      {showVoiceRecorder && (
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900">
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}
      
      {/* Input Area */}
      {!showVoiceRecorder && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 z-30 relative">
          {!isMember ? (
            // Non-member join prompt
            <div className="flex flex-col items-center justify-center p-4 gap-3 bg-slate-800/50 rounded-xl border border-slate-700">
              <p className="text-slate-400 text-sm">You are not a member of this group.</p>
              {pendingJoin ? (
                <button disabled className="bg-slate-700 text-slate-400 px-6 py-2 rounded-full font-bold flex items-center gap-2">
                  <UserCheck size={18} /> Request Sent
                </button>
              ) : (
                <button 
                  onClick={handleJoinGroup} 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all"
                >
                  <UserPlus size={18} /> Join Group
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Attachment Menu */}
              {isMenuOpen && (
                <div className="absolute bottom-20 left-4 flex gap-3 animate-in fade-in slide-in-from-bottom-4">
                  {[
                    { icon: ImageIcon, color: 'bg-cyan-500', type: 'image' as const, action: 'file' },
                    { icon: Camera, color: 'bg-red-500', type: 'image' as const, action: 'file' },
                    { icon: BarChart3, color: 'bg-yellow-500', type: 'poll' as const, action: 'poll' },
                    { icon: FileText, color: 'bg-purple-500', type: 'file' as const, action: 'file' },
                    { icon: User, color: 'bg-orange-500', type: 'file' as const, action: 'file' }
                  ].map((btn, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        if (btn.action === 'poll') {
                          setShowPollModal(true);
                          setIsMenuOpen(false);
                        } else {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = btn.type === 'image' ? 'image/*' : '*/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleFileSelect(file, btn.type as 'image' | 'video' | 'file');
                          };
                          input.click();
                          setIsMenuOpen(false);
                        }
                      }}
                      className={cn(
                        btn.color,
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
                      )}
                    >
                      <btn.icon size={20} />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)} 
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    isMenuOpen ? 'bg-slate-800 text-white rotate-45' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <Paperclip size={20} />
                </button>
                
                <div className="flex-1 bg-slate-800 rounded-2xl flex items-center p-1 border border-slate-700 focus-within:border-purple-500/50 transition-colors relative">
                  <button 
                    onClick={() => setIsEmojiOpen(!isEmojiOpen)} 
                    className="p-2 text-slate-400 hover:text-yellow-400 transition-colors"
                  >
                    <Smile size={20} />
                  </button>
                  
                  {/* Secret Mode Timer */}
                  {secretMode && (
                    <button 
                      onClick={cycleViewOnceTimer}
                      className={cn(
                        "p-2 transition-colors flex items-center gap-1 font-bold text-xs",
                        viewOnceTimer > 0 ? 'text-red-400 bg-red-900/20 rounded-lg' : 'text-slate-500'
                      )}
                    >
                      {viewOnceTimer === 1 ? <EyeOff size={16} className="text-purple-400"/> : <Clock size={16} />}
                      {viewOnceTimer > 1 && `${viewOnceTimer}s`}
                      {viewOnceTimer === 1 && "1x"}
                    </button>
                  )}
                  
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      if (e.target.value) setTyping(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    onBlur={stopTyping}
                    placeholder={secretMode ? "Message will self-destruct..." : "Type a message..."}
                    className="flex-1 bg-transparent border-none focus-visible:ring-0 text-white placeholder-slate-500 text-sm px-2"
                    disabled={sending}
                  />
                  
                  {/* AI Compose Button */}
                  <button 
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      newMessage ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-purple-400'
                    )}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                
                {newMessage.trim() ? (
                  <button
                    onClick={() => handleSend()}
                    disabled={sending}
                    className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowVoiceRecorder(true)}
                    className="p-3 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Mic size={20} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Upload Progress */}
      {uploadingFile && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl max-w-xs w-full mx-4">
            <p className="text-sm text-slate-400 mb-3">Uploading...</p>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        </div>
      )}
      
      {/* Media Upload Modal */}
      {mediaUploadFile && (
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
      )}
      
      {/* Click outside to close menus */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => setIsMenuOpen(false)} 
        />
      )}
      
      {/* Telegram-style Group Chat Menu */}
      <GroupChatMenu
        open={showChatMenu}
        onOpenChange={setShowChatMenu}
        groupId={groupId}
        group={group}
        isAdmin={isAdmin}
        isMember={isMember}
        memberCount={memberCount}
        onShowInfo={() => setShowGroupInfo(true)}
        onShowMembers={() => setShowMembersSheet(true)}
        chatRetention={chatRetention}
        onRetentionChange={(value) => {
          setChatRetention(value);
          loadMessages();
        }}
      />
      
      {/* Group Info Sheet - shown when clicking group title */}
      <GroupInfoSheet
        open={showGroupInfo}
        onOpenChange={setShowGroupInfo}
        groupId={groupId}
        group={group}
        members={members}
        memberCount={memberCount}
        isAdmin={isAdmin}
        isMember={isMember}
        onShowMembers={() => {
          setShowGroupInfo(false);
          setShowMembersSheet(true);
        }}
      />
      
      {/* Group Members Sheet */}
      <GroupMembersSheet
        open={showMembersSheet}
        onOpenChange={setShowMembersSheet}
        groupId={groupId}
        members={members}
        isAdmin={isAdmin}
        currentUserRole={currentUserRole}
        onMembersChanged={loadMembers}
      />
      
      {/* Poll Creation Modal */}
      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        groupId={groupId}
        onPollCreated={async (pollId) => {
          // Send a message with the poll
          await supabase.from('group_messages').insert({
            group_id: groupId,
            sender_id: user?.id,
            content: `📊 Poll created`,
          });
          loadMessages();
        }}
      />
    </div>
  );
};

export default GroupChatInterface;
