import { useState, useEffect } from 'react';

export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Try to use Capacitor Keyboard plugin if available
    const initCapacitorKeyboard = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Keyboard } = await import('@capacitor/keyboard');
          
          const showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
            setKeyboardHeight(info.keyboardHeight);
            setIsKeyboardOpen(true);
          });

          const hideListener = await Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
            setIsKeyboardOpen(false);
          });

          return () => {
            showListener.remove();
            hideListener.remove();
          };
        }
      } catch {
        // Capacitor not available, use web fallback
      }
      
      // Web fallback - use visualViewport API
      const handleResize = () => {
        if (window.visualViewport) {
          const heightDiff = window.innerHeight - window.visualViewport.height;
          setKeyboardHeight(heightDiff > 50 ? heightDiff : 0);
          setIsKeyboardOpen(heightDiff > 50);
        }
      };

      window.visualViewport?.addEventListener('resize', handleResize);
      window.visualViewport?.addEventListener('scroll', handleResize);

      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('scroll', handleResize);
      };
    };

    const cleanup = initCapacitorKeyboard();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, []);

  return { keyboardHeight, isKeyboardOpen };
};
