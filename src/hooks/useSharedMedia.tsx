import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MediaItem {
  id: string;
  url: string;
  type: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  fileName?: string;
  fileSize?: number;
}

export interface LinkItem {
  id: string;
  url: string;
  title?: string;
  description?: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

interface SharedMediaResult {
  photos: MediaItem[];
  videos: MediaItem[];
  files: MediaItem[];
  links: LinkItem[];
  loading: boolean;
  loadMore: (type: 'photos' | 'videos' | 'files' | 'links') => Promise<void>;
  hasMore: Record<string, boolean>;
}

const ITEMS_PER_PAGE = 30;

// URL regex to extract links from message content
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

export function useSharedMedia(
  conversationId?: string,
  groupId?: string
): SharedMediaResult {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offsets, setOffsets] = useState({ photos: 0, videos: 0, files: 0, links: 0 });
  const [hasMore, setHasMore] = useState({ photos: true, videos: true, files: true, links: true });

  const fetchMedia = useCallback(async (
    type: 'photos' | 'videos' | 'files' | 'links',
    offset: number = 0
  ) => {
    if (!user) return [];

    const mediaTypes: Record<string, string[]> = {
      photos: ['image'],
      videos: ['video'],
      files: ['file', 'document', 'audio'],
    };

    if (conversationId) {
      // Fetch DM media
      if (type === 'links') {
        const { data } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            sender_id,
            created_at,
            profiles:sender_id(display_name, avatar_url)
          `)
          .eq('conversation_id', conversationId)
          .is('deleted_at', null)
          .not('content', 'is', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (data) {
          const linksFound: LinkItem[] = [];
          data.forEach((msg: any) => {
            const matches = msg.content?.match(URL_REGEX) || [];
            matches.forEach((url: string) => {
              linksFound.push({
                id: `${msg.id}-${url}`,
                url,
                senderId: msg.sender_id,
                senderName: msg.profiles?.display_name || 'Unknown',
                createdAt: msg.created_at,
              });
            });
          });
          return linksFound;
        }
      } else {
        const { data } = await supabase
          .from('messages')
          .select(`
            id,
            media_url,
            media_type,
            sender_id,
            created_at,
            profiles:sender_id(display_name, avatar_url)
          `)
          .eq('conversation_id', conversationId)
          .is('deleted_at', null)
          .not('media_url', 'is', null)
          .in('media_type', mediaTypes[type])
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (data) {
          return data.map((msg: any) => ({
            id: msg.id,
            url: msg.media_url,
            type: msg.media_type,
            senderId: msg.sender_id,
            senderName: msg.profiles?.display_name || 'Unknown',
            senderAvatar: msg.profiles?.avatar_url,
            createdAt: msg.created_at,
          }));
        }
      }
    } else if (groupId) {
      // Fetch group media
      if (type === 'links') {
        const { data } = await supabase
          .from('group_messages')
          .select(`
            id,
            content,
            sender_id,
            created_at,
            profiles:sender_id(display_name, avatar_url)
          `)
          .eq('group_id', groupId)
          .is('deleted_at', null)
          .not('content', 'is', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (data) {
          const linksFound: LinkItem[] = [];
          data.forEach((msg: any) => {
            const matches = msg.content?.match(URL_REGEX) || [];
            matches.forEach((url: string) => {
              linksFound.push({
                id: `${msg.id}-${url}`,
                url,
                senderId: msg.sender_id,
                senderName: msg.profiles?.display_name || 'Unknown',
                createdAt: msg.created_at,
              });
            });
          });
          return linksFound;
        }
      } else {
        const { data } = await supabase
          .from('group_messages')
          .select(`
            id,
            media_url,
            media_type,
            sender_id,
            created_at,
            profiles:sender_id(display_name, avatar_url)
          `)
          .eq('group_id', groupId)
          .is('deleted_at', null)
          .not('media_url', 'is', null)
          .in('media_type', mediaTypes[type])
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (data) {
          return data.map((msg: any) => ({
            id: msg.id,
            url: msg.media_url,
            type: msg.media_type,
            senderId: msg.sender_id,
            senderName: msg.profiles?.display_name || 'Unknown',
            senderAvatar: msg.profiles?.avatar_url,
            createdAt: msg.created_at,
          }));
        }
      }
    }

    return [];
  }, [user, conversationId, groupId]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [photosData, videosData, filesData, linksData] = await Promise.all([
        fetchMedia('photos', 0),
        fetchMedia('videos', 0),
        fetchMedia('files', 0),
        fetchMedia('links', 0),
      ]);

      setPhotos(photosData as MediaItem[]);
      setVideos(videosData as MediaItem[]);
      setFiles(filesData as MediaItem[]);
      setLinks(linksData as LinkItem[]);

      setHasMore({
        photos: photosData.length === ITEMS_PER_PAGE,
        videos: videosData.length === ITEMS_PER_PAGE,
        files: filesData.length === ITEMS_PER_PAGE,
        links: linksData.length === ITEMS_PER_PAGE,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchMedia]);

  useEffect(() => {
    if (conversationId || groupId) {
      loadInitialData();
    }
  }, [conversationId, groupId, loadInitialData]);

  const loadMore = useCallback(async (type: 'photos' | 'videos' | 'files' | 'links') => {
    const currentOffset = offsets[type] + ITEMS_PER_PAGE;
    const newData = await fetchMedia(type, currentOffset);

    if (type === 'links') {
      setLinks(prev => [...prev, ...(newData as LinkItem[])]);
    } else if (type === 'photos') {
      setPhotos(prev => [...prev, ...(newData as MediaItem[])]);
    } else if (type === 'videos') {
      setVideos(prev => [...prev, ...(newData as MediaItem[])]);
    } else {
      setFiles(prev => [...prev, ...(newData as MediaItem[])]);
    }

    setOffsets(prev => ({ ...prev, [type]: currentOffset }));
    setHasMore(prev => ({ ...prev, [type]: newData.length === ITEMS_PER_PAGE }));
  }, [offsets, fetchMedia]);

  return {
    photos,
    videos,
    files,
    links,
    loading,
    loadMore,
    hasMore,
  };
}
