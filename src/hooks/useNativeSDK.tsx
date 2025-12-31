import { useCallback, useEffect, useState, useRef } from 'react';

interface DeviceInfo {
  platform: 'ios' | 'android' | 'web';
  isNative: boolean;
  model?: string;
  osVersion?: string;
  manufacturer?: string;
}

interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

interface CameraPhoto {
  base64?: string;
  dataUrl?: string;
  path?: string;
  webPath?: string;
}

interface NativeSDK {
  // Device info
  device: DeviceInfo;
  network: NetworkStatus;
  
  // Camera
  takePhoto: () => Promise<CameraPhoto | null>;
  pickFromGallery: (options?: { multiple?: boolean; limit?: number }) => Promise<CameraPhoto[]>;
  
  // Share
  share: (options: { title?: string; text?: string; url?: string; files?: string[] }) => Promise<boolean>;
  
  // Navigation
  openBrowser: (url: string) => Promise<void>;
  
  // App lifecycle
  onAppStateChange: (callback: (isActive: boolean) => void) => () => void;
  onBackButton: (callback: () => boolean) => () => void;
  
  // Push notifications
  requestPushPermission: () => Promise<boolean>;
  getPushToken: () => Promise<string | null>;
  
  // Local notifications
  scheduleNotification: (options: {
    title: string;
    body: string;
    id?: number;
    schedule?: { at: Date };
  }) => Promise<void>;
  
  // Deep linking
  getDeepLink: () => Promise<string | null>;
  onDeepLink: (callback: (url: string) => void) => () => void;
  
  // Splash screen
  hideSplashScreen: () => Promise<void>;
  
  // File system
  downloadFile: (url: string, filename: string) => Promise<string | null>;
}

