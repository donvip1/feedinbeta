/**
 * Unified Message Realtime Hook
 * Single hook for all chat realtime subscriptions
 * Uses the UnifiedRealtimeManager for efficient channel management
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { realtimeManager, MessagePayload, TypingPayload } from '@/lib/unified-realtime';

interface UseMessageRealtimeOptions {
  conversationId: string;
  otherUserId?: string;
  onNewMessage?: (message: MessagePayload) => void;
  onMessageUpdate?: (message: MessagePayload) => void;
  onMessageDelete?: (payload: { id: string }) => void;
  onTyping?: (payload: TypingPayload) => void;
  onReadReceipt?: (payload: { message_id: string; user_id: string; read_at: string }) => void;
  onPresenceChange?: (isOnline: boolean) => void;
}

export function useMessageRealtime({
  conversationId,
  otherUserId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
  onTyping,
  onReadReceipt,
  onPresenceChange,
}: UseMessageRealtimeOptions) {
  const { user } = useAuth();
  const isInitializedRef = useRef(false);

  // Stable callback refs to prevent re-subscriptions
  const callbacksRef = useRef({
    onNewMessage,
    onMessageUpdate,
    onMessageDelete,
    onTyping,
    onReadReceipt,
    onPresenceChange,
  });

  // Update callback refs
  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onMessageUpdate,
      onMessageDelete,
      onTyping,
      onReadReceipt,
      onPresenceChange,
    };
  });

  // Initialize realtime manager and subscribe
  useEffect(() => {
    if (!user?.id || !conversationId) return;

    // Initialize the manager (idempotent)
    realtimeManager.initialize(user.id);
    isInitializedRef.current = true;

    // Subscribe to conversation-specific events
    const unsubscribeConversation = realtimeManager.subscribeToConversation(
      conversationId,
      {
        onMessage: (message) => {
          // Filter out own messages - handled via optimistic updates
          if (message.sender_id !== user.id) {
            callbacksRef.current.onNewMessage?.(message);
          }
        },
        onMessageUpdate: (message) => {
          callbacksRef.current.onMessageUpdate?.(message);
        },
        onMessageDelete: (payload) => {
          callbacksRef.current.onMessageDelete?.(payload);
        },
        onTyping: (typing) => {
          if (typing.user_id !== user.id) {
            callbacksRef.current.onTyping?.(typing);
          }
        },
        onReadReceipt: (receipt) => {
          if (receipt.user_id !== user.id) {
            callbacksRef.current.onReadReceipt?.(receipt);
          }
        },
      }
    );

    // Subscribe to other user's presence
    let unsubscribePresence: (() => void) | undefined;
    if (otherUserId) {
      unsubscribePresence = realtimeManager.subscribeToPresence(
        otherUserId,
        ({ isOnline }) => {
          callbacksRef.current.onPresenceChange?.(isOnline);
        }
      );
    }

    return () => {
      unsubscribeConversation();
      unsubscribePresence?.();
    };
  }, [user?.id, conversationId, otherUserId]);

  // Get connection status
  const getStatus = useCallback(() => {
    return realtimeManager.getConnectionStatus();
  }, []);

  // Check if other user is online
  const isOtherUserOnline = useCallback(() => {
    if (!otherUserId) return false;
    return realtimeManager.isUserOnline(otherUserId);
  }, [otherUserId]);

  return {
    getStatus,
    isOtherUserOnline,
    isInitialized: isInitializedRef.current,
  };
}

/**
 * Hook for conversation list page
 * Subscribes to all messages for updating the list
 */
interface UseConversationListRealtimeOptions {
  onNewMessage?: (message: MessagePayload) => void;
  onTyping?: (payload: TypingPayload) => void;
}

export function useConversationListRealtime({
  onNewMessage,
  onTyping,
}: UseConversationListRealtimeOptions) {
  const { user } = useAuth();

  const callbacksRef = useRef({ onNewMessage, onTyping });
  
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onTyping };
  });

  useEffect(() => {
    if (!user?.id) return;

    // Initialize the manager
    realtimeManager.initialize(user.id);

    // Subscribe to all messages
    const unsubscribe = realtimeManager.subscribeToAllMessages(
      (message) => {
        callbacksRef.current.onNewMessage?.(message);
      },
      (typing) => {
        if (typing.user_id !== user.id) {
          callbacksRef.current.onTyping?.(typing);
        }
      }
    );

    return unsubscribe;
  }, [user?.id]);
}

export default useMessageRealtime;
