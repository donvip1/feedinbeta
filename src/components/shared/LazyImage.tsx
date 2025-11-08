import { useLazyImage } from '@/hooks/useLazyImage';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const LazyImage = ({
  src,
  alt,
  className,
  placeholder = '/placeholder.svg',
  onLoad,
  onError,
}: LazyImageProps) => {
  const { imageSrc, imageRef, isLoaded, isError } = useLazyImage({
    src,
    placeholder,
  });

  return (
    <img
      ref={imageRef}
      src={imageSrc}
      alt={alt}
      className={cn(
        'transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className
      )}
      onLoad={onLoad}
      onError={onError}
      loading="lazy"
    />
  );
};