export const useNativeSDK = (): NativeSDK => {
  const [device, setDevice] = useState<DeviceInfo>({
    platform: 'web',
    isNative: false,
  });
  
  const [network, setNetwork] = useState<NetworkStatus>({
    connected: true,
    connectionType: 'unknown',
  });
  
  const backButtonListeners = useRef<(() => boolean)[]>([]);

  useEffect(() => {
    const initDevice = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const isNative = Capacitor.isNativePlatform();
        const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
        
        if (isNative) {
          const { Device } = await import('@capacitor/device');
          const info = await Device.getInfo();
          
          setDevice({
            platform,
            isNative,
            model: info.model,
            osVersion: info.osVersion,
            manufacturer: info.manufacturer,
          });
          
          // Initialize network listener
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          setNetwork({
            connected: status.connected,
            connectionType: status.connectionType,
          });
          
          Network.addListener('networkStatusChange', (status) => {
            setNetwork({
              connected: status.connected,
              connectionType: status.connectionType,
            });
          });
          
          // Initialize back button handler for Android
          if (platform === 'android') {
            const { App } = await import('@capacitor/app');
            App.addListener('backButton', () => {
              // Call listeners in reverse order (last added first)
              for (let i = backButtonListeners.current.length - 1; i >= 0; i--) {
                if (backButtonListeners.current[i]()) {
                  return; // Handler consumed the event
                }
              }
              // Default behavior: go back or exit
              if (window.history.length > 1) {
                window.history.back();
              } else {
                App.exitApp();
              }
            });
          }
        } else {
          setDevice({ platform: 'web', isNative: false });
        }
      } catch {
        setDevice({ platform: 'web', isNative: false });
      }
    };
    
    initDevice();
  }, []);

  const takePhoto = useCallback(async (): Promise<CameraPhoto | null> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        // Web fallback - use file input
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.capture = 'environment';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  dataUrl: reader.result as string,
                  webPath: URL.createObjectURL(file),
                });
              };
              reader.readAsDataURL(file);
            } else {
              resolve(null);
            }
          };
          input.click();
        });
      }
      
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      
      return {
        dataUrl: photo.dataUrl,
        webPath: photo.webPath,
        base64: photo.base64String,
      };
    } catch (error) {
      console.log('Camera error:', error);
      return null;
    }
  }, []);

  const pickFromGallery = useCallback(async (options?: { multiple?: boolean; limit?: number }): Promise<CameraPhoto[]> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        // Web fallback
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*,video/*';
          input.multiple = options?.multiple ?? false;
          input.onchange = async (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            const photos: CameraPhoto[] = [];
            for (const file of files.slice(0, options?.limit ?? 10)) {
              const reader = new FileReader();
              const photo = await new Promise<CameraPhoto>((res) => {
                reader.onload = () => {
                  res({
                    dataUrl: reader.result as string,
                    webPath: URL.createObjectURL(file),
                  });
                };
                reader.readAsDataURL(file);
              });
              photos.push(photo);
            }
            resolve(photos);
          };
          input.click();
        });
      }
      
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      
      if (options?.multiple) {
        const photos = await Camera.pickImages({
          quality: 90,
          limit: options.limit ?? 10,
        });
        return photos.photos.map((p) => ({
          webPath: p.webPath,
        }));
      } else {
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });
        return [{
          dataUrl: photo.dataUrl,
          webPath: photo.webPath,
          base64: photo.base64String,
        }];
      }
    } catch (error) {
      console.log('Gallery error:', error);
      return [];
    }
  }, []);

  const share = useCallback(async (options: { title?: string; text?: string; url?: string; files?: string[] }): Promise<boolean> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        // Web fallback
        if (navigator.share) {
          await navigator.share({
            title: options.title,
            text: options.text,
            url: options.url,
          });
          return true;
        }
        return false;
      }
      
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.title,
      });
      return true;
    } catch (error) {
      console.log('Share error:', error);
      return false;
    }
  }, []);

  const openBrowser = useCallback(async (url: string): Promise<void> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        window.open(url, '_blank');
        return;
      }
      
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } catch (error) {
      console.log('Browser error:', error);
      window.open(url, '_blank');
    }
  }, []);

  const onAppStateChange = useCallback((callback: (isActive: boolean) => void): (() => void) => {
    let cleanup = () => {};
    
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) {
          const handleVisibility = () => {
            callback(!document.hidden);
          };
          document.addEventListener('visibilitychange', handleVisibility);
          cleanup = () => document.removeEventListener('visibilitychange', handleVisibility);
          return;
        }
        
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appStateChange', ({ isActive }) => {
          callback(isActive);
        });
        cleanup = () => listener.remove();
      } catch {
        // Fallback
      }
    })();
    
    return () => cleanup();
  }, []);

  const onBackButton = useCallback((callback: () => boolean): (() => void) => {
    backButtonListeners.current.push(callback);
    return () => {
      const idx = backButtonListeners.current.indexOf(callback);
      if (idx > -1) {
        backButtonListeners.current.splice(idx, 1);
      }
    };
  }, []);

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        }
        return false;
      }
      
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch (error) {
      console.log('Push permission error:', error);
      return false;
    }
  }, []);

  const getPushToken = useCallback(async (): Promise<string | null> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return null;
      
      const { PushNotifications } = await import('@capacitor/push-notifications');
      return new Promise((resolve) => {
        PushNotifications.addListener('registration', (token) => {
          resolve(token.value);
        });
        PushNotifications.addListener('registrationError', () => {
          resolve(null);
        });
      });
    } catch {
      return null;
    }
  }, []);

  const scheduleNotification = useCallback(async (options: {
    title: string;
    body: string;
    id?: number;
    schedule?: { at: Date };
  }): Promise<void> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(options.title, { body: options.body });
        }
        return;
      }
      
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [{
          id: options.id ?? Date.now(),
          title: options.title,
          body: options.body,
          schedule: options.schedule,
        }],
      });
    } catch (error) {
      console.log('Local notification error:', error);
    }
  }, []);

  const getDeepLink = useCallback(async (): Promise<string | null> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return null;
      
      const { App } = await import('@capacitor/app');
      const info = await App.getLaunchUrl();
      return info?.url ?? null;
    } catch {
      return null;
    }
  }, []);

  const onDeepLink = useCallback((callback: (url: string) => void): (() => void) => {
    let cleanup = () => {};
    
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appUrlOpen', ({ url }) => {
          callback(url);
        });
        cleanup = () => listener.remove();
      } catch {
        // Ignore
      }
    })();
    
    return () => cleanup();
  }, []);

  const hideSplashScreen = useCallback(async (): Promise<void> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    } catch (error) {
      console.log('Splash screen error:', error);
    }
  }, []);

  const downloadFile = useCallback(async (url: string, filename: string): Promise<string | null> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        // Web fallback - trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        return url;
      }
      
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const response = await fetch(url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
      
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
      });
      
      return result.uri;
    } catch (error) {
      console.log('Download error:', error);
      return null;
    }
  }, []);

  return {
    device,
    network,
    takePhoto,
    pickFromGallery,
    share,
    openBrowser,
    onAppStateChange,
    onBackButton,
    requestPushPermission,
    getPushToken,
    scheduleNotification,
    getDeepLink,
    onDeepLink,
    hideSplashScreen,
    downloadFile,
  };
};

export default useNativeSDK;
