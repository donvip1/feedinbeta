import { useState, useRef, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface OptimizedImageProps {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * Optimized Image component with:
 * - Instant loading for cached images
 * - Smooth fade-in animation
 * - Native lazy loading
 * - Eager loading for priority images
 */
export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt = '',
  className,
  priority = false,
  onClick,
  onContextMenu,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if image is already cached (instant load)
  useEffect(() => {
    if (!src) return;
    
    const img = new Image();
    img.src = src;
    
    // If complete is already true, image was cached
    if (img.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={cn('bg-muted flex items-center justify-center', className)}>
        <span className="text-muted-foreground text-sm">Failed to load</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Skeleton placeholder - only show if not loaded */}
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      
      {/* Actual image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        className={cn(
          'w-full h-full object-cover no-download-media transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        onClick={onClick}
        onContextMenu={onContextMenu}
        draggable={false}
      />
    </div>
  );
});

interface OptimizedVideoProps {
  src: string;
  className?: string;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  autoPlay?: boolean;
  priority?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

/**
 * Optimized Video component with:
 * - Aggressive preloading
 * - Instant playback when ready
 * - Smooth loading state
 */
export const OptimizedVideo = memo(function OptimizedVideo({
  src,
  className,
  muted = true,
  loop = true,
  playsInline = true,
  autoPlay = false,
  priority = false,
  onPlay,
  onPause,
  onClick,
  onContextMenu,
  videoRef: externalRef,
}: OptimizedVideoProps) {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalRef || internalRef;

  // Preload video data aggressively
  useEffect(() => {
    if (!src || !priority) return;

    // Use fetch to preload video data into browser cache
    const controller = new AbortController();
    
    fetch(src, { 
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    })
      .then(response => {
        if (response.ok) {
          // Just initiating the request caches the video
          return response.blob();
        }
      })
      .catch(() => {
        // Ignore abort errors
      });

    return () => controller.abort();
  }, [src, priority]);

  if (!src || hasError) {
    return (
      <div className={cn('bg-muted flex items-center justify-center', className)}>
        <span className="text-muted-foreground text-sm">Video unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Loading skeleton */}
      {!isReady && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        loop={loop}
        playsInline={playsInline}
        autoPlay={autoPlay}
        preload={priority ? 'auto' : 'metadata'}
        className={cn(
          'w-full h-full object-cover no-download-media transition-opacity duration-200',
          isReady ? 'opacity-100' : 'opacity-0'
        )}
        onCanPlay={() => setIsReady(true)}
        onPlay={onPlay}
        onPause={onPause}
        onClick={onClick}
        onError={() => setHasError(true)}
        onContextMenu={onContextMenu}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
      />
    </div>
  );
});

export default { OptimizedImage, OptimizedVideo };
