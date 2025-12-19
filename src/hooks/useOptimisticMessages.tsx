import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimisticMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  media_url?: string | null;
  media_type?: string | null;
  reply_to_id?: string | null;
  status: 'sending' | 'sent' | 'failed';
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface SendMessageParams {
  content: string;
  conversationId: string;
  senderId: string;
  senderProfile: {
    display_name: string | null;
    avatar_url: string | null;
  };
  mediaUrl?: string;
  mediaType?: string;
  replyToId?: string;
}

interface UseOptimisticMessagesReturn {
  pendingMessages: OptimisticMessage[];
  sendMessage: (params: SendMessageParams) => Promise<string | null>;
  retryMessage: (messageId: string) => Promise<void>;
  removeFailedMessage: (messageId: string) => void;
}

export const useOptimisticMessages = (): UseOptimisticMessagesReturn => {
  const [pendingMessages, setPendingMessages] = useState<OptimisticMessage[]>([]);
  const retryQueueRef = useRef<Map<string, SendMessageParams>>(new Map());

  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const sendMessage = useCallback(async (params: SendMessageParams): Promise<string | null> => {
    const {
      content,
      conversationId,
      senderId,
      senderProfile,
      mediaUrl,
      mediaType,
      replyToId,
    } = params;

    const tempId = generateTempId();
    
    // Create optimistic message immediately
    const optimisticMsg: OptimisticMessage = {
      id: tempId,
      content,
      sender_id: senderId,
      created_at: new Date().toISOString(),
      conversation_id: conversationId,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      reply_to_id: replyToId || null,
      status: 'sending',
      profiles: senderProfile,
    };

    // Add to pending messages instantly (UI updates immediately)
    setPendingMessages(prev => [...prev, optimisticMsg]);
    
    // Store params for potential retry
    retryQueueRef.current.set(tempId, params);

    try {
      // Send to database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content,
          conversation_id: conversationId,
          sender_id: senderId,
          media_url: mediaUrl,
          media_type: mediaType,
          reply_to_id: replyToId,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Remove from pending (real message will come via realtime)
      setPendingMessages(prev => prev.filter(m => m.id !== tempId));
      retryQueueRef.current.delete(tempId);

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data.id;
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Mark as failed
      setPendingMessages(prev => 
        prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m)
      );
      
      return null;
    }
  }, []);

  const retryMessage = useCallback(async (messageId: string) => {
    const params = retryQueueRef.current.get(messageId);
    if (!params) return;

    // Reset to sending status
    setPendingMessages(prev => 
      prev.map(m => m.id === messageId ? { ...m, status: 'sending' as const } : m)
    );

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: params.content,
          conversation_id: params.conversationId,
          sender_id: params.senderId,
          media_url: params.mediaUrl,
          media_type: params.mediaType,
          reply_to_id: params.replyToId,
        });

      if (error) throw error;

      // Remove from pending
      setPendingMessages(prev => prev.filter(m => m.id !== messageId));
      retryQueueRef.current.delete(messageId);

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', params.conversationId);
    } catch (error) {
      console.error('Retry failed:', error);
      setPendingMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, status: 'failed' as const } : m)
      );
    }
  }, []);

  const removeFailedMessage = useCallback((messageId: string) => {
    setPendingMessages(prev => prev.filter(m => m.id !== messageId));
    retryQueueRef.current.delete(messageId);
  }, []);

  return {
    pendingMessages,
    sendMessage,
    retryMessage,
    removeFailedMessage,
  };
};

export default useOptimisticMessages;
