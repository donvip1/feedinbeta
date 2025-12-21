import { useEffect, useCallback, useRef } from 'react';
import { videoPreloadManager } from '@/lib/video-preload-manager';

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
  original_post?: {
    media_url: string | null;
    media_type: string | null;
  } | null;
}

/**
 * Hook for managing video preloading
 * Provides instant video transitions by preloading adjacent videos
 */
export function useVideoPreloader(
  posts: Post[],
  currentIndex: number,
  enabled: boolean = true
) {
  const previousIndex = useRef(currentIndex);

  // Extract video URLs from posts
  const getVideoUrl = useCallback((post: Post): string | null => {
    if (post.media_type === 'video' && post.media_url) {
      return post.media_url;
    }
    if (post.original_post?.media_type === 'video' && post.original_post?.media_url) {
      return post.original_post.media_url;
    }
    return null;
  }, []);

  // Get all video URLs
  const videoUrls = useCallback(() => {
    return posts
      .map(post => getVideoUrl(post))
      .filter((url): url is string => url !== null);
  }, [posts, getVideoUrl]);

  // Update preload queue when index changes
  useEffect(() => {
    if (!enabled || posts.length === 0) return;

    const urls = videoUrls();
    if (urls.length === 0) return;

    // Map current post index to video URL index
    let videoIndex = 0;
    for (let i = 0; i <= currentIndex && i < posts.length; i++) {
      const url = getVideoUrl(posts[i]);
      if (url && i < currentIndex) {
        videoIndex++;
      }
    }

    // Update preload queue
    videoPreloadManager.updateQueue(urls, Math.min(videoIndex, urls.length - 1));
    previousIndex.current = currentIndex;
  }, [currentIndex, posts, enabled, videoUrls, getVideoUrl]);

  // Check if current video is ready
  const isCurrentReady = useCallback((url: string): boolean => {
    return videoPreloadManager.isReady(url);
  }, []);

  // Get preload status
  const getStatus = useCallback((url: string) => {
    return videoPreloadManager.getStatus(url);
  }, []);

  // Get buffered percentage
  const getBuffered = useCallback((url: string) => {
    return videoPreloadManager.getBufferedPercent(url);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!enabled) return;
      // Don't clear on unmount to keep cache for re-entry
    };
  }, [enabled]);

  return {
    isReady: isCurrentReady,
    getStatus,
    getBuffered,
    preloadManager: videoPreloadManager,
  };
}

export default useVideoPreloader;
