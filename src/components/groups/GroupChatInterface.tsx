import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useGroupRealtime, useGroupTyping, GroupMessagePayload } from '@/hooks/useGroupRealtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Send, Smile, Mic, X, Image as ImageIcon, 
  Paperclip, ChevronDown, Reply
} from 'lucide-react';
import { GroupChatHeader } from './GroupChatHeader';
import { GroupMessageBubble } from './GroupMessageBubble';
import { GroupTypingIndicator } from './GroupTypingIndicator';
import { AttachmentPicker } from '@/components/messages/AttachmentPicker';
import { VoiceRecorder } from '@/components/messages/VoiceRecorder';
import { MediaUploadModal } from '@/components/messages/MediaUploadModal';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

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
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; sender: string } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; displayName: string; activityType?: string }>>([]);
  
  // Media upload modal state
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadType, setMediaUploadType] = useState<'image' | 'video' | 'file'>('image');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  
  const { setTyping, stopTyping } = useGroupTyping(groupId);
  
  // Handle new message from realtime
  const handleRealtimeMessage = useCallback((payload: GroupMessagePayload) => {
    // Fetch the full message with sender info
    fetchSingleMessage(payload.id);
    
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
        // Add or update typing user
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
        // Remove typing user
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
      // Fetch sender profile separately
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
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();
    
    if (data) {
      setGroup(data);
    }
  };
  
  const loadMembers = async () => {
    const { data, error } = await supabase
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
      
      // Check if current user is admin
      const currentMember = formattedMembers.find(m => m.user_id === user?.id);
      setIsAdmin(currentMember?.role === 'admin' || currentMember?.role === 'moderator');
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
      
      // Fetch sender profiles for all messages
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', senderIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      const formattedMessages: GroupMessage[] = (data || []).map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || { id: msg.sender_id, display_name: 'Unknown', avatar_url: null },
        reactions: [],
      }));
      
      setMessages(formattedMessages);
      
      // Mark as read
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
  
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
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
    
    const messageContent = customContent || newMessage.trim() || (mediaType?.startsWith('audio') ? '🎤 Voice message' : '📎 Attachment');
    
    // Optimistic update
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
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    
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
      
      // Replace temp message with real one
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...optimisticMessage, id: newMsg.id, created_at: newMsg.created_at } : msg
      ));
      
      setNewMessage('');
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
    setMediaUploadFile(file);
    setMediaUploadType(type);
    setShowMediaUpload(true);
    
    const activityMap: Record<string, string> = {
      'image': 'uploading_image',
      'video': 'uploading_video',
      'file': 'uploading_file',
    };
    setTyping(true, activityMap[type] || 'uploading_file');
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
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('group_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();
      
      if (existing) {
        // Remove reaction
        await supabase
          .from('group_message_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        // Add reaction
        await supabase
          .from('group_message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
      }
      
      // Reload messages to get updated reactions
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
  
  if (!group) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <GroupChatHeader
        group={{ ...group, member_count: memberCount }}
        isAdmin={isAdmin}
        onBack={onBack}
        onShowMembers={() => navigate(`/groups/${groupId}`)}
        onShowSettings={() => navigate(`/groups/${groupId}/settings`)}
        onShareInvite={() => {/* TODO: Implement */}}
        onLeaveGroup={() => navigate('/messages')}
      />
      
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2"
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No messages yet</h3>
            <p className="text-muted-foreground text-sm">Send the first message to start the conversation!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((message, index) => (
              <React.Fragment key={message.id}>
                {shouldShowDateHeader(index) && (
                  <div className="flex justify-center py-3">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
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
                  onReply={(id, content) => setReplyingTo({ id, content, sender: message.sender.display_name || 'User' })}
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
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-24 right-4 z-50",
            "w-10 h-10 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg hover:shadow-xl",
            "flex items-center justify-center",
            "transition-all duration-200"
          )}
        >
          <ChevronDown className="w-5 h-5" />
          {newMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {newMessagesCount > 9 ? '9+' : newMessagesCount}
            </span>
          )}
        </button>
      )}
      
      {/* Reply Preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border">
          <Reply className="w-4 h-4 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">{replyingTo.sender}</p>
            <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Voice Recorder */}
      {showVoiceRecorder && (
        <div className="px-4 py-2 border-t border-border">
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}
      
      {/* Input Area */}
      {!showVoiceRecorder && (
        <div className="flex items-end gap-2 p-4 border-t border-border bg-background">
          <AttachmentPicker onFileSelect={handleFileSelect} />
          
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (e.target.value) {
                  setTyping(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onBlur={stopTyping}
              placeholder="Message..."
              className="pr-10 rounded-full bg-muted/50 border-none focus-visible:ring-1"
              disabled={sending}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <Smile className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
          
          {newMessage.trim() ? (
            <Button
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={() => handleSend()}
              disabled={sending}
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={() => setShowVoiceRecorder(true)}
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}
      
      {/* Upload Progress */}
      {uploadingFile && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-2xl shadow-xl max-w-xs w-full mx-4">
            <p className="text-sm text-muted-foreground mb-3">Uploading...</p>
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
            stopTyping();
          }}
          file={mediaUploadFile}
          fileType={mediaUploadType}
          onSend={handleMediaSend}
          uploading={uploadingFile}
          uploadProgress={uploadProgress}
        />
      )}
    </div>
  );
};

export default GroupChatInterface;
