import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface ScrollPosition {
  x: number;
  y: number;
}

const scrollPositions = new Map<string, ScrollPosition>();

export const ScrollRestoration = () => {
  const location = useLocation();
  const previousLocationRef = useRef(location.pathname);

  useEffect(() => {
    const previousPath = previousLocationRef.current;
    
    // Save scroll position before navigation
    if (previousPath !== location.pathname) {
      scrollPositions.set(previousPath, {
        x: window.scrollX,
        y: window.scrollY,
      });
    }

    // Restore scroll position or scroll to top
    const savedPosition = scrollPositions.get(location.pathname);
    
    if (savedPosition && location.state?.scrollRestoration !== false) {
      // Restore previous scroll position for back/forward navigation
      setTimeout(() => {
        window.scrollTo(savedPosition.x, savedPosition.y);
      }, 0);
    } else {
      // Scroll to top for new navigation
      window.scrollTo(0, 0);
    }

    previousLocationRef.current = location.pathname;
  }, [location]);

  return null;
};