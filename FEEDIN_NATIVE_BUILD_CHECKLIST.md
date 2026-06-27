# feedIn Native Build Checklist

Status date: 2026-06-24

This is the single source of truth for the feedIn Flutter native rebuild. Keep this file updated as phases are completed.

## Confirmed Decisions

- [x] App display name is `feedIn`.
- [x] Android package name is `com.feedin.app`.
- [x] Active rebuild path is Flutter in `native/flutter`.
- [x] Kotlin project in `native/android` is reference-only.
- [x] Existing live web app stays separate while the native app is built.
- [x] Do not commit or push unless explicitly instructed.
- [x] Keep private secrets out of Git and out of the mobile app.

## Excluded From This Version

- [x] FeedIn Learn / feedin lern is not included in this native app version.
- [x] FeedAI is not included in this native app version.
- [x] Any future learning, AI assistant, AI provider, or admin AI work must stay server-owned and be planned as a later expansion.

## Current App State

- Active app: `native/flutter`
- Debug APK: `native/flutter/build/app/outputs/flutter-apk/app-debug.apk`
- Public Supabase config is passed at build/run time with `--dart-define`.
- Root `.env` is local development only. Do not print it, share it, or commit it.
- The native app is still below web-app UI/product parity. Backend wiring exists for core areas, but several Flutter screens are simplified first-pass implementations.
- Active Supabase migrations are now compact native baseline files in `supabase/migrations`.
- Active schema includes core social, payments, monetization, P2P, credits, advanced live, and calls.
- Old Lovable-generated migrations are archived in `supabase/migrations_archive_lovable`.
- New Supabase project ref is `jnegupfltkfybhwpodrr`.
- Supabase CLI is available through `npx supabase`, but migration push is waiting for a private Supabase access token or database password.

## Phase 1: Flutter Foundation

- [x] Created Flutter project.
- [x] Set Android application ID to `com.feedin.app`.
- [x] Set Android app label to `feedIn`.
- [x] Added feedIn app shell and bottom tabs.
- [x] Added safe Supabase config loading through `--dart-define`.
- [x] Added Supabase bootstrap that only initializes when public config exists.
- [x] Added Supabase sign in, sign up, session restore, sign out, and password reset.
- [x] Added secure session storage.
- [x] Added Android deep link callback for `feedin://auth-callback`.
- [x] Added native password recovery screen.
- [x] Added widget test coverage for the demo shell.
- [x] Removed demo/offline preview entry from Supabase-configured builds.
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
- [x] Removed old demo feed rows from Supabase-configured builds.
- [x] Updated Flutter feed query toward the web app `posts` schema: `status`, `media_urls`, `media_types`, and `profiles:user_id`.
- [x] Added repost/share queue using existing post share backend tables.
- [x] Replace simplified feed cards with immersive native feed UI matching the Lovable web experience.
- [x] Added real feed engagement counts and richer metadata to native feed cards.
- [x] Added native comment sheet with typed comment queueing.
- [x] Added real comments sheet, like counts, refeed queue, and share queue.
- [x] Added local save state display, copied-share action, backend share queue, and post detail view.
- [x] Added live tab content from `live_streams` and `live_spaces`.

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
- [x] Added native chat UI polish: avatars, timestamps, delivery-state icons, empty states, and attachment/call entry points.
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
- [x] Added typed notification cards with message/feed/system icons, timestamps, empty state, and deep-link tap handling.
- [x] Added privacy and media preference toggles.
- [x] Persisted settings locally.
- [x] Added storage snapshot for profile/feed/queue/chat/message/notification/media counts.
- [x] Added cleanup controls for feed cache, queued actions, messages, notifications, and media.
- [x] Added Settings diagnostic check for Supabase Storage bucket `post-media`.
- [ ] Add Firebase Cloud Messaging after `google-services.json` is provided.
- [ ] Store FCM tokens server-side after the final notification table/RPC is confirmed.
- [ ] Add production push notification payload handling.
- [ ] Add friends/follow social graph after backend schema is confirmed.
- [x] Expanded native profile with cover/banner, avatar, counts, premium indicator, location, website, and richer edit fields.
- [x] Added native profile posts grid backed by the real feed repository.
- [ ] Complete profile parity: posts grid, followers/following modals, view history, verification/role badges, and social links.

## Phase 6: Native UI/Product Parity

