# feedIn Sprint Plan — 7 Modules

**Framework:** Flutter (Dart) — `native/flutter`. **Backend:** Supabase (project `jnegupfltkfybhwpodrr` / "feedin-live"). No stack change recommended; all modules fit Flutter + Supabase, with two exceptions flagged below (video ABR CDN, VoIP push).

**Reality check:** this is a multi-week program, not a single pass. Several items are large sub-projects with hard external dependencies (Google OAuth credentials, Apple PushKit/CallKit certs, a video transcoding CDN). This plan splits every module into: packages to install · backend work · client files · **blockers only you can clear** · what can start immediately with no new packages.

---

## Consolidated package install list (exact names — nothing hallucinated)

Add to `native/flutter/pubspec.yaml` (I'll pin versions when we wire each):
- **Auth/Google:** `google_sign_in`
- **Permissions onboarding:** `permission_handler` ✅ already installed
- **Contacts:** `flutter_contacts`  (hashing uses `crypto` ✅ already installed)
- **VoIP/incoming-call UI:** `flutter_callkit_incoming`  (+ `flutter_local_notifications` for rich message notifications & reply-from-notification)
- **Media caching/compression:** `cached_network_image`, `flutter_cache_manager`, `flutter_image_compress` (WebP), `video_compress` (H.265/optimized MP4)
- **Branding:** `flutter_launcher_icons` (dev), `flutter_native_splash` (dev)
- **Calls/PiP:** `livekit_client` ✅ already installed · PiP: `floating` (Android PictureInPicture)
- Already installed and reused: `firebase_messaging`, `supabase_flutter`, `video_player`, `record`, `just_audio`, `file_picker`, `flutter_webrtc`.

## Decisions I need from you (hard blockers)

1. **iOS in scope now?** The repo is Android-first — no Xcode/CocoaPods configured (per `flutter doctor`). iOS app icons, CallKit, PushKit all need a Mac with Xcode + an Apple Developer account ($99/yr) + certs. If iOS is later, Modules 2/7 ship Android-first now.
2. **Video CDN / ABR.** Supabase Storage does **not** transcode video, so true HLS/DASH adaptive bitrate isn't possible on Supabase alone. Options: **(a)** keep Supabase Storage + client-side compression + progressive MP4 (good, simple, no new bill), or **(b)** **Cloudflare Stream** (real HLS ABR + global CDN, ~$1/1k min stored + $1/1k min delivered) — you already have `cloudflare-stream` edge functions in the repo. Recommend (b) for reels if budget allows; (a) otherwise.
3. **Google OAuth credentials.** You create OAuth client IDs (Web + Android; iOS if #1) in Google Cloud Console, put the **Web client ID** in Supabase → Auth → Providers → Google, and give me the Android SHA-1 wiring. I can't create these.
4. **Group-call scale.** No client SDK does a 200,000-person live *call*. LiveKit (what we use) handles calls of ~ up to a few hundred active publishers; 200k = a **broadcast/space** (1 speaker → many listeners), which is a different feature. Proposal: group **calls** cap ~50-100 active; large rooms use the existing live-broadcast path. Confirm.
5. **Account-merge policy (Google + existing email).** If a Google email matches an existing password account, do we auto-link (same email = same user, Supabase does this natively) or require verification? Recommend Supabase native identity-linking (same email → same user).

---

## MODULE 1 — Auth & Onboarding

### 1A. Login/Signup redesign  ·  *startable now, no new package*
Full-bleed brand gradient, borderless underline inputs, one big rounded primary button, Forgot-password link, animated Login⇄Signup toggle (slide/fade).
- Files: rework `features/auth/auth_gate.dart`; new `features/auth/widgets/{auth_scaffold,brand_field,primary_button,google_button}.dart`, `features/auth/login_screen.dart`, `features/auth/signup_screen.dart`. Keep `AuthRepositoryContract` unchanged.

### 1B. Google Sign-In  ·  *blocked on package + OAuth creds (decision 3)*
`google_sign_in` → get Google `idToken` → `supabase.auth.signInWithIdToken(provider: google, idToken:)`. First login auto-creates profile (display name / email / photo from Google, fallback avatar). Same email → Supabase links identities natively. Bind/unbind in Settings via `supabase.auth.linkIdentity` / `unlinkIdentity`.
- Files: `features/auth/data/google_auth_service.dart`, add methods to `AuthRepository`; Settings binding tile.

### 1C. Permission onboarding  ·  *startable now (`permission_handler` installed)*
3–4 swipeable explainer screens (Notifications → Mic/Camera → Contacts → Photos/Storage), each with friendly copy and its own request; gate to home only after each is actioned; persist state in Hive; re-prompt denied → deep-link to system Settings.
- Files: `features/onboarding/permission_onboarding_screen.dart`, `features/onboarding/permission_flow_controller.dart`, `core/permissions/permission_service.dart`. Unit-test the flow controller.

## MODULE 2 — Push Notifications & Background Calls  ·  *blocked: package + APNs/PushKit (decision 1)*
- **Android now:** high-priority FCM data payload → `flutter_callkit_incoming` shows full-screen incoming-call UI even when killed; accept routes into `CallScreen` (LiveKit engine already wired). Rich message notifications + grouping + reply action via `flutter_local_notifications`.
- **iOS (needs decision 1):** PushKit + CallKit via `flutter_callkit_incoming`; VoIP cert + APNs key in Firebase.
- **Server:** a `send-call-push` / `send-message-push` edge function that sends the FCM/APNs payloads (server-owned). Deep-link map already exists in `feed_shell`.
- Files: `core/notifications/callkit_service.dart`, `core/notifications/rich_notifications.dart`; extend `push_notification_service.dart`; new edge functions.

## MODULE 3 — Media Storage & Feed Performance  ·  *partly now; ABR blocked (decision 2)*
- Now (packages): `cached_network_image` for avatars/images; pre-cache next 3 reels via `flutter_cache_manager` + `video_player` controllers warmed off-screen; skeleton screens + pagination polish (feed already paginates); pull-to-refresh (exists) hardening.
- Upload compression: `flutter_image_compress` → WebP; `video_compress` → optimized MP4/H.265 before upload.
- ABR/HLS: only via Cloudflare Stream (decision 2). If Supabase-only, ship progressive-MP4 + compression (no ABR).
- Migration script (deliverable 4): re-point/copy existing `post-media` objects; if moving to R2/Stream, a one-time backfill job.
- Files: `core/media/media_cache.dart`, `core/media/reel_preloader.dart`, `core/media/upload_compressor.dart`; feed skeleton widgets.

## MODULE 4 — Profile Redesign & Username Policy  ·  *startable now*
- Profile UI: banner + circular avatar w/ online dot, bio/link/location, follower/following, tabbed Posts / Reels / Tagged / Saved grids, Edit-Profile bottom sheet, settings gear. (Rework `profile_editor_screen.dart` + new read-only `profile_screen.dart` + tab widgets.)
- **Username policy (server-authoritative):** migration adds `profiles.username_changed_at timestamptz` + `username_locked boolean`; RPC `change_username(p_username)` enforces: standard users → once ever; premium (active subscription) → once per 90 days; validates uniqueness/format server-side. Client hides/disables the control + shows "Next change in X days". Unit-test the validation.
- Files: migration + `change_username` RPC; `features/profile/profile_screen.dart`, `.../widgets/*`, `features/settings/username_section.dart`.

## MODULE 5 — Chat Rebrand & Groups
- **Private chat:** bubbles, swipe-to-reply, reactions, read receipts, **voice notes with waveform**, forwarding — *most already built this session*. Remaining: reaction polish, double-blue-check receipts, typing/online/last-seen surfacing, optional disappearing messages. *Startable now.*
- **Groups (Telegram-grade):** admin controls (pin, restrict, slow mode, anon admin), granular permissions, invite links. Backend: extend group tables + RLS + RPCs. Large but mostly server + UI.
- **Group calls:** LiveKit room per group (engine exists); **shareable invite links** `feedin://join-call/<uuid>` with expiry/revoke (new `call_invites` table + `create-call-invite` edge fn — already in web repo); **PiP** via `floating`. *Blocked on decision 4 for scale.*

## MODULE 6 — Contact Sync & Friend Auto-Add  ·  *blocked on `flutter_contacts` package*
- Request Contacts (in onboarding + Settings); SHA-256 hash phone numbers client-side (`crypto`); upload only hashes to an RPC `match_contacts(p_hashes text[])` that joins against a `profiles.phone_hash` column (never raw numbers server-side); auto-add matches as friends (existing `follows`/friends graph); "Invite" button via SMS/dynamic link for non-matches.
- **Privacy model (WhatsApp-style):** `profiles` privacy columns (last_seen / photo / status / about) defaulting to "friends"; enforced in RLS + read RPCs. Verified/public accounts default public.
- Files: migration (`phone_hash`, privacy cols, `match_contacts` RPC, privacy RLS); `features/contacts/*`, `core/contacts/contact_hasher.dart` (unit-tested).

## MODULE 7 — Branding & Logo  ·  *startable now once icon packages installed*
- Source: `src/assets/feedin-logo.png` / `feedin-icon.png` (the `webversion/assets/feedin.png` path doesn't exist; these are the real assets).
- `flutter_launcher_icons`: generate Android adaptive icon (all densities, foreground+background) + iOS AppIcon set (if decision 1).
- `flutter_native_splash`: branded splash (centered logo, brand background, fade into auth/home).
- In-app: reusable `BrandMark` widget for auth header, empty states, loaders.
- Files: `flutter_launcher_icons.yaml`, splash config in pubspec, copy asset into `native/flutter/assets/brand/`, `core/brand/brand_mark.dart`.

---

## Suggested execution order
1. **Now, unblocked (no installs, no external setup):** 1A auth redesign · 1C permission onboarding · 4 username policy (server) + profile redesign · 5 private-chat polish.
2. **After you install icon packages:** Module 7 (icons + splash).
3. **After you install packages + clear decisions 2/3:** 1B Google · 3 caching/compression · 6 contacts.
4. **After decision 1 (iOS) + certs:** Module 2 VoIP/CallKit (Android first regardless).
5. **After decision 4:** Module 5 groups + group calls + invite links.

## Cross-cutting (applies to every module)
Error/loading/empty states everywhere · small reusable widgets (no monoliths) · unit tests for username validation, contact hashing, permission-flow controller, Google token handling · `dart analyze` clean + `flutter test` green + APK build after each track.
