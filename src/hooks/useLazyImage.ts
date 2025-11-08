import { useState, useEffect, useRef } from 'react';

interface UseLazyImageOptions {
  src: string;
  placeholder?: string;
  rootMargin?: string;
  threshold?: number;
}

export const useLazyImage = ({
  src,
  placeholder = '',
  rootMargin = '50px',
  threshold = 0.01,
}: UseLazyImageOptions) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src) return;

    const imageElement = imageRef.current;
    if (!imageElement) return;

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      setImageSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            
            img.onload = () => {
              setImageSrc(src);
              setIsLoaded(true);
              observer.disconnect();
            };

            img.onerror = () => {
              setIsError(true);
              observer.disconnect();
            };

            img.src = src;
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(imageElement);

    return () => {
      observer.disconnect();
    };
  }, [src, rootMargin, threshold]);

  return {
    imageSrc,
    imageRef,
    isLoaded,
    isError,
  };
};
