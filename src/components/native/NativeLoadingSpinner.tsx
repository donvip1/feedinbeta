import React from 'react';

interface NativeLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Native-style loading spinner with GPU-accelerated animation
 */
export const NativeLoadingSpinner: React.FC<NativeLoadingSpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-2 border-primary/20 border-t-primary rounded-full native-spinner`}
        style={{
          animation: 'spin 0.8s linear infinite',
          willChange: 'transform',
        }}
      />
    </div>
  );
};

/**
 * Full-screen loading state for route transitions
 */
export const NativePageLoader: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 bg-background flex items-center justify-center z-50"
      style={{
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <NativeLoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for feed items
 */
export const FeedSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 px-4 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="h-64 w-full bg-muted rounded-lg animate-pulse" />
          <div className="flex gap-4 mt-4">
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Pull-to-refresh indicator
 */
export const PullToRefreshIndicator: React.FC<{
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
}> = ({ pullDistance, isRefreshing, threshold }) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50"
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold * 1.2)}px) translateZ(0)`,
        opacity: Math.min(progress, 1),
      }}
    >
      <div
        className={`w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full ${
          isRefreshing ? 'animate-spin' : ''
        }`}
        style={{
          transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
          transition: isRefreshing ? 'none' : 'transform 0.1s linear',
        }}
      />
    </div>
  );
};

export default NativeLoadingSpinner;
