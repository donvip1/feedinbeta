import { useState, useEffect, useCallback, useRef } from 'react';

export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [visualViewportOffset, setVisualViewportOffset] = useState(0);
  const initialViewportHeightRef = useRef<number>(0);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced update to prevent jitter
  const updateKeyboardState = useCallback((height: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      const isOpen = height > 50;
      setKeyboardHeight(isOpen ? height : 0);
      setIsKeyboardOpen(isOpen);
    }, 16); // ~1 frame
  }, []);

  useEffect(() => {
    // Store initial viewport height
    if (window.visualViewport) {
      initialViewportHeightRef.current = window.visualViewport.height;
    } else {
      initialViewportHeightRef.current = window.innerHeight;
    }

    // Try to use Capacitor Keyboard plugin if available
    const initCapacitorKeyboard = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Keyboard } = await import('@capacitor/keyboard');
          
          const showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
            updateKeyboardState(info.keyboardHeight);
          });

          const hideListener = await Keyboard.addListener('keyboardWillHide', () => {
            updateKeyboardState(0);
          });

          return () => {
            showListener.remove();
            hideListener.remove();
          };
        }
      } catch {
        // Capacitor not available, use web fallback
      }
      
      // Web fallback - use visualViewport API with better handling
      const vv = window.visualViewport;
      if (!vv) return;

      const handleViewportChange = () => {
        // Calculate keyboard height from viewport difference
        // This works on iOS Safari and most mobile browsers
        const currentHeight = vv.height;
        const offsetTop = vv.offsetTop;
        
        // The keyboard height is the difference between initial height and current
        // Plus any offset (for iOS address bar changes)
        const heightDiff = initialViewportHeightRef.current - currentHeight;
        
        // Also track the viewport offset for positioning
        setVisualViewportOffset(offsetTop);
        
        // Only consider it a keyboard if the diff is significant (>100px)
        // This avoids triggering on address bar hide/show
        if (heightDiff > 100) {
          updateKeyboardState(heightDiff);
        } else if (heightDiff < 50) {
          updateKeyboardState(0);
        }
      };

      // Listen to both resize and scroll events
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);

      // Initial check
      handleViewportChange();

      return () => {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      };
    };

    const cleanup = initCapacitorKeyboard();
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      cleanup.then(fn => fn?.());
    };
  }, [updateKeyboardState]);

  return { keyboardHeight, isKeyboardOpen, visualViewportOffset };
};
