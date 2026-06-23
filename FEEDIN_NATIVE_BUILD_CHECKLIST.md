# FEEDIN Native Build Checklist

Status date: 2026-06-23

This is the single source of truth for the FEEDIN Flutter native rebuild. Keep this file updated as phases are completed.

## Confirmed Decisions

- [x] App display name is `FEEDIN`.
- [x] Android package name is `com.feedin.app`.
- [x] Active rebuild path is Flutter in `native/flutter`.
- [x] Kotlin project in `native/android` is reference-only.
- [x] Existing live web app stays separate while the native app is built.
- [x] Do not commit or push unless explicitly instructed.
- [x] Keep private secrets out of Git and out of the mobile app.

## Current App State

- Active app: `native/flutter`
- Debug APK: `native/flutter/build/app/outputs/flutter-apk/app-debug.apk`
- Public Supabase config is passed at build/run time with `--dart-define`.
- Root `.env` is local development only. Do not print it, share it, or commit it.

## Phase 1: Flutter Foundation

- [x] Created Flutter project.
- [x] Set Android application ID to `com.feedin.app`.
- [x] Set Android app label to `FEEDIN`.
- [x] Added FEEDIN app shell and bottom tabs.
- [x] Added safe Supabase config loading through `--dart-define`.
- [x] Added Supabase bootstrap that only initializes when public config exists.
- [x] Added Supabase sign in, sign up, session restore, sign out, and password reset.
- [x] Added secure session storage.
- [x] Added Android deep link callback for `feedin://auth-callback`.
- [x] Added native password recovery screen.
- [x] Added widget test coverage for the demo shell.
- [ ] Add production crash/error logging after Firebase project is connected.

## Phase 2: Offline-First Feed

- [x] Added Hive local storage bootstrap.
- [x] Added local feed cache repository.
- [x] Added remote feed data source for Supabase `posts`.
- [x] Added cached feed fallback.
- [x] Added pull-to-refresh.
- [x] Added queued offline likes, saves, and comments.
- [x] Added queued action replay through sync service.
- [x] Added Supabase-compatible fields for `post_likes`, `saved_posts`, and `post_comments`.
- [x] Added realtime post events that refresh local feed cache.
- [x] Added local storage schema metadata, migration pass, and safe record decoding.
- [ ] Test feed refresh and queued action replay against live Supabase with real user sessions.
- [x] Added app-side older-post pagination using `posts.created_at` ordering.
- [ ] Add repost/share queue after the backend table or RPC is confirmed.

## Phase 3: Media Pipeline

- [x] Added image/video picker.
- [x] Added local post drafts.
- [x] Added upload queue storage.
- [x] Added Supabase Storage upload processor scaffold for bucket `post-media`.
- [x] Added Supabase `posts` insert after upload.
- [x] Added draft retry, cancel, and delete controls.
- [x] Added Settings control to manually process upload queue.
- [x] Added media cache service under app cache storage.
- [x] Feed refresh downloads remote media into local cache.
- [x] Feed cards render cached images with network fallback.
- [x] Feed cards play cached/network videos.
- [x] Added Settings media cache counts and cleanup.
- [ ] Confirm/create Supabase Storage bucket `post-media`.
- [ ] Confirm bucket policies allow authenticated upload and public/signed read as intended.
- [ ] Test draft upload queue with the live Supabase project on a real device.
- [ ] Add visible upload progress percentages if Supabase upload progress callbacks are required.

## Phase 4: Messaging

- [x] Added local conversations and messages storage.
- [x] Added inbox and conversation screens.
- [x] Added offline message queue.
- [x] Added delivery states: pending, sent, delivered, read, failed.
- [x] Added sync replay for queued messages.
- [x] Added local-to-server conversation ID mapping.
- [x] Added remote message materializer that pulls Supabase messages into Hive.
- [x] Added realtime message events that trigger local message refresh.
- [x] Added recipient search against safe public profile fields.
- [x] Added server conversation creation through `create_conversation` RPC with local fallback.
- [x] Added local notification route handling so notification taps can open a chat.
- [ ] Test recipient search with real Supabase users.
- [ ] Test `create_conversation` RPC with real Supabase users.
- [ ] Test full message replay with secure session restoration on a real device.
- [ ] Add read receipts and delivery receipts against final backend rules.

## Phase 5: Profile, Settings, Notifications

- [x] Added profile completion after login/demo entry.
- [x] Added editable profile screen.
- [x] Profile saves locally first and syncs to Supabase `profiles` when configured.
- [x] Added local notification inbox.
- [x] Added notification counts and cleanup in Settings.
- [x] Added notification-to-chat route handling for stored notification payloads.
- [x] Added privacy and media preference toggles.
- [x] Persisted settings locally.
- [x] Added storage snapshot for profile/feed/queue/chat/message/notification/media counts.
- [x] Added cleanup controls for feed cache, queued actions, messages, notifications, and media.
- [x] Added Settings diagnostic check for Supabase Storage bucket `post-media`.
- [ ] Add Firebase Cloud Messaging after `google-services.json` is provided.
- [ ] Store FCM tokens server-side after the final notification table/RPC is confirmed.
- [ ] Add production push notification payload handling.
- [ ] Add friends/follow social graph after backend schema is confirmed.

## Phase 6: Release, Background Work, Store Prep

