# FEEDIN Flutter

This is the active cross-platform rebuild workspace for FEEDIN.

The older Kotlin/Jetpack Compose scaffold in `native/android` is now reference-only. New app work should happen here unless the plan changes again.

## Current Status

- Flutter app created
- Android package name: `com.feedin.app`
- App display name: `FEEDIN`
- Demo auth gate
- Bottom navigation shell:
  - Feed
  - Create
  - Messages
  - Profile
  - Settings
- Demo feed and device storage budget views
- Widget test passing
- Android debug APK build passing

## Build

```bash
cd native/flutter
flutter build apk --debug
```

APK output:

```text
native/flutter/build/app/outputs/flutter-apk/app-debug.apk
```

## Test

```bash
cd native/flutter
flutter test
dart analyze
```

Note: `flutter analyze` currently crashes on this machine because the local Flutter SDK analyzer snapshot path is broken. `dart analyze` passes.

## Next Build Steps

- Add Flutter dependencies for Supabase, secure storage, local database, media cache, and push notifications.
- Add safe local config loading.
- Replace demo auth with real Supabase auth.
- Add local-first feed database and sync queue.

