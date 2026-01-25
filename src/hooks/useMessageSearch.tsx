import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SearchFilters {
  query: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file' | 'all_media' | null;
  senderId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface SearchResult {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  context_type: 'dm' | 'group';
}

interface UseMessageSearchOptions {
  conversationId?: string;
  groupId?: string;
  limit?: number;
}

export const useMessageSearch = (options: UseMessageSearchOptions) => {
  const { conversationId, groupId, limit = 50 } = options;
  const { user } = useAuth();
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const search = useCallback(async (filters: SearchFilters) => {
    if (!user?.id) return;
    if (!conversationId && !groupId) return;
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setOffset(0);
    
    try {
      const { data, error: searchError } = await supabase.rpc('search_messages', {
        p_user_id: user.id,
        p_conversation_id: conversationId || null,
        p_group_id: groupId || null,
        p_query: filters.query || null,
        p_sender_id: filters.senderId || null,
        p_media_type: filters.mediaType || null,
        p_start_date: filters.startDate?.toISOString() || null,
        p_end_date: filters.endDate?.toISOString() || null,
        p_limit: limit,
        p_offset: 0,
      });
      
      if (searchError) throw searchError;
      
      setResults((data || []) as SearchResult[]);
      setHasMore((data?.length || 0) >= limit);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, conversationId, groupId, limit]);

  const loadMore = useCallback(async (filters: SearchFilters) => {
    if (!user?.id || !hasMore || isLoading) return;
    
    const newOffset = offset + limit;
    setIsLoading(true);
    
    try {
      const { data, error: searchError } = await supabase.rpc('search_messages', {
        p_user_id: user.id,
        p_conversation_id: conversationId || null,
        p_group_id: groupId || null,
        p_query: filters.query || null,
        p_sender_id: filters.senderId || null,
        p_media_type: filters.mediaType || null,
        p_start_date: filters.startDate?.toISOString() || null,
        p_end_date: filters.endDate?.toISOString() || null,
        p_limit: limit,
        p_offset: newOffset,
      });
      
      if (searchError) throw searchError;
      
      setResults(prev => [...prev, ...(data || []) as SearchResult[]]);
      setOffset(newOffset);
      setHasMore((data?.length || 0) >= limit);
    } catch (err: any) {
      console.error('Load more error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, conversationId, groupId, limit, offset, hasMore, isLoading]);

  const reset = useCallback(() => {
    setResults([]);
    setHasSearched(false);
    setError(null);
    setOffset(0);
    setHasMore(true);
  }, []);

  return {
    results,
    isLoading,
    error,
    hasSearched,
    hasMore,
    search,
    loadMore,
    reset,
  };
};

// Helper to highlight search terms in content
export const highlightSearchTerm = (content: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm.trim()) return content;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = content.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) 
      ? <mark key={index} className="bg-primary/30 text-primary-foreground rounded px-0.5">{part}</mark>
      : part
  );
};

// Get media type filter label
export const getMediaTypeLabel = (type: string | null): string => {
  switch (type) {
    case 'image': return 'Images';
    case 'video': return 'Videos';
    case 'audio': return 'Audio';
    case 'file': return 'Files';
    case 'all_media': return 'All Media';
    default: return 'All';
  }
};
