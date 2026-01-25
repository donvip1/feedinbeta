import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ForwardMessageParams {
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  originalSenderId: string;
  originalSenderName: string;
  originalTimestamp: string;
  sourceType: 'dm' | 'group';
  sourceId: string;
}

export interface ForwardTarget {
  type: 'conversation' | 'group';
  id: string;
  name: string;
  avatar?: string;
}

interface UseForwardMessageResult {
  forwardToConversation: (conversationId: string, message: ForwardMessageParams) => Promise<boolean>;
  forwardToGroup: (groupId: string, message: ForwardMessageParams) => Promise<boolean>;
  forwardToMultiple: (targets: ForwardTarget[], message: ForwardMessageParams) => Promise<{ success: number; failed: number }>;
  loading: boolean;
}

export function useForwardMessage(): UseForwardMessageResult {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createForwardedFromData = (message: ForwardMessageParams) => ({
    original_sender_id: message.originalSenderId,
    original_sender_name: message.originalSenderName,
    original_timestamp: message.originalTimestamp,
    source_type: message.sourceType,
    source_id: message.sourceId,
  });

  const forwardToConversation = useCallback(async (
    conversationId: string,
    message: ForwardMessageParams
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: message.content,
          media_url: message.mediaUrl,
          media_type: message.mediaType,
          forwarded_from: createForwardedFromData(message),
        });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return true;
    } catch (error) {
      console.error('Error forwarding to conversation:', error);
      return false;
    }
  }, [user]);

  const forwardToGroup = useCallback(async (
    groupId: string,
    message: ForwardMessageParams
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.id,
          content: message.content,
          media_url: message.mediaUrl,
          media_type: message.mediaType,
          forwarded_from: createForwardedFromData(message),
        });

      if (error) throw error;

      // Update group updated_at
      await supabase
        .from('groups')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupId);

      return true;
    } catch (error) {
      console.error('Error forwarding to group:', error);
      return false;
    }
  }, [user]);

  const forwardToMultiple = useCallback(async (
    targets: ForwardTarget[],
    message: ForwardMessageParams
  ): Promise<{ success: number; failed: number }> => {
    setLoading(true);
    let success = 0;
    let failed = 0;

    try {
      const results = await Promise.all(
        targets.map(async (target) => {
          if (target.type === 'conversation') {
            return forwardToConversation(target.id, message);
          } else {
            return forwardToGroup(target.id, message);
          }
        })
      );

      results.forEach((result) => {
        if (result) success++;
        else failed++;
      });

      if (success > 0) {
        toast.success(`Message forwarded to ${success} chat${success > 1 ? 's' : ''}`);
      }
      if (failed > 0) {
        toast.error(`Failed to forward to ${failed} chat${failed > 1 ? 's' : ''}`);
      }
    } finally {
      setLoading(false);
    }

    return { success, failed };
  }, [forwardToConversation, forwardToGroup]);

  return {
    forwardToConversation,
    forwardToGroup,
    forwardToMultiple,
    loading,
  };
}
