import { useEffect, useCallback, useRef } from 'react';

interface Post {
  id: string;
  media_url?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  media_types?: string[] | null;
  profiles?: {
    avatar_url?: string | null;
  };
  original_post?: {
    media_url?: string | null;
    media_urls?: string[] | null;
    profiles?: {
      avatar_url?: string | null;
    };
  } | null;
}

/**
 * Hook for aggressive feed media preloading
 * Preloads images instantly for app-like speed
 */
export function useFeedPreloader(posts: Post[], enabled: boolean = true) {
  const preloadedUrls = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Extract all image URLs from a post
  const getPostImageUrls = useCallback((post: Post): string[] => {
    const urls: string[] = [];

    // Avatar
    if (post.profiles?.avatar_url) {
      urls.push(post.profiles.avatar_url);
    }

    // Main media (only images)
    if (post.media_type === 'image' && post.media_url) {
      urls.push(post.media_url);
    }

    // Multiple media (only images)
    if (post.media_urls && post.media_types) {
      post.media_urls.forEach((url, i) => {
        if (post.media_types?.[i] === 'image') {
          urls.push(url);
        }
      });
    }

    // Original post media
    if (post.original_post) {
      if (post.original_post.profiles?.avatar_url) {
        urls.push(post.original_post.profiles.avatar_url);
      }
      if (post.original_post.media_url) {
        urls.push(post.original_post.media_url);
      }
      if (post.original_post.media_urls) {
        urls.push(...post.original_post.media_urls);
      }
    }

    return urls.filter(Boolean);
  }, []);

  // Preload a single image with high priority
  const preloadImage = useCallback((url: string): Promise<void> => {
    if (preloadedUrls.current.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.onload = () => {
        preloadedUrls.current.add(url);
        resolve();
      };
      link.onerror = () => resolve();
      document.head.appendChild(link);

      // Cleanup after 30 seconds
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }, 30000);
    });
  }, []);

  // Preload first N posts immediately on mount
  useEffect(() => {
    if (!enabled || !posts.length) return;

    // Preload first 5 posts immediately for instant display
    const priorityPosts = posts.slice(0, 5);
    const priorityUrls = priorityPosts.flatMap(getPostImageUrls);

    // Use high priority fetch for first 5 images
    priorityUrls.slice(0, 10).forEach(url => {
      if (!preloadedUrls.current.has(url)) {
        const img = new Image();
        img.fetchPriority = 'high';
        img.loading = 'eager';
        img.src = url;
        img.onload = () => preloadedUrls.current.add(url);
      }
    });

    // Preload next batch in idle time
    const nextUrls = posts.slice(5, 15).flatMap(getPostImageUrls);
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        nextUrls.forEach(url => preloadImage(url));
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        nextUrls.forEach(url => preloadImage(url));
      }, 100);
    }
  }, [posts, enabled, getPostImageUrls, preloadImage]);

  // Setup intersection observer for lazy preloading as user scrolls
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-post-id');
            const post = posts.find(p => p.id === postId);
            
            if (post) {
              const urls = getPostImageUrls(post);
              urls.forEach(url => preloadImage(url));
            }
            
            // Unobserve after preloading
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px 0px', // Start preloading 200px before visible
        threshold: 0,
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, posts, getPostImageUrls, preloadImage]);

  // Function to observe a post element
  const observePost = useCallback((element: HTMLElement | null, postId: string) => {
    if (!element || !observerRef.current) return;
    
    element.setAttribute('data-post-id', postId);
    observerRef.current.observe(element);
  }, []);

  return {
    observePost,
    isPreloaded: (url: string) => preloadedUrls.current.has(url),
    preloadedCount: preloadedUrls.current.size,
  };
}

export default useFeedPreloader;