- [x] Added foreground auto-sync coordinator.
- [x] Added Workmanager-based OS background sync scheduling scaffold.
- [x] Added Android release signing scaffold.
- [x] Added ignored `key.properties`/keystore rules and tracked `key.properties.example`.
- [x] Added FEEDIN adaptive launcher icon resources.
- [ ] Test background sync on a real Android phone after Supabase auth is active.
- [ ] Create release keystore locally.
- [ ] Build release app bundle.
- [ ] Set up Play Console internal testing.
- [ ] Add iOS Firebase config and iOS release setup later.

## Phase 7: Later Product Expansion

- [ ] Calls.
- [ ] Live rooms.
- [ ] Spaces.
- [ ] Monetization.
- [ ] Payments, payouts, credits, admin, and AI provider calls through server-owned code only.

## User To-Do List

These are the items that need your account access or private files. Do not send private keys in chat.

### Supabase Public Mobile Config

- [x] Current development Supabase URL and publishable key are available locally through the root `.env`.
- [ ] For final production, create or choose the final Supabase project.
- [ ] Replace local build/run values with the final project URL and publishable key.

Steps:

1. Open Supabase Dashboard.
2. Open the FEEDIN project.
3. Go to Project Settings.
4. Open API or API Keys.
5. Copy the Project URL.
6. Copy the publishable key. If the dashboard uses old naming, use `anon public`.
7. Use those values only as `--dart-define` values or local ignored `.env` values.

Never put a service-role key, database password, payment secret, AI key, or admin key into Flutter.

### Supabase Auth Redirect

- [ ] Add `feedin://auth-callback` to the Supabase Auth redirect allow-list.

Steps:

1. Open Supabase Dashboard.
2. Open Authentication.
3. Open URL Configuration or Redirect URLs.
4. Add `feedin://auth-callback`.
5. Save.
6. Test password reset from the mobile app.

### Supabase Storage

- [ ] Confirm/create the `post-media` bucket.
- [ ] Confirm authenticated upload policy.
- [ ] Confirm read policy, either public read or signed URL read.

Steps:

1. Open Supabase Dashboard.
2. Open Storage.
3. Create bucket named `post-media` if it does not exist.
4. Decide whether media should be public or private.
5. Add policies for authenticated users to upload into their own path.
6. Run the app and use Settings -> Check storage.

### Supabase Database/RLS Checks

- [ ] Confirm tables exist: `posts`, `profiles`, `post_likes`, `post_comments`, `saved_posts`, `conversations`, `conversation_participants`, `messages`.
- [ ] Confirm public-safe profile search source exists: `public_profiles`.
- [ ] Confirm RPC exists: `create_conversation`.
- [ ] Confirm RLS policies allow normal signed-in user actions and block unauthorized access.

Steps:

1. Open Supabase Dashboard.
2. Open Table Editor and confirm each table.
3. Open SQL Editor or Database -> Functions and confirm `create_conversation`.
4. Open Authentication and create two test users.
5. Login on device with both users and test feed, chat, and upload flows.

### Firebase Cloud Messaging

- [ ] Create/open Firebase project.
- [ ] Add Android app with package name `com.feedin.app`.
- [ ] Download `google-services.json`.
- [ ] Place it at `native/flutter/android/app/google-services.json`.
- [ ] Later for iOS, add bundle ID `com.feedin.app` and download `GoogleService-Info.plist`.

Steps:

1. Open Firebase Console.
2. Create or open the FEEDIN Firebase project.
3. Add Android app.
4. Enter package name `com.feedin.app`.
5. Download `google-services.json`.
6. Put it at `native/flutter/android/app/google-services.json`.
7. Tell me when the file is in place so I can add and test FCM code.

### Release Keystore

- [ ] Create release keystore locally before Play Store upload.
- [ ] Copy `native/flutter/android/key.properties.example` to `native/flutter/android/key.properties`.
- [ ] Fill `key.properties` locally only.
- [ ] Keep `.jks`, `.keystore`, and `key.properties` out of Git.

### Play Console

- [ ] Create FEEDIN app listing.
- [ ] Set up internal testing.
- [ ] Upload release `.aab` after release signing is ready.
- [ ] Add testers.

## Build And Test Commands

From the repo root:

```bash
cd native/flutter
dart analyze
flutter test
```

Build debug APK without Supabase:

```bash
cd native/flutter
flutter build apk --debug
```

Build debug APK with Supabase public config:

```bash
cd native/flutter
flutter build apk --debug \
  --dart-define=FEEDIN_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=FEEDIN_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

The debug APK output is:

```text
native/flutter/build/app/outputs/flutter-apk/app-debug.apk
```

Build release app bundle later:

```bash
cd native/flutter
flutter build appbundle --release \
  --dart-define=FEEDIN_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=FEEDIN_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

The release bundle output is:

```text
native/flutter/build/app/outputs/bundle/release/app-release.aab
```

## Current Next Steps

1. Run analyze, tests, and debug APK build after each implementation batch.
2. Test live Supabase auth/feed/messages/uploads on a real device.
3. Wait for `google-services.json`, then add Firebase Cloud Messaging.
4. Confirm Supabase tables, RLS policies, `post-media`, `public_profiles`, and `create_conversation`.
5. Continue UI polish toward the original Lovable FEEDIN look while preserving native Flutter performance.
