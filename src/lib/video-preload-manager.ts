/**
 * Video Preload Manager - Aggressive preloading for 10x faster video transitions
 * Preloads 3 videos ahead and 1 behind for instant playback
 */

type PreloadStatus = 'pending' | 'loading' | 'ready' | 'error';

interface PreloadedVideo {
  url: string;
  status: PreloadStatus;
  element: HTMLVideoElement | null;
  readyState: number;
  buffered: number; // Percentage buffered
}

class VideoPreloadManager {
  private preloadCache: Map<string, PreloadedVideo> = new Map();
  private preloadQueue: string[] = [];
  private maxCacheSize = 12; // Increased: Keep max 12 videos in cache
  private preloadAhead = 5; // Increased: Preload 5 videos ahead
  private preloadBehind = 2; // Increased: Preload 2 videos behind

  /**
   * Update preload queue based on current video index
   */
  updateQueue(videos: string[], currentIndex: number): void {
    const newQueue: string[] = [];

    // Add current video first (highest priority)
    if (videos[currentIndex]) {
      newQueue.push(videos[currentIndex]);
    }

    // Add next videos (high priority)
    for (let i = 1; i <= this.preloadAhead; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < videos.length && videos[nextIndex]) {
        newQueue.push(videos[nextIndex]);
      }
    }

    // Add previous video (lower priority)
    for (let i = 1; i <= this.preloadBehind; i++) {
      const prevIndex = currentIndex - i;
      if (prevIndex >= 0 && videos[prevIndex]) {
        newQueue.push(videos[prevIndex]);
      }
    }

    this.preloadQueue = newQueue;

    // Clean up old cache entries
    this.cleanupCache(newQueue);

    // Start preloading
    this.processQueue();
  }

  /**
   * Process the preload queue
   */
  private processQueue(): void {
    for (const url of this.preloadQueue) {
      if (!this.preloadCache.has(url)) {
        this.preloadVideo(url);
      }
    }
  }

  /**
   * Preload a single video
   */
  private preloadVideo(url: string): void {
    if (this.preloadCache.has(url)) return;

    // Create hidden video element for preloading
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Set buffer target for faster loading
    if ('mozHasAudio' in video) {
      // Firefox specific
    }
    
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    const preloadEntry: PreloadedVideo = {
      url,
      status: 'loading',
      element: video,
      readyState: 0,
      buffered: 0,
    };

    this.preloadCache.set(url, preloadEntry);

    // Track loading progress
    video.onloadedmetadata = () => {
      preloadEntry.readyState = video.readyState;
    };

    video.oncanplay = () => {
      preloadEntry.readyState = video.readyState;
      preloadEntry.buffered = this.calculateBufferedPercent(video);
    };

    video.oncanplaythrough = () => {
      preloadEntry.status = 'ready';
      preloadEntry.readyState = video.readyState;
      preloadEntry.buffered = 100;
    };

    video.onprogress = () => {
      preloadEntry.buffered = this.calculateBufferedPercent(video);
    };

    video.onerror = () => {
      preloadEntry.status = 'error';
    };

    // Start loading
    video.src = url;
    video.load();
  }

  /**
   * Get buffered percentage from video element
   */
  private calculateBufferedPercent(video: HTMLVideoElement): number {
    if (!video.duration || video.buffered.length === 0) return 0;
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    return (bufferedEnd / video.duration) * 100;
  }

  /**
   * Check if a video is ready for instant playback
   */
  isReady(url: string): boolean {
    const entry = this.preloadCache.get(url);
    return entry?.status === 'ready' || (entry?.readyState ?? 0) >= 3;
  }

  /**
   * Get preload status for a video
   */
  getStatus(url: string): PreloadStatus {
    return this.preloadCache.get(url)?.status || 'pending';
  }

  /**
   * Get buffered percentage for a video URL
   */
  getBufferedPercent(url: string): number {
    return this.preloadCache.get(url)?.buffered || 0;
  }

  /**
   * Get preloaded video element (for transferring to visible player)
   */
  getPreloadedElement(url: string): HTMLVideoElement | null {
    return this.preloadCache.get(url)?.element || null;
  }

  /**
   * Clean up cache to stay within size limits
   */
  private cleanupCache(keepUrls: string[]): void {
    const keepSet = new Set(keepUrls);
    const toRemove: string[] = [];

    for (const [url] of this.preloadCache.entries()) {
      if (!keepSet.has(url)) {
        toRemove.push(url);
      }
    }
    // Remove old entries, keeping cache under max size
    for (const url of toRemove) {
      if (this.preloadCache.size > this.maxCacheSize - this.preloadQueue.length) {
        const entry = this.preloadCache.get(url);
        if (entry?.element) {
          entry.element.src = '';
          entry.element.load();
          entry.element = null;
        }
        this.preloadCache.delete(url);
      }
    }
  }

  /**
   * Clear all cached videos
   */
  clear(): void {
    for (const [, entry] of this.preloadCache.entries()) {
      if (entry.element) {
        entry.element.src = '';
        entry.element.load();
        entry.element = null;
      }
    }
    this.preloadCache.clear();
    this.preloadQueue = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): { cached: number; ready: number; loading: number } {
    let ready = 0;
    let loading = 0;

    for (const [, entry] of this.preloadCache.entries()) {
      if (entry.status === 'ready') ready++;
      else if (entry.status === 'loading') loading++;
    }

    return {
      cached: this.preloadCache.size,
      ready,
      loading,
    };
  }
}

// Singleton instance
export const videoPreloadManager = new VideoPreloadManager();
export default videoPreloadManager;
