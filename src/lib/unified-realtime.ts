/**
 * Unified Real-Time Manager for FeedIn
 * Consolidates all Supabase real-time subscriptions into efficient channels
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type MessagePayload = {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  reply_to_id?: string | null;
  is_read?: boolean;
};

type TypingPayload = {
  user_id: string;
  conversation_id: string;
  is_typing: boolean;
  activity_type?: string;
};

type PresencePayload = {
  user_id: string;
  online_at: string;
  conversation_id?: string;
};

type EventCallback<T> = (payload: T) => void;

interface ChannelSubscription {
  channel: RealtimeChannel;
  refCount: number;
}

class UnifiedRealtimeManager {
  private static instance: UnifiedRealtimeManager;
  private channels: Map<string, ChannelSubscription> = new Map();
  private eventListeners: Map<string, Set<EventCallback<any>>> = new Map();
  private userId: string | null = null;

  private constructor() {
    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanup());
    }
  }

  static getInstance(): UnifiedRealtimeManager {
    if (!UnifiedRealtimeManager.instance) {
      UnifiedRealtimeManager.instance = new UnifiedRealtimeManager();
    }
    return UnifiedRealtimeManager.instance;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  // Subscribe to messages for a conversation
  subscribeToMessages(
    conversationId: string,
    onMessage: EventCallback<MessagePayload>
  ): () => void {
    const channelKey = `messages:${conversationId}`;
    
    // Add listener
    if (!this.eventListeners.has(channelKey)) {
      this.eventListeners.set(channelKey, new Set());
    }
    this.eventListeners.get(channelKey)!.add(onMessage);

    // Create channel if not exists
    if (!this.channels.has(channelKey)) {
      const channel = supabase
        .channel(`chat-messages-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const message = payload.new as MessagePayload;
            this.eventListeners.get(channelKey)?.forEach(cb => cb(message));
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
          (payload) => {
            const message = payload.new as MessagePayload;
            this.eventListeners.get(`${channelKey}:update`)?.forEach(cb => cb(message));
          }
        )
        .subscribe();

      this.channels.set(channelKey, { channel, refCount: 1 });
    } else {
      this.channels.get(channelKey)!.refCount++;
    }

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(channelKey)?.delete(onMessage);
      
      const subscription = this.channels.get(channelKey);
      if (subscription) {
        subscription.refCount--;
        if (subscription.refCount <= 0) {
          supabase.removeChannel(subscription.channel);
          this.channels.delete(channelKey);
          this.eventListeners.delete(channelKey);
        }
      }
    };
  }

  // Subscribe to typing indicators for a conversation
  subscribeToTyping(
    conversationId: string,
    onTyping: EventCallback<TypingPayload>
  ): () => void {
    const channelKey = `typing:${conversationId}`;
    
    if (!this.eventListeners.has(channelKey)) {
      this.eventListeners.set(channelKey, new Set());
    }
    this.eventListeners.get(channelKey)!.add(onTyping);

    if (!this.channels.has(channelKey)) {
      const channel = supabase
        .channel(`typing-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_indicators',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const typing = payload.new as TypingPayload;
            // Don't notify about own typing
            if (typing.user_id !== this.userId) {
              this.eventListeners.get(channelKey)?.forEach(cb => cb(typing));
            }
          }
        )
        .subscribe();

      this.channels.set(channelKey, { channel, refCount: 1 });
    } else {
      this.channels.get(channelKey)!.refCount++;
    }

    return () => {
      this.eventListeners.get(channelKey)?.delete(onTyping);
      
      const subscription = this.channels.get(channelKey);
      if (subscription) {
        subscription.refCount--;
        if (subscription.refCount <= 0) {
          supabase.removeChannel(subscription.channel);
          this.channels.delete(channelKey);
          this.eventListeners.delete(channelKey);
        }
      }
    };
  }

  // Subscribe to user presence
  subscribeToPresence(
    userId: string,
    onPresence: EventCallback<{ isOnline: boolean }>
  ): () => void {
    const channelKey = `presence:${userId}`;
    
    if (!this.eventListeners.has(channelKey)) {
      this.eventListeners.set(channelKey, new Set());
    }
    this.eventListeners.get(channelKey)!.add(onPresence);

    if (!this.channels.has(channelKey)) {
      const channel = supabase
        .channel(`user-presence:${userId}`)
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const isOnline = Object.keys(state).length > 0;
          this.eventListeners.get(channelKey)?.forEach(cb => cb({ isOnline }));
        })
        .subscribe();

      this.channels.set(channelKey, { channel, refCount: 1 });
    } else {
      this.channels.get(channelKey)!.refCount++;
    }

    return () => {
      this.eventListeners.get(channelKey)?.delete(onPresence);
      
      const subscription = this.channels.get(channelKey);
      if (subscription) {
        subscription.refCount--;
        if (subscription.refCount <= 0) {
          supabase.removeChannel(subscription.channel);
          this.channels.delete(channelKey);
          this.eventListeners.delete(channelKey);
        }
      }
    };
  }

  // Track own presence
  async trackPresence(conversationId?: string): Promise<() => void> {
    if (!this.userId) return () => {};

    const channelKey = `my-presence:${this.userId}`;
    
    const channel = supabase.channel(channelKey);
    
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          online_at: new Date().toISOString(),
          conversation_id: conversationId,
        });
      }
    });

    this.channels.set(channelKey, { channel, refCount: 1 });

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelKey);
    };
  }

  // Subscribe to all messages for the user (for conversation list)
  subscribeToAllMessages(
    onNewMessage: EventCallback<MessagePayload>,
    onMessageUpdate?: EventCallback<MessagePayload>
  ): () => void {
    if (!this.userId) return () => {};

    const channelKey = `all-messages:${this.userId}`;
    
    if (!this.eventListeners.has(channelKey)) {
      this.eventListeners.set(channelKey, new Set());
    }
    this.eventListeners.get(channelKey)!.add(onNewMessage);

    if (onMessageUpdate) {
      const updateKey = `${channelKey}:update`;
      if (!this.eventListeners.has(updateKey)) {
        this.eventListeners.set(updateKey, new Set());
      }
      this.eventListeners.get(updateKey)!.add(onMessageUpdate);
    }

    if (!this.channels.has(channelKey)) {
      const channel = supabase
        .channel(`user-messages-${this.userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const message = payload.new as MessagePayload;
            this.eventListeners.get(channelKey)?.forEach(cb => cb(message));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const message = payload.new as MessagePayload;
            this.eventListeners.get(`${channelKey}:update`)?.forEach(cb => cb(message));
          }
        )
        .subscribe();

      this.channels.set(channelKey, { channel, refCount: 1 });
    } else {
      this.channels.get(channelKey)!.refCount++;
    }

    return () => {
      this.eventListeners.get(channelKey)?.delete(onNewMessage);
      if (onMessageUpdate) {
        this.eventListeners.get(`${channelKey}:update`)?.delete(onMessageUpdate);
      }
      
      const subscription = this.channels.get(channelKey);
      if (subscription) {
        subscription.refCount--;
        if (subscription.refCount <= 0) {
          supabase.removeChannel(subscription.channel);
          this.channels.delete(channelKey);
          this.eventListeners.delete(channelKey);
        }
      }
    };
  }

  // Cleanup all channels
  cleanup(): void {
    this.channels.forEach(({ channel }) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.eventListeners.clear();
  }

  // Get active channel count (for debugging)
  getActiveChannelCount(): number {
    return this.channels.size;
  }
}

export const realtimeManager = UnifiedRealtimeManager.getInstance();
export default realtimeManager;
