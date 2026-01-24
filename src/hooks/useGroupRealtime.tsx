/**
 * Group Chat Realtime Hook
 * Handles real-time subscriptions for group messages, typing, and reactions
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface GroupMessagePayload {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  file_size?: number | null;
  reply_to_id?: string | null;
  is_pinned?: boolean;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface GroupTypingPayload {
  group_id: string;
  user_id: string;
  is_typing: boolean;
  activity_type?: string;
}

export interface GroupReactionPayload {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface UseGroupRealtimeOptions {
  groupId: string;
  onNewMessage?: (message: GroupMessagePayload) => void;
  onMessageUpdate?: (message: GroupMessagePayload) => void;
  onMessageDelete?: (payload: { id: string }) => void;
  onTyping?: (payload: GroupTypingPayload) => void;
  onReaction?: (payload: GroupReactionPayload) => void;
}

export function useGroupRealtime({
  groupId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
  onTyping,
  onReaction,
}: UseGroupRealtimeOptions) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { displayName: string; activityType: string }>>(new Map());

  // Stable callback refs
  const callbacksRef = useRef({
    onNewMessage,
    onMessageUpdate,
    onMessageDelete,
    onTyping,
    onReaction,
  });

  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onMessageUpdate,
      onMessageDelete,
      onTyping,
      onReaction,
    };
  });

  // Setup realtime subscription
  useEffect(() => {
    if (!user?.id || !groupId) return;

    // Create channel for this group
    const channel = supabase.channel(`group-chat:${groupId}`)
      // Listen to message inserts
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePostgresChangesPayload<GroupMessagePayload>) => {
          const message = payload.new as GroupMessagePayload;
          if (message && message.sender_id !== user.id) {
            callbacksRef.current.onNewMessage?.(message);
          }
        }
      )
      // Listen to message updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePostgresChangesPayload<GroupMessagePayload>) => {
          const message = payload.new as GroupMessagePayload;
          if (message) {
            // Check if it's a soft delete
            if (message.deleted_at) {
              callbacksRef.current.onMessageDelete?.({ id: message.id });
            } else {
              callbacksRef.current.onMessageUpdate?.(message);
            }
          }
        }
      )
      // Listen to typing indicators
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_typing_indicators',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePostgresChangesPayload<GroupTypingPayload>) => {
          const typing = payload.new as GroupTypingPayload;
          if (typing && typing.user_id !== user.id) {
            callbacksRef.current.onTyping?.(typing);
            
            // Update local typing users state
            setTypingUsers(prev => {
              const next = new Map(prev);
              if (typing.is_typing) {
                next.set(typing.user_id, {
                  displayName: 'User', // Will be resolved by component
                  activityType: typing.activity_type || 'typing',
                });
              } else {
                next.delete(typing.user_id);
              }
              return next;
            });
          }
        }
      )
      // Listen to reactions
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_message_reactions',
        },
        (payload: RealtimePostgresChangesPayload<GroupReactionPayload>) => {
          const reaction = payload.new as GroupReactionPayload;
          if (reaction) {
            callbacksRef.current.onReaction?.(reaction);
          }
        }
      );

    // Subscribe
    channel.subscribe((status) => {
      console.log('[GroupRealtime] Channel status:', status);
      setIsConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, groupId]);

  return {
    isConnected,
    typingUsers,
  };
}

/**
 * Hook for managing typing indicators in group chat
 */
export function useGroupTyping(groupId: string) {
  const { user } = useAuth();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const setTyping = useCallback(async (isTyping: boolean, activityType: string = 'typing') => {
    if (!user?.id || !groupId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    await supabase
      .from('group_typing_indicators')
      .upsert({
        group_id: groupId,
        user_id: user.id,
        is_typing: isTyping,
        activity_type: activityType,
        updated_at: new Date().toISOString(),
      });

    // Auto-clear typing after timeout
    if (isTyping) {
      const timeout = ['voice_recording', 'uploading_image', 'uploading_video', 'uploading_file'].includes(activityType)
        ? 30000
        : 3000;

      typingTimeoutRef.current = setTimeout(async () => {
        await supabase
          .from('group_typing_indicators')
          .upsert({
            group_id: groupId,
            user_id: user.id,
            is_typing: false,
            activity_type: 'typing',
            updated_at: new Date().toISOString(),
          });
      }, timeout);
    }
  }, [user?.id, groupId]);

  const stopTyping = useCallback(async () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    await setTyping(false);
  }, [setTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Clear typing status on unmount
      if (user?.id && groupId) {
        supabase
          .from('group_typing_indicators')
          .upsert({
            group_id: groupId,
            user_id: user.id,
            is_typing: false,
            updated_at: new Date().toISOString(),
          });
      }
    };
  }, [user?.id, groupId]);

  return { setTyping, stopTyping };
}

export default useGroupRealtime;
