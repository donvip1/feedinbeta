/**
 * Media Preloader - Preloads images and media in idle time for faster rendering
 * Uses requestIdleCallback to avoid blocking the main thread
 */

interface PreloadOptions {
  priority?: 'high' | 'low';
  type?: 'image' | 'video';
}

class MediaPreloader {
  private preloadedUrls = new Set<string>();
  private pendingQueue: Array<{ url: string; options?: PreloadOptions }> = [];
  private isProcessing = false;

  /**
   * Preload a single image URL
   */
  preloadImage(url: string): Promise<void> {
    if (!url || this.preloadedUrls.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.preloadedUrls.add(url);
        resolve();
      };
      img.onerror = () => resolve(); // Don't reject, just continue
      img.src = url;
    });
  }

  /**
   * Preload multiple image URLs
   */
  async preloadImages(urls: string[]): Promise<void> {
    const uniqueUrls = urls.filter(url => url && !this.preloadedUrls.has(url));
    await Promise.all(uniqueUrls.map(url => this.preloadImage(url)));
  }

  /**
   * Queue URLs for idle-time preloading
   */
  queueForPreload(urls: string[], options?: PreloadOptions): void {
    const newUrls = urls.filter(url => url && !this.preloadedUrls.has(url));
    newUrls.forEach(url => this.pendingQueue.push({ url, options }));
    this.processQueue();
  }

  /**
   * Process the queue during idle time
   */
  private processQueue(): void {
    if (this.isProcessing || this.pendingQueue.length === 0) return;

    this.isProcessing = true;

    const processInIdle = () => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(
          (deadline) => {
            while (deadline.timeRemaining() > 0 && this.pendingQueue.length > 0) {
              const item = this.pendingQueue.shift();
              if (item) {
                this.preloadImage(item.url);
              }
            }

            if (this.pendingQueue.length > 0) {
              processInIdle();
            } else {
              this.isProcessing = false;
            }
          },
          { timeout: 2000 }
        );
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          const batch = this.pendingQueue.splice(0, 5);
          batch.forEach(item => this.preloadImage(item.url));

          if (this.pendingQueue.length > 0) {
            processInIdle();
          } else {
            this.isProcessing = false;
          }
        }, 100);
      }
    };

    processInIdle();
  }

  /**
   * Preload avatar images from profiles
   */
  preloadAvatars(profiles: Array<{ avatar_url?: string | null }>): void {
    const urls = profiles
      .map(p => p.avatar_url)
      .filter((url): url is string => !!url);
    this.queueForPreload(urls, { priority: 'high', type: 'image' });
  }

  /**
   * Preload media from posts (thumbnails for videos, full images for photos)
   */
  preloadPostMedia(posts: Array<{ 
    media_url?: string | null;
    media_urls?: string[] | null;
    media_type?: string | null;
  }>): void {
    const urls: string[] = [];

    posts.forEach(post => {
      if (post.media_url) {
        urls.push(post.media_url);
      }
      if (post.media_urls) {
        urls.push(...post.media_urls);
      }
    });

    // Only preload images, not videos
    const imageUrls = urls.filter(url => 
      url.includes('.jpg') || 
      url.includes('.jpeg') || 
      url.includes('.png') || 
      url.includes('.webp') ||
      url.includes('.gif')
    );

    this.queueForPreload(imageUrls.slice(0, 20), { priority: 'low', type: 'image' });
  }

  /**
   * Check if a URL has been preloaded
   */
  isPreloaded(url: string): boolean {
    return this.preloadedUrls.has(url);
  }

  /**
   * Get preload statistics
   */
  getStats(): { preloaded: number; pending: number } {
    return {
      preloaded: this.preloadedUrls.size,
      pending: this.pendingQueue.length,
    };
  }

  /**
   * Clear all preloaded URLs (useful for memory management)
   */
  clear(): void {
    this.preloadedUrls.clear();
    this.pendingQueue = [];
    this.isProcessing = false;
  }
}

export const mediaPreloader = new MediaPreloader();
export default mediaPreloader;
