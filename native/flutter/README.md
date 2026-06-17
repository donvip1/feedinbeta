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
- Supabase config bootstrap
- Secure session storage wrapper
- Auth repository with Supabase sign-in and demo fallback
- Session restore, sign-up, and password reset request support
- Hive local storage bootstrap
- Local profile completion and cached feed storage
- Feed refresh contract with cached fallback
- Offline like/save/comment queue
- Local inbox/conversation message storage
- Offline message send queue
- Manual sync service for queued feed actions and messages

## Build

```bash
cd native/flutter
flutter build apk --debug
```

With Supabase config:

```bash
flutter build apk --debug \
  --dart-define=FEEDIN_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=FEEDIN_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
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

- Confirm real Supabase feed table/column names.
- Confirm real Supabase message/action table names.
- Test sync replay against Supabase and add background scheduling.
