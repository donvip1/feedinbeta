# FeedIn Native App Background Service Setup

## Overview
The app includes WhatsApp-style background connectivity for live spaces, calls, and notifications. This guide documents the native platform configurations required for iOS and Android.

## Implemented Features
- ✅ Background audio playback (live spaces, voice/video calls)
- ✅ Background service notifications
- ✅ App lifecycle management (foreground/background detection)
- ✅ Wake lock to prevent device sleep during calls
- ✅ Persistent audio context using Web Audio API

## Before Building for Native Platforms

### 1. Pull Latest Changes
```bash
git pull origin main
npm install
```

### 2. Sync with Native Platforms
After making code changes, sync the project:
```bash
npx cap sync ios
npx cap sync android
```

## iOS Configuration

### Required Info.plist Changes
Add the following to `ios/App/App/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>fetch</string>
</array>

<key>NSBonjourServices</key>
<array>
  <string>_http._tcp</string>
  <string>_https._tcp</string>
</array>
```

### Steps to Build for iOS
1. Open `ios/App/App.xcworkspace` in Xcode
2. Select your target and go to **Signing & Capabilities**
3. Add **Background Modes** capability
4. Enable: `Audio, AirPlay, and Picture in Picture`, `Voice over IP`, `Background Fetch`
5. Build and run on device or simulator

## Android Configuration

### Required AndroidManifest.xml Changes
Add the following to `android/app/src/main/AndroidManifest.xml` (inside the `<manifest>` tag):

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.INTERNET" />

<!-- MainActivity Activity Configuration -->
<!-- Find the MainActivity activity tag and modify it: -->
<activity
  android:name=".MainActivity"
  android:launchMode="singleTask"
  ...
>
```

### Steps to Build for Android
1. Run `npx cap add android` (if not already done)
2. Run `npx cap update android`
3. Open `android/` folder in Android Studio
4. Build → Build Bundle(s) / APK(s)
5. Or run directly: `npx cap run android`

## Key Files Modified for Background Support
- `src/lib/background-service-manager.ts` - Core background service logic
- `src/lib/background-audio-manager.ts` - Web Audio API integration
- `capacitor.config.ts` - Capacitor configuration
- `src/context/SpaceContext.tsx` - Space lifecycle management
- `src/context/CallContext.tsx` - Call lifecycle management

## Testing Background Functionality
1. **Live Spaces**: Start a space, minimize the app, verify audio continues
2. **Calls**: Start a call, switch apps or lock screen, verify audio persists
3. **Notifications**: Check that persistent notifications appear on Android when services are active
4. **Reconnection**: Put app in background for 30+ seconds, bring to foreground, verify reconnection

## Important Notes
- Background audio only works on **physical devices**, not simulators
- iOS requires testing on a real device for background modes to function
- Android: Ensure battery optimization is disabled for the app in device settings
- The `capacitor.config.ts` includes a `server` block for development—comment it out for production builds

## Deployment Checklist
- [ ] Run `npx cap sync ios && npx cap sync android`
- [ ] Verify iOS Info.plist has background modes
- [ ] Verify Android AndroidManifest.xml has foreground service permissions
- [ ] Test on real iOS device (iPhone)
- [ ] Test on real Android device
- [ ] Disable development server in `capacitor.config.ts` before release build
- [ ] Build and submit to App Store and Google Play

## Troubleshooting
**Audio stops in background on iOS**: Ensure `UIBackgroundModes` includes `audio` and `voip`
**Android foreground service not showing**: Check `android:launchMode="singleTask"` is set on MainActivity
**App disconnects when backgrounded**: Verify `backgroundServiceManager.initialize()` is called in App.tsx useEffect
