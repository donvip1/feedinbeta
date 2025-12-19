import { useState, useEffect, useCallback } from 'react';

interface CachedConversation {
  id: string;
  updated_at: string;
  other_participant: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
  isOnline?: boolean;
  isTyping?: boolean;
}

const CACHE_KEY = 'feedin_conversations_cache';
const CACHE_EXPIRY_KEY = 'feedin_conversations_cache_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const useConversationCache = () => {
  const [cachedConversations, setCachedConversations] = useState<CachedConversation[]>([]);
  const [hasCachedData, setHasCachedData] = useState(false);

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
      
      if (cached && expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() < expiryTime) {
          const data = JSON.parse(cached);
          if (Array.isArray(data) && data.length > 0) {
            setCachedConversations(data);
            setHasCachedData(true);
          }
        } else {
          // Cache expired, clear it
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_EXPIRY_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading conversation cache:', error);
    }
  }, []);

  const saveToCache = useCallback((conversations: CachedConversation[]) => {
    try {
      if (conversations.length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(conversations));
        localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION));
        setCachedConversations(conversations);
        setHasCachedData(true);
      }
    } catch (error) {
      console.error('Error saving conversation cache:', error);
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      setCachedConversations([]);
      setHasCachedData(false);
    } catch (error) {
      console.error('Error clearing conversation cache:', error);
    }
  }, []);

  return {
    cachedConversations,
    hasCachedData,
    saveToCache,
    clearCache,
  };
};

// Group cache
const GROUP_CACHE_KEY = 'feedin_groups_cache';
const MY_GROUPS_CACHE_KEY = 'feedin_my_groups_cache';

export const useGroupCache = () => {
  const [cachedGroups, setCachedGroups] = useState<any[]>([]);
  const [cachedMyGroups, setCachedMyGroups] = useState<any[]>([]);
  const [hasGroupCache, setHasGroupCache] = useState(false);

  useEffect(() => {
    try {
      const groups = localStorage.getItem(GROUP_CACHE_KEY);
      const myGroups = localStorage.getItem(MY_GROUPS_CACHE_KEY);
      
      if (groups) {
        setCachedGroups(JSON.parse(groups));
      }
      if (myGroups) {
        setCachedMyGroups(JSON.parse(myGroups));
      }
      if (groups || myGroups) {
        setHasGroupCache(true);
      }
    } catch (error) {
      console.error('Error loading group cache:', error);
    }
  }, []);

  const saveGroupsToCache = useCallback((groups: any[], myGroups: any[]) => {
    try {
      localStorage.setItem(GROUP_CACHE_KEY, JSON.stringify(groups));
      localStorage.setItem(MY_GROUPS_CACHE_KEY, JSON.stringify(myGroups));
      setCachedGroups(groups);
      setCachedMyGroups(myGroups);
      setHasGroupCache(true);
    } catch (error) {
      console.error('Error saving group cache:', error);
    }
  }, []);

  return {
    cachedGroups,
    cachedMyGroups,
    hasGroupCache,
    saveGroupsToCache,
  };
};
