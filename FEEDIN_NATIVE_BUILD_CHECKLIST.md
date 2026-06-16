# FEEDIN Native Rebuild Plan And Checklist

Status date: 2026-06-16

This is the single source of truth for the FEEDIN mobile rebuild.

## Confirmed Decisions

- Android display name: `FEEDIN`
- Android package name: `com.feedin.app`
- Active rebuild path: Flutter
- Target platforms: Android, iOS, later desktop/web where useful
- Kotlin/Jetpack Compose project remains reference-only in `native/android`
- Existing web app remains live while native app is built in parallel
- No commits or pushes unless explicitly instructed

## Active Workspace

- Active app: `native/flutter`
- Reference-only Kotlin scaffold: `native/android`
- Current debug APK: `native/flutter/build/app/outputs/flutter-apk/app-debug.apk`

## Why Flutter

Flutter is now the better fit because FEEDIN needs Android, iOS, and later desktop reach from one codebase. Kotlin/Jetpack Compose remains useful as a reference for Android-native ideas, but new product work should happen in Flutter.

## Architecture Direction

- UI: Flutter Material 3 with platform-aware behavior
- Backend: Supabase/Postgres/Storage/Edge Functions
- Auth: Supabase Auth
- Secure storage: Android Keystore and iOS Keychain through Flutter secure storage
- Local database: Drift, Isar, or Hive decision pending
- Background sync: Flutter plugins plus platform-specific workers where needed
- Push notifications: Firebase Cloud Messaging
- Media: cached images, video playback/cache, upload queue, local drafts

## Security Rules

- Do not put service-role keys in the app.
- Do not put payment secrets, AI keys, admin keys, or database passwords in the app.
- The app may use only Android/iOS-safe public Supabase values: project URL and publishable key or legacy anon public key.
- Privileged logic stays on the server through Supabase RLS and Edge Functions.
- Do not promise impossible security. Target professional hardening: least privilege, server validation, RLS, rate limits, auditing, and encrypted local sessions.

## Done

- Created Flutter project in `native/flutter`
- Set Android package/application ID to `com.feedin.app`
- Set visible app label to `FEEDIN`
- Added Flutter FEEDIN app shell
- Added demo auth gate
- Added bottom navigation: Feed, Create, Messages, Profile, Settings
- Added demo feed screen
- Added device storage budget screen
- Added Flutter widget test for opening the demo shell
- Android debug APK builds successfully from Flutter
- Kotlin Android reference project exists in `native/android`
- Kotlin reference includes Room/WorkManager concepts that can be ported into Flutter equivalents
- Added device storage budget plan

## Not Done Yet / Backlog

- Real Supabase auth
- Encrypted session/token storage
- Real feed API sync
- Server replay of queued offline actions
- Flutter local database implementation
- Flutter media cache/video playback implementation
- Firebase Cloud Messaging setup
- Push notification handling
- Real messages inbox/conversation screens
- Upload queue and draft storage
- App icon/brand assets
- Release signing config
- Play Store internal testing setup

## Phases

### Phase 1: Flutter Foundation

- Keep FEEDIN shell stable across Android/iOS layouts.
- Add safe config loading.
- Add Supabase auth.
- Add encrypted session storage.
- Add basic error/crash logging.
- Keep all secrets out of Git.

### Phase 2: Offline-First Feed

- Add local database.
- Cache feed posts, authors, media metadata, and sync cursors.
- Add pull-to-refresh and infinite scroll.
- Queue likes, saves, comments, reposts, and post creation while offline.
- Sync queued actions when online.

### Phase 3: Media Pipeline

- Add image/video picker.
- Add upload queue.
- Add local drafts.
- Add upload progress, retry, cancel.
- Add image and video cache.

### Phase 4: Messaging

- Add inbox and conversation screens.
- Store conversations/messages locally.
- Add realtime sync.
- Queue offline messages.
- Add read/delivery states.
- Open message notifications into the right conversation.

### Phase 5: Profile, Settings, Notifications

- Add profile view/edit.
- Add friends/follow social graph.
- Add notification inbox.
- Add cache/storage controls.
- Add privacy/session settings.

### Phase 6: Calls, Live, Spaces, Monetization

- Add calls/live/spaces after core app is stable.
- Keep payments, payouts, credits, admin, and AI provider calls server-owned.

## User Needs To Provide

- Supabase project URL
- Supabase publishable key or legacy anon key
- Firebase Android app config file: `google-services.json`
- Later, Firebase iOS app config file: `GoogleService-Info.plist`
- Final app icon/brand assets
- Later: release keystore details, only when preparing release builds

## Build Command

From the Flutter project:

```bash
cd native/flutter
flutter build apk --debug
```

Debug APK:

```text
native/flutter/build/app/outputs/flutter-apk/app-debug.apk
```

## Supabase Setup For Novice

1. Open Supabase Dashboard.
2. Open the FEEDIN project.
3. Go to Project Settings.
4. Open API or API Keys.
5. Copy the Project URL.
6. Copy the publishable key. If the dashboard uses old naming, copy the `anon public` key.

Do not copy service-role keys into Flutter.

## Firebase Setup For Novice

1. Open Firebase Console.
2. Create or open the FEEDIN Firebase project.
3. Add Android app.
4. Use package name `com.feedin.app`.
5. Download `google-services.json`.
6. Put it later at `native/flutter/android/app/google-services.json`.

For iOS later:

1. Add iOS app in Firebase.
2. Use bundle id `com.feedin.app`.
3. Download `GoogleService-Info.plist`.
4. Put it later in the iOS Runner app.

## Current Next Step

1. Add Flutter dependencies for Supabase, secure storage, local database, media cache, and Firebase.
2. Add real auth repository and secure token storage.
3. Replace demo auth gate with real Supabase login/signup.
4. Keep service-role keys and private secrets out of the Android app.
