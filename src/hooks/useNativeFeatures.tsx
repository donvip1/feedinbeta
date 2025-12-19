import { useCallback, useEffect, useState } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface NativeFeatures {
  // Haptic feedback
  haptic: (type: HapticType) => Promise<void>;
  
  // Platform info
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  
  // Status bar control
  setStatusBarStyle: (style: 'dark' | 'light') => Promise<void>;
  setStatusBarColor: (color: string) => Promise<void>;
  
  // Keyboard
  hideKeyboard: () => Promise<void>;
  showKeyboard: () => Promise<void>;
}

export const useNativeFeatures = (): NativeFeatures => {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  useEffect(() => {
    const initPlatform = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const isNativePlatform = Capacitor.isNativePlatform();
        setIsNative(isNativePlatform);
        
        if (isNativePlatform) {
          const plt = Capacitor.getPlatform();
          setPlatform(plt === 'ios' ? 'ios' : plt === 'android' ? 'android' : 'web');
        }
      } catch {
        setIsNative(false);
        setPlatform('web');
      }
    };
    
    initPlatform();
  }, []);

  const haptic = useCallback(async (type: HapticType) => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        // Web fallback - use vibration API if available
        if ('vibrate' in navigator) {
          switch (type) {
            case 'light':
            case 'selection':
              navigator.vibrate(10);
              break;
            case 'medium':
              navigator.vibrate(20);
              break;
            case 'heavy':
            case 'success':
            case 'warning':
            case 'error':
              navigator.vibrate(30);
              break;
          }
        }
        return;
      }

      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'warning':
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case 'error':
          await Haptics.notification({ type: NotificationType.Error });
          break;
        case 'selection':
          await Haptics.selectionStart();
          await Haptics.selectionEnd();
          break;
      }
    } catch (error) {
      console.log('Haptics not available:', error);
    }
  }, []);

  const setStatusBarStyle = useCallback(async (style: 'dark' | 'light') => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: style === 'dark' ? Style.Dark : Style.Light });
    } catch (error) {
      console.log('StatusBar not available:', error);
    }
  }, []);

  const setStatusBarColor = useCallback(async (color: string) => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      console.log('StatusBar not available:', error);
    }
  }, []);

  const hideKeyboard = useCallback(async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        // Web fallback - blur active element
        (document.activeElement as HTMLElement)?.blur();
        return;
      }
      
      const { Keyboard } = await import('@capacitor/keyboard');
      await Keyboard.hide();
    } catch (error) {
      console.log('Keyboard hide not available:', error);
    }
  }, []);

  const showKeyboard = useCallback(async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      
      const { Keyboard } = await import('@capacitor/keyboard');
      await Keyboard.show();
    } catch (error) {
      console.log('Keyboard show not available:', error);
    }
  }, []);

  return {
    haptic,
    isNative,
    platform,
    setStatusBarStyle,
    setStatusBarColor,
    hideKeyboard,
    showKeyboard,
  };
};

export default useNativeFeatures;
