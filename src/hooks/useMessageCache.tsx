import { useState, useEffect, useCallback } from 'react';

interface CachedMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const CACHE_KEY_PREFIX = 'feedin_messages_cache_';
const CACHE_EXPIRY_PREFIX = 'feedin_messages_expiry_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const useMessageCache = (conversationId: string) => {
  const [cachedMessages, setCachedMessages] = useState<CachedMessage[]>([]);
  const [hasCachedData, setHasCachedData] = useState(false);

  const cacheKey = `${CACHE_KEY_PREFIX}${conversationId}`;
  const expiryKey = `${CACHE_EXPIRY_PREFIX}${conversationId}`;

  // Load from cache on mount
  useEffect(() => {
    if (!conversationId) return;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      const expiry = localStorage.getItem(expiryKey);
      
      if (cached && expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() < expiryTime) {
          const data = JSON.parse(cached);
          if (Array.isArray(data) && data.length > 0) {
            setCachedMessages(data);
            setHasCachedData(true);
          }
        } else {
          // Cache expired, clear it
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(expiryKey);
        }
      }
    } catch (error) {
      console.error('Error loading message cache:', error);
    }
  }, [conversationId, cacheKey, expiryKey]);

  const saveToCache = useCallback((messages: CachedMessage[]) => {
    if (!conversationId) return;
    
    try {
      if (messages.length > 0) {
        // Only cache the last 100 messages to save space
        const messagesToCache = messages.slice(-100);
        localStorage.setItem(cacheKey, JSON.stringify(messagesToCache));
        localStorage.setItem(expiryKey, String(Date.now() + CACHE_DURATION));
        setCachedMessages(messagesToCache);
        setHasCachedData(true);
      }
    } catch (error) {
      console.error('Error saving message cache:', error);
    }
  }, [conversationId, cacheKey, expiryKey]);

  const clearCache = useCallback(() => {
    if (!conversationId) return;
    
    try {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(expiryKey);
      setCachedMessages([]);
      setHasCachedData(false);
    } catch (error) {
      console.error('Error clearing message cache:', error);
    }
  }, [conversationId, cacheKey, expiryKey]);

  const appendMessage = useCallback((message: CachedMessage) => {
    if (!conversationId) return;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      let messages: CachedMessage[] = cached ? JSON.parse(cached) : [];
      
      // Don't add duplicates
      if (!messages.some(m => m.id === message.id)) {
        messages.push(message);
        // Keep only last 100 messages
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }
        localStorage.setItem(cacheKey, JSON.stringify(messages));
        localStorage.setItem(expiryKey, String(Date.now() + CACHE_DURATION));
        setCachedMessages(messages);
      }
    } catch (error) {
      console.error('Error appending to message cache:', error);
    }
  }, [conversationId, cacheKey, expiryKey]);

  return {
    cachedMessages,
    hasCachedData,
    saveToCache,
    clearCache,
    appendMessage,
  };
};
