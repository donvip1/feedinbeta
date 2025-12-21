/**
 * Unified Real-Time Manager for FeedIn
 * Single source of truth for ALL Supabase real-time subscriptions
 * Prevents channel proliferation and ensures instant message delivery
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type MessagePayload = {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  reply_to_id?: string | null;
  is_read?: boolean;
  deleted_at?: string | null;
};

export type TypingPayload = {
  user_id: string;
  conversation_id: string;
  is_typing: boolean;
  activity_type?: string;
};

export type MessageReactionPayload = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type ReadReceiptPayload = {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
};

type EventCallback<T> = (payload: T) => void;

interface MessageListeners {
  onInsert: Set<EventCallback<MessagePayload>>;
  onUpdate: Set<EventCallback<MessagePayload>>;
  onDelete: Set<EventCallback<{ id: string }>>;
}

interface ConversationListeners {
  messages: MessageListeners;
  typing: Set<EventCallback<TypingPayload>>;
  reactions: Set<EventCallback<MessageReactionPayload>>;
  receipts: Set<EventCallback<ReadReceiptPayload>>;
}

class UnifiedRealtimeManager {
  private static instance: UnifiedRealtimeManager;
  
  // Single channel for all user messages
  private userChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  
  private userId: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  // Listeners per conversation
  private conversationListeners: Map<string, ConversationListeners> = new Map();
  
  // Global listeners (for conversation list)
  private globalMessageListeners: Set<EventCallback<MessagePayload>> = new Set();
  private globalTypingListeners: Set<EventCallback<TypingPayload>> = new Set();
  
  // Presence tracking
  private presenceListeners: Map<string, Set<EventCallback<{ isOnline: boolean }>>> = new Map();
  private onlineUsers: Set<string> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanup());
      
      // Handle visibility change for reconnection
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.userId && !this.isConnected) {
          this.connect();
        }
      });
    }
  }

  static getInstance(): UnifiedRealtimeManager {
    if (!UnifiedRealtimeManager.instance) {
      UnifiedRealtimeManager.instance = new UnifiedRealtimeManager();
    }
    return UnifiedRealtimeManager.instance;
  }

  /**
   * Initialize the manager with user ID and connect
   */
  async initialize(userId: string): Promise<void> {
    if (this.userId === userId && this.isConnected) {
      console.log('[Realtime] Already connected for user:', userId);
      return;
    }
    
    // Cleanup existing connections
    if (this.userId !== userId) {
      this.cleanup();
    }
    
    this.userId = userId;
    await this.connect();
  }

  /**
   * Connect to realtime channels
   */
  private async connect(): Promise<void> {
    if (!this.userId) return;
    
    console.log('[Realtime] Connecting for user:', this.userId);
    
    try {
      // Create single channel for ALL messages related to this user
      this.userChannel = supabase.channel(`user-realtime:${this.userId}`)
        // Listen to ALL message inserts
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload: RealtimePostgresChangesPayload<MessagePayload>) => {
            this.handleMessageInsert(payload.new as MessagePayload);
          }
        )
        // Listen to ALL message updates
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
          },
          (payload: RealtimePostgresChangesPayload<MessagePayload>) => {
            this.handleMessageUpdate(payload.new as MessagePayload);
          }
        )
        // Listen to message deletes
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
          },
          (payload: RealtimePostgresChangesPayload<MessagePayload>) => {
            this.handleMessageDelete(payload.old as { id: string });
          }
        )
        // Listen to ALL typing indicators
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_indicators',
          },
          (payload: RealtimePostgresChangesPayload<TypingPayload>) => {
            this.handleTypingIndicator(payload.new as TypingPayload);
          }
        )
        // Listen to reactions
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload: RealtimePostgresChangesPayload<MessageReactionPayload>) => {
            this.handleReaction(payload.new as MessageReactionPayload);
          }
        )
        // Listen to read receipts
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_read_receipts',
          },
          (payload: RealtimePostgresChangesPayload<ReadReceiptPayload>) => {
            this.handleReadReceipt(payload.new as ReadReceiptPayload);
          }
        );

      // Subscribe with status callback
      this.userChannel.subscribe((status) => {
        console.log('[Realtime] User channel status:', status);
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.reconnectAttempts = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          this.handleReconnect();
        }
      });

      // Create presence channel for tracking online users
      this.presenceChannel = supabase.channel(`online-users:${this.userId}`)
        .on('presence', { event: 'sync' }, () => {
          const state = this.presenceChannel?.presenceState() || {};
          this.onlineUsers.clear();
          
          Object.values(state).forEach((presences: any[]) => {
            presences.forEach((presence: any) => {
              if (presence.user_id) {
                this.onlineUsers.add(presence.user_id);
              }
            });
          });
          
          // Notify all presence listeners
          this.presenceListeners.forEach((listeners, userId) => {
            const isOnline = this.onlineUsers.has(userId);
            listeners.forEach(cb => cb({ isOnline }));
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await this.presenceChannel?.track({
              user_id: this.userId,
              online_at: new Date().toISOString(),
            });
          }
        });

    } catch (error) {
      console.error('[Realtime] Connection error:', error);
      this.handleReconnect();
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Realtime] Max reconnect attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected && this.userId) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Handle incoming message insert
   */
  private handleMessageInsert(message: MessagePayload): void {
    if (!message || message.deleted_at) return;
    
    console.log('[Realtime] Message insert:', message.id, 'conv:', message.conversation_id);
    
    // Notify global listeners (for conversation list)
    this.globalMessageListeners.forEach(cb => cb(message));
    
    // Notify conversation-specific listeners
    const listeners = this.conversationListeners.get(message.conversation_id);
    if (listeners) {
      listeners.messages.onInsert.forEach(cb => cb(message));
    }
  }

  /**
   * Handle message update
   */
  private handleMessageUpdate(message: MessagePayload): void {
    if (!message) return;
    
    console.log('[Realtime] Message update:', message.id);
    
    const listeners = this.conversationListeners.get(message.conversation_id);
    if (listeners) {
      listeners.messages.onUpdate.forEach(cb => cb(message));
    }
  }

  /**
   * Handle message delete
   */
  private handleMessageDelete(payload: { id: string }): void {
    if (!payload?.id) return;
    
    console.log('[Realtime] Message delete:', payload.id);
    
    // Notify all conversation listeners since we don't know which conversation
    this.conversationListeners.forEach(listeners => {
      listeners.messages.onDelete.forEach(cb => cb(payload));
    });
  }

  /**
   * Handle typing indicator
   */
  private handleTypingIndicator(typing: TypingPayload): void {
    if (!typing || typing.user_id === this.userId) return;
    
    console.log('[Realtime] Typing:', typing.user_id, 'in', typing.conversation_id);
    
    // Notify global listeners
    this.globalTypingListeners.forEach(cb => cb(typing));
    
    // Notify conversation-specific listeners
    const listeners = this.conversationListeners.get(typing.conversation_id);
    if (listeners) {
      listeners.typing.forEach(cb => cb(typing));
    }
  }

  /**
   * Handle reaction
   */
  private handleReaction(reaction: MessageReactionPayload): void {
    if (!reaction) return;
    
    // We need to find which conversation this reaction belongs to
    // For now, notify all listeners
    this.conversationListeners.forEach(listeners => {
      listeners.reactions.forEach(cb => cb(reaction));
    });
  }

  /**
   * Handle read receipt
   */
  private handleReadReceipt(receipt: ReadReceiptPayload): void {
    if (!receipt || receipt.user_id === this.userId) return;
    
    this.conversationListeners.forEach(listeners => {
      listeners.receipts.forEach(cb => cb(receipt));
    });
  }

  /**
   * Subscribe to messages for a specific conversation
   */
  subscribeToConversation(
    conversationId: string,
    callbacks: {
      onMessage?: EventCallback<MessagePayload>;
      onMessageUpdate?: EventCallback<MessagePayload>;
      onMessageDelete?: EventCallback<{ id: string }>;
      onTyping?: EventCallback<TypingPayload>;
      onReaction?: EventCallback<MessageReactionPayload>;
      onReadReceipt?: EventCallback<ReadReceiptPayload>;
    }
  ): () => void {
    // Ensure listeners exist for this conversation
    if (!this.conversationListeners.has(conversationId)) {
      this.conversationListeners.set(conversationId, {
        messages: {
          onInsert: new Set(),
          onUpdate: new Set(),
          onDelete: new Set(),
        },
        typing: new Set(),
        reactions: new Set(),
        receipts: new Set(),
      });
    }
    
    const listeners = this.conversationListeners.get(conversationId)!;
    
    // Add callbacks
    if (callbacks.onMessage) listeners.messages.onInsert.add(callbacks.onMessage);
    if (callbacks.onMessageUpdate) listeners.messages.onUpdate.add(callbacks.onMessageUpdate);
    if (callbacks.onMessageDelete) listeners.messages.onDelete.add(callbacks.onMessageDelete);
    if (callbacks.onTyping) listeners.typing.add(callbacks.onTyping);
    if (callbacks.onReaction) listeners.reactions.add(callbacks.onReaction);
    if (callbacks.onReadReceipt) listeners.receipts.add(callbacks.onReadReceipt);
    
    // Return unsubscribe function
    return () => {
      if (callbacks.onMessage) listeners.messages.onInsert.delete(callbacks.onMessage);
      if (callbacks.onMessageUpdate) listeners.messages.onUpdate.delete(callbacks.onMessageUpdate);
      if (callbacks.onMessageDelete) listeners.messages.onDelete.delete(callbacks.onMessageDelete);
      if (callbacks.onTyping) listeners.typing.delete(callbacks.onTyping);
      if (callbacks.onReaction) listeners.reactions.delete(callbacks.onReaction);
      if (callbacks.onReadReceipt) listeners.receipts.delete(callbacks.onReadReceipt);
      
      // Cleanup if no more listeners
      const hasListeners = 
        listeners.messages.onInsert.size > 0 ||
        listeners.messages.onUpdate.size > 0 ||
        listeners.messages.onDelete.size > 0 ||
        listeners.typing.size > 0 ||
        listeners.reactions.size > 0 ||
        listeners.receipts.size > 0;
      
      if (!hasListeners) {
        this.conversationListeners.delete(conversationId);
      }
    };
  }

  /**
   * Subscribe to all messages (for conversation list updates)
   */
  subscribeToAllMessages(
    onMessage: EventCallback<MessagePayload>,
    onTyping?: EventCallback<TypingPayload>
  ): () => void {
    this.globalMessageListeners.add(onMessage);
    if (onTyping) {
      this.globalTypingListeners.add(onTyping);
    }
    
    return () => {
      this.globalMessageListeners.delete(onMessage);
      if (onTyping) {
        this.globalTypingListeners.delete(onTyping);
      }
    };
  }

  /**
   * Subscribe to user presence
   */
  subscribeToPresence(
    userId: string,
    onPresence: EventCallback<{ isOnline: boolean }>
  ): () => void {
    if (!this.presenceListeners.has(userId)) {
      this.presenceListeners.set(userId, new Set());
    }
    
    this.presenceListeners.get(userId)!.add(onPresence);
    
    // Immediately notify with current status
    onPresence({ isOnline: this.onlineUsers.has(userId) });
    
    return () => {
      this.presenceListeners.get(userId)?.delete(onPresence);
      if (this.presenceListeners.get(userId)?.size === 0) {
        this.presenceListeners.delete(userId);
      }
    };
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { isConnected: boolean; channelCount: number } {
    return {
      isConnected: this.isConnected,
      channelCount: (this.userChannel ? 1 : 0) + (this.presenceChannel ? 1 : 0),
    };
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    console.log('[Realtime] Cleaning up...');
    
    if (this.userChannel) {
      supabase.removeChannel(this.userChannel);
      this.userChannel = null;
    }
    
    if (this.presenceChannel) {
      supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    
    this.conversationListeners.clear();
    this.globalMessageListeners.clear();
    this.globalTypingListeners.clear();
    this.presenceListeners.clear();
    this.onlineUsers.clear();
    this.isConnected = false;
    this.userId = null;
  }

  // Legacy support methods
  setUserId(userId: string): void {
    this.initialize(userId);
  }
}

export const realtimeManager = UnifiedRealtimeManager.getInstance();
export default realtimeManager;
