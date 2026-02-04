import { memo } from 'react';
import feedinLogo from '@/assets/feedin-logo.png';

// Memoized to prevent unnecessary re-renders
export const LoadingScreen = memo(() => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background will-change-transform">
      <div className="flex flex-col items-center space-y-3">
        {/* Optimized logo with hardware acceleration */}
        <div className="transform-gpu">
          <img 
            src={feedinLogo} 
            alt="feedin" 
            className="w-32 h-32 animate-pulse"
            loading="eager"
            decoding="async"
          />
        </div>
        {/* Simplified loading indicator */}
        <div className="flex space-x-1.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
});

LoadingScreen.displayName = 'LoadingScreen';
