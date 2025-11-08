
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, Send, Smile, Phone, Video, Paperclip, Mic, X, 
  Image as ImageIcon, File, Search, Upload, MoreVertical, Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EnhancedMessageBubble } from './EnhancedMessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { UserMentionInput } from './UserMentionInput';
import { VoiceRecorder } from './VoiceRecorder';
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
  deleted_for_sender?: boolean;
  deleted_for_receiver?: boolean;
  is_pinned?: boolean;
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
  const [isDragging, setIsDragging] = useState(false);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const deleteTimeoutRef = useRef<NodeJS.Timeout>();

  // ... (useEffect and other functions remain the same)

  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean = false) => {
    const originalMessages = [...messages];
    const messageToDelete = messages.find(m => m.id === messageId);
    if (!messageToDelete) return;

    // Optimistically remove the message from the UI
    setMessages(messages.filter(m => m.id !== messageId));

    const deleteAction = async () => {
      try {
        const isOwnMessage = messageToDelete.sender_id === user?.id;
        
        if (deleteForEveryone && isOwnMessage) {
          const { data: canDelete } = await supabase.rpc('can_delete_for_everyone', {
            message_id: messageId,
            user_id: user!.id
          });

          if (canDelete) {
            await supabase
              .from('messages')
              .update({ deleted_for_sender: true, deleted_for_receiver: true, deleted_at: new Date().toISOString() })
              .eq('id', messageId);
          } else {
             throw new Error('48 hours have passed since message was read');
          }
        } else {
          const updateField = isOwnMessage ? 'deleted_for_sender' : 'deleted_for_receiver';
          await supabase
            .from('messages')
            .update({ [updateField]: true, deleted_at: new Date().toISOString() })
            .eq('id', messageId);
        }
      } catch (error: any) {
        // If the delete fails, revert the UI
        setMessages(originalMessages);
        toast({
          title: 'Error deleting message',
          description: error.message,
          variant: 'destructive',
        });
      }
    };

    const { dismiss } = toast({
      title: 'Message deleted',
      description: 'The message has been deleted.',
      action: (
        <Button
          variant="outline"
          onClick={() => {
            setMessages(originalMessages);
            if (deleteTimeoutRef.current) {
              clearTimeout(deleteTimeoutRef.current);
            }
            dismiss();
          }}
        >
          Undo
        </Button>
      ),
    });

    deleteTimeoutRef.current = setTimeout(() => {
      deleteAction();
    }, 5000); // 5 seconds to undo
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
          const newMessage = payload.new as Message;
          const senderId = newMessage.sender_id;

          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', senderId)
            .single();

          const enrichedMessage = {
            ...newMessage,
            profiles: profile || { display_name: 'User', avatar_url: null },
          };

          setMessages((prevMessages) => [...prevMessages, enrichedMessage]);
          markMessagesAsRead();
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
        async (payload) => {
            const updatedMessage = payload.new as Message;
            setMessages(prevMessages => 
                prevMessages.map(msg => 
                    msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
                )
            );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleClearHistory = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('clear_my_chat_history', { 
        conv_id: conversationId, 
        requestor_id: user.id 
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Your chat history has been cleared.' });
      setMessages([]); // Clear messages from view
      setShowClearHistoryDialog(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  
  // ... (the rest of the component)
};