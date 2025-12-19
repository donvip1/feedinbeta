import { useEffect, useRef, useCallback, useState } from 'react';

type VisibilityCallback = (isVisible: boolean, entry: IntersectionObserverEntry) => void;

// Shared observer instance - ONE observer for all elements
let sharedObserver: IntersectionObserver | null = null;
const callbacks = new Map<Element, VisibilityCallback>();
const visibilityStates = new Map<Element, boolean>();

const getSharedObserver = (threshold: number = 0.5): IntersectionObserver => {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = callbacks.get(entry.target);
          const wasVisible = visibilityStates.get(entry.target) ?? false;
          const isVisible = entry.isIntersecting;

          // Only call callback if visibility changed
          if (wasVisible !== isVisible) {
            visibilityStates.set(entry.target, isVisible);
            callback?.(isVisible, entry);
          }
        });
      },
      {
        threshold,
        rootMargin: '50px 0px', // Pre-load slightly before visible
      }
    );
  }
  return sharedObserver;
};

/**
 * Hook that uses a shared IntersectionObserver for ALL elements
 * Much more efficient than creating one observer per component
 */
export const useSharedVisibilityObserver = (
  callback: VisibilityCallback,
  threshold: number = 0.5
) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  callbackRef.current = callback;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = getSharedObserver(threshold);
    
    // Store callback for this element
    callbacks.set(element, (isVisible, entry) => {
      callbackRef.current(isVisible, entry);
    });

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      callbacks.delete(element);
      visibilityStates.delete(element);
    };
  }, [threshold]);

  return elementRef;
};

/**
 * Simple hook that just returns visibility state
 */
export const useIsVisible = (threshold: number = 0.5) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const elementRef = useSharedVisibilityObserver(
    useCallback((visible: boolean) => {
      setIsVisible(visible);
    }, []),
    threshold
  );

  return { elementRef, isVisible };
};

/**
 * Hook for video autoplay on visibility
 */
export const useVideoVisibility = (threshold: number = 0.6) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const containerRef = useSharedVisibilityObserver(
    useCallback((isVisible: boolean) => {
      const video = videoRef.current;
      if (!video) return;

      if (isVisible) {
        video.play().catch(() => {
          // Autoplay blocked, try muted
          video.muted = true;
          video.play().catch(() => {});
        });
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, []),
    threshold
  );

  return { containerRef, videoRef, isPlaying, setIsPlaying };
};
