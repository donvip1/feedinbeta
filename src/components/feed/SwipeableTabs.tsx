import { useRef, useCallback, ReactNode } from 'react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface SwipeableTabsProps {
  children: ReactNode;
  activeIndex: number;
  onTabChange: (index: number) => void;
  tabCount: number;
}

/**
 * Component that adds horizontal swipe gestures for tab navigation
 * Provides haptic feedback on tab change for native app feel
 */
export function SwipeableTabs({ 
  children, 
  activeIndex, 
  onTabChange,
  tabCount 
}: SwipeableTabsProps) {
  const { haptic } = useNativeFeatures();
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  
  const SWIPE_THRESHOLD = 50; // pixels
  const VELOCITY_THRESHOLD = 0.3; // pixels per millisecond
  const VERTICAL_THRESHOLD = 30; // If vertical movement exceeds this, ignore horizontal

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    const deltaY = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    const deltaTime = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaX) / deltaTime;
    
    // Ignore if mostly vertical swipe (scrolling)
    if (deltaY > VERTICAL_THRESHOLD && deltaY > Math.abs(deltaX)) {
      return;
    }
    
    // Fast flick OR sufficient distance = navigate
    if (velocity > VELOCITY_THRESHOLD || Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0 && activeIndex < tabCount - 1) {
        // Swipe left - next tab
        haptic('light');
        onTabChange(activeIndex + 1);
      } else if (deltaX < 0 && activeIndex > 0) {
        // Swipe right - previous tab
        haptic('light');
        onTabChange(activeIndex - 1);
      }
    }
  }, [activeIndex, tabCount, onTabChange, haptic]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full"
    >
      {children}
    </div>
  );
}

export default SwipeableTabs;
