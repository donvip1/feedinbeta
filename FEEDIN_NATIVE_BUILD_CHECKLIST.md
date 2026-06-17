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
- Added Supabase Flutter dependency
- Added Flutter secure storage dependency
- Added safe Supabase config loading through `--dart-define`
- Added Supabase bootstrap that initializes only when config exists
- Added auth repository with real Supabase sign-in path and demo fallback
- Added secure session storage wrapper
- Added Supabase session restore on app startup
- Added sign-up flow
- Added password reset request flow
- Added auth loading, success, and error states
- Added Hive local storage bootstrap
- Added local profile repository
- Added local feed cache repository
- Added remote feed data source contract for Supabase `posts`
- Added feed refresh path that falls back to cached feed
- Added pending offline action queue
- Added offline like/save/comment action buttons
- Added profile completion screen after login/demo entry
- Added profile tab backed by locally stored profile data
- Feed tab now loads cached posts from local storage
- Added local conversations/messages storage
- Added Messages tab with inbox and conversation view
- Added offline message send queue with pending delivery state
- Added sync service for replaying queued feed actions and messages
- Added manual Sync now control in Settings
- Added retry/failure handling for queued feed actions and messages
- Confirmed core Supabase schema from local migrations: `posts`, `profiles`, `post_likes`, `post_comments`, `saved_posts`, `conversations`, `conversation_participants`, and `messages`
- Updated Flutter feed remote query to read `posts.content` and author data from `profiles`
- Updated offline action replay to use Supabase-compatible fields: `post_id`, `content`, and authenticated `user_id`
- Updated comment replay to use `post_comments` instead of placeholder `comments`
- Updated message replay to use `messages.content`, `sender_id`, `message_type`, and `status`
- Added local-to-server conversation ID mapping for message sync
- Added first-sync server conversation creation and current-user participant insertion before replaying queued messages
- Added remote profile fetch/upsert data source for Supabase `profiles`
- Wired login/session restore to load the matching local profile or fetch the Supabase profile
- Wired profile completion to save locally first and upsert `display_name`, `username`, and `bio` to Supabase when configured
- Added Android deep-link handling for `feedin://auth-callback`
- Wired Supabase password reset emails to use the mobile callback URL
- Added native password recovery screen that updates the password after Supabase emits `passwordRecovery`
- Added local storage maintenance service for feed cache, pending actions, conversations, and messages
- Added Settings storage snapshot showing local profile/feed/queue/chat/message record counts
- Added Settings cleanup controls for feed cache, queued actions, and local messages
- Added ignored local Flutter run helper that maps existing root `.env` Supabase values to `--dart-define`
- Verified Android debug build with local development Supabase URL and publishable key
- Added media cache directory service under app cache storage
- Added media cache file/size tracking and Settings cleanup control
- Kotlin Android reference project exists in `native/android`
- Kotlin reference includes Room/WorkManager concepts that can be ported into Flutter equivalents
- Added device storage budget plan

## Not Done Yet / Backlog

- Stronger typed local storage adapters/migrations for feed/messages/actions
- Flutter media download/cache integration for feed images/videos
- Flutter video playback implementation
- Firebase Cloud Messaging setup
- Push notification handling
- Realtime message sync
- Test sync replay against the live Supabase project with real user sessions
- Add real recipient selection and multi-user conversation participant management
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
- Supabase publishable key or legacy anon public key
- Supabase Auth redirect allow-list entry for `feedin://auth-callback`
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

Build with Supabase config:

```bash
flutter build apk --debug \
  --dart-define=FEEDIN_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=FEEDIN_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
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

1. Test auth, feed refresh, action replay, and message replay against the real Supabase project.
2. Add real recipient selection and multi-user conversation participant management.
3. Add background sync scheduling.
4. Keep service-role keys and private secrets out of the app.
