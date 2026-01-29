import React, { useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, X, Info, Megaphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AdCardProps {
  ad: {
    ad_id: string;
    title: string;
    description?: string | null;
    media_url: string;
    media_type: string;
    click_url?: string | null;
  };
  onDismiss?: (adId: string) => void;
  onAdClick?: (adId: string) => void;
  className?: string;
}

export const AdCard: React.FC<AdCardProps> = memo(({
  ad,
  onDismiss,
  onAdClick,
  className,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onAdClick?.(ad.ad_id);
    
    if (ad.click_url) {
      window.open(ad.click_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(ad.ad_id);
  };

  const isVideo = ad.media_type?.startsWith('video');

  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden bg-card border border-border/50 shadow-sm",
        "cursor-pointer hover:shadow-md transition-shadow duration-200",
        className
      )}
      onClick={handleClick}
    >
      {/* Sponsored Badge - More prominent with gradient and animation */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white text-xs font-bold shadow-lg animate-pulse">
        <Megaphone className="w-3.5 h-3.5" />
        <span>Sponsored</span>
      </div>

      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 p-1 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Media */}
      <div className="relative aspect-video bg-muted">
        {!imageLoaded && !imageError && (
          <Skeleton className="absolute inset-0" />
        )}
        
        {isVideo ? (
          <video
            src={ad.media_url}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            autoPlay
            onLoadedData={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <img
            src={ad.media_url}
            alt={ad.title}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Info className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm text-foreground line-clamp-1">
          {ad.title}
        </h3>
        
        {ad.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {ad.description}
          </p>
        )}

        {ad.click_url && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <span>Learn more</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
});

AdCard.displayName = 'AdCard';

export default AdCard;