- [x] Replaced scaffold-style auth screen with production feedIn onboarding.
- [ ] Match the Lovable web visual language in native Flutter: immersive feed, stronger motion, polished spacing, and premium social-app density.
- [x] Added Live tab behavior backed by real `live_streams` and `live_spaces`.
- [x] Complete Feed as a TikTok-style media-first experience matching the web app. (Vertical full-screen PageView, full-bleed cached video/photo, right action rail, expandable captions, double-tap-to-like, autoplay on active page, immersive overlay tabs.)
- [x] Reworked Create into a stronger native creator surface with mode controls, media tools, camera capture, privacy toggle, and upload queue panel.
- [ ] Complete Create parity: multi-media posts, final story publishing, photo-plus flow, captions, final privacy persistence, and upload progress.
- [ ] Complete Profile parity.
- [ ] Rebuild Messages to full chat parity: online presence, real attachments, real call entry points, and backend read receipts.
- [ ] Rebuild Notifications to full web parity after final remote notification table, FCM payload shape, and typed action schema are confirmed.
- [x] Added production empty states for feed tabs, live, chats, conversations, notifications, and create drafts.
- [x] Removed remaining visible demo/offline-preview/scaffold text from Supabase-configured builds.

## Phase 7: Release, Background Work, Store Prep

- [x] Added foreground auto-sync coordinator.
- [x] Added Workmanager-based OS background sync scheduling scaffold.
- [x] Added Android release signing scaffold.
- [x] Added ignored `key.properties`/keystore rules and tracked `key.properties.example`.
- [x] Added feedIn adaptive launcher icon resources.
- [ ] Test background sync on a real Android phone after Supabase auth is active.
- [ ] Create release keystore locally.
- [ ] Build release app bundle.
- [ ] Set up Play Console internal testing.
- [ ] Add iOS Firebase config and iOS release setup later.

## Phase 8: Later Product Expansion

- [ ] Calls.
- [ ] Live rooms.
- [ ] Spaces.
- [ ] Monetization.
- [ ] Payments, payouts, credits, admin, and AI provider calls through server-owned code only.

## User To-Do List

These are the items that need your account access or private files. Do not send private keys in chat.

### Supabase Public Mobile Config

- [x] Current development Supabase URL and publishable key are available locally through the root `.env`.
- [x] New Supabase project created: `jnegupfltkfybhwpodrr`.
- [ ] Replace local build/run values with the final project URL and publishable key.

Steps:

1. Open Supabase Dashboard.
2. Open the feedIn project.
3. Go to Project Settings.
4. Open API or API Keys.
5. Copy the Project URL.
6. Copy the publishable key. If the dashboard uses old naming, use `anon public`.
7. Use those values only as `--dart-define` values or local ignored `.env` values.

Never put a service-role key, database password, payment secret, AI key, or admin key into Flutter.

### Supabase Migration Credential

- [x] Supabase CLI checked locally through `npx supabase`.
- [x] `supabase/config.toml` points to project ref `jnegupfltkfybhwpodrr`.
- [x] Added local `SUPABASE_DB_PASSWORD`.
- [x] Added local IPv4 Transaction Pooler connection string as `SUPABASE_DB_URL`.
- [x] Ran migration push with the encoded pooler DB URL.
- [x] Ran `supabase db push`; all active migrations applied successfully.

Option A, Supabase access token:

1. Open Supabase Dashboard.
2. Open Account or Profile settings.
3. Open Access Tokens.
4. Create a token for local CLI use.
5. Add it only to local `.env` as `SUPABASE_ACCESS_TOKEN=...`.
6. Do not send the token in chat and do not commit `.env`.

Option B, database password:

1. Open the new Supabase project.
2. Open Project Settings.
3. Open Database.
4. Find or reset the database password.
5. Add it only to local `.env` as `SUPABASE_DB_PASSWORD=...`.
6. Do not send the password in chat and do not commit `.env`.

Option B also needs the IPv4 pooler URL on this network:

1. Open the new Supabase project.
2. Click Connect.
3. Choose Transaction Pooler.
4. Copy the URI / connection string.
5. Replace `[YOUR-PASSWORD]` in that URI with the local database password.
6. Add the full URI only to local `.env` as `SUPABASE_DB_URL=...`.
7. Do not send the URI in chat and do not commit `.env`.

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

- [x] Consolidated active migrations into a compact native baseline.
- [x] Active migrations exclude FeedAI and FeedIn Learn.
- [x] Active migrations include payments, monetization, P2P, credits, advanced live rooms, gifts, and calls.
- [x] Pushed active migrations to project `jnegupfltkfybhwpodrr`.
- [x] Confirmed core tables exist: `posts`, `profiles`, `post_likes`, `post_comments`, `saved_posts`, `conversations`, `conversation_participants`, `messages`.
- [x] Confirmed product tables exist for credits, P2P, advanced live, and calls.
- [x] Confirmed public-safe profile search source exists: `public_profiles`.
- [x] Confirmed RPC exists: `create_conversation`.
- [x] Confirmed `post-media` storage bucket exists.
- [x] Confirmed realtime publication includes `posts` and `messages`.
- [ ] Test RLS policies with normal signed-in users from the Flutter app.

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
2. Create or open the feedIn Firebase project.
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

- [ ] Create feedIn app listing.
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
5. Continue UI polish toward the original Lovable feedIn look while preserving native Flutter performance.
