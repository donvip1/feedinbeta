import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f7064a339a9346e59524cff96641637c',
  appName: 'feedinbeta',
  webDir: 'dist',
  // Development server configuration - comment this out for production builds
  server: {
    url: 'https://f7064a33-9a93-46e5-9524-cff96641637c.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#9333EA',
      sound: 'beep.wav',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#000000',
    // Note: For true background audio, add these to android/app/src/main/AndroidManifest.xml:
    // <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    // <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    // <uses-permission android:name="android.permission.WAKE_LOCK" />
    // And add to the <activity> tag: android:launchMode="singleTask"
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#000000',
    // Note: For true background audio, add to ios/App/App/Info.plist:
    // <key>UIBackgroundModes</key>
    // <array>
    //   <string>audio</string>
    //   <string>voip</string>
    //   <string>fetch</string>
    // </array>
  },
};

export default config;
