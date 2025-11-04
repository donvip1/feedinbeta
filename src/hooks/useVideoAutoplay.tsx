import { useEffect, useRef } from 'react';

export const useVideoAutoplay = (videoRef: React.RefObject<HTMLVideoElement>, shouldPlay: boolean = true) => {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlay) return;

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
          // Play when 75% visible
          video.muted = true;
          video.play().catch(console.error);
        } else if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
          // Pause when less than 50% visible
          video.pause();
        }
      });
    };

    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: [0, 0.5, 0.75, 1.0],
    });

    observerRef.current.observe(video);

    return () => {
      if (observerRef.current && video) {
        observerRef.current.unobserve(video);
      }
    };
  }, [videoRef, shouldPlay]);
};