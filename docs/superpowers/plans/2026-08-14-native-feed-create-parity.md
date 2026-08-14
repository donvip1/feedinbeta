# Native Feed and Create Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render complete author identity above each native feed post, remove the duplicate rail avatar, expose correct media/comment behavior, and replace the center `+` action with the approved Video, Photo+, Story, and Go Live menu.

**Architecture:** Add a versioned Supabase feed RPC that owns profile, badge, media, and reply-inclusive comment fields, then map that contract into `FeedPost`. Keep the immersive card as a thin composition root by introducing focused author-header and create-action widgets. Existing Camera Studio, story, video-live, and audio-space routes remain the destinations.

**Tech Stack:** PostgreSQL/Supabase RPC and RLS, Dart 3.9, Flutter, Riverpod, `cached_network_image`, Flutter widget tests.

---

### Task 1: Add the versioned feed identity contract

**Files:**
- Create: `supabase/migrations/20260814190000_native_feed_identity_contract.sql`
- Test: `supabase/tests/native_feed_identity_contract.sql`

- [ ] **Step 1: Write the failing SQL contract test**

Create fixtures for a verified Premium author, one post, one top-level comment, and one reply. Assert that `native_feed_v2(30, null, null)` returns `author_verified = true`, `author_badge_tier = 'premium'`, ordered media arrays, and `comments_count = 2`.

```sql
select results.author_verified,
       results.author_badge_tier,
       results.comments_count
from public.native_feed_v2(30, null, null) results
where results.id = :'post_id';
```

- [ ] **Step 2: Run the SQL test and verify it fails**

Run: `npx supabase test db supabase/tests/native_feed_identity_contract.sql`

Expected: FAIL because `native_feed_v2` does not exist.

- [ ] **Step 3: Implement `native_feed_v2`**

The migration must add `profiles.is_verified boolean not null default false` only when absent, retain all existing profile rows, and expose a stable table-returning RPC. Resolve the active tier from `user_subscriptions` joined to `subscription_tiers`, accepting only active, unexpired subscriptions.

```sql
create or replace function public.native_feed_v2(
  p_limit integer default 30,
  p_before timestamptz default null,
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  media_url text,
  media_type text,
  media_urls text[],
  media_types text[],
  media_filter_id text,
  media_filter_ids text[],
  created_at timestamptz,
  likes_count integer,
  comments_count integer,
  views_count integer,
  refeeds_count integer,
  location text,
  post_type text,
  status text,
  original_post_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  author_verified boolean,
  author_badge_tier text,
  visibility text
)
language sql security invoker set search_path = '';
```

Count all non-deleted rows in `post_comments`, including replies. Do not depend on optional direct projections such as `posts.media_filter_id` without first adding compatibility columns in the migration.

- [ ] **Step 4: Harden grants and rerun the SQL test**

Grant execution to `authenticated`, revoke it from `anon`, and verify the function respects existing post/profile RLS.

Run: `npx supabase test db supabase/tests/native_feed_identity_contract.sql`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add supabase/migrations/20260814190000_native_feed_identity_contract.sql supabase/tests/native_feed_identity_contract.sql
git commit -m "feat(db): add native feed identity contract"
```

### Task 2: Extend the Flutter feed model and remote mappings

**Files:**
- Modify: `native/flutter/lib/src/features/feed/feed_post.dart`
- Modify: `native/flutter/lib/src/data/remote/feed_remote_data_source.dart`
- Modify: `native/flutter/lib/src/data/remote/feed_engine_remote_data_source.dart`
- Test: `native/flutter/test/feed_post_test.dart`
- Create: `native/flutter/test/feed_identity_mapping_test.dart`

- [ ] **Step 1: Write failing model and mapping tests**

Assert JSON round-tripping and remote mapping for:

```dart
isAuthorVerified: true,
authorBadgeTier: FeedAuthorBadgeTier.premium,
visibility: FeedPostVisibility.public,
authorHandle: '@creator',
commentsCount: 7,
```

Also assert that unknown tiers map to `FeedAuthorBadgeTier.none` and absent optional fields do not fail the post.

- [ ] **Step 2: Run tests and verify failure**

Run: `flutter test test/feed_post_test.dart test/feed_identity_mapping_test.dart`

Expected: FAIL because the new fields and mapper do not exist.

- [ ] **Step 3: Add explicit identity types**

```dart
enum FeedAuthorBadgeTier { none, pro, premium }
enum FeedPostVisibility { public, followers, private }

final bool isAuthorVerified;
final FeedAuthorBadgeTier authorBadgeTier;
final FeedPostVisibility visibility;
```

Update the constructor, `copyWith`, `fromJson`, and `toJson` without changing existing defaults.

- [ ] **Step 4: Replace the ad hoc posts select with the RPC**

Call `native_feed_v2` from `FeedRemoteDataSource.fetchFeed`, map flat `author_*` fields, and retain the existing viewer engagement enrichment. Update the feed-engine mapper to accept the same fields when present.

- [ ] **Step 5: Run tests and analysis**

Run: `flutter test test/feed_post_test.dart test/feed_identity_mapping_test.dart`

Run: `flutter analyze lib/src/features/feed/feed_post.dart lib/src/data/remote/feed_remote_data_source.dart lib/src/data/remote/feed_engine_remote_data_source.dart`

Expected: all tests pass and analysis reports no issues.

- [ ] **Step 6: Commit model and mapping changes**

```bash
git add native/flutter/lib/src/features/feed/feed_post.dart native/flutter/lib/src/data/remote/feed_remote_data_source.dart native/flutter/lib/src/data/remote/feed_engine_remote_data_source.dart native/flutter/test/feed_post_test.dart native/flutter/test/feed_identity_mapping_test.dart
git commit -m "feat(feed): map native author identity"
```

### Task 3: Render the enriched top-left author header

**Files:**
- Modify: `native/flutter/lib/src/features/feed/immersive/creator_header.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/caption_layer.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/immersive_post_card.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/feed_action_rail.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/feed_immersive_theme.dart`
- Test: `native/flutter/test/feed_action_rail_test.dart`
- Create: `native/flutter/test/feed_creator_header_test.dart`

- [ ] **Step 1: Write failing widget tests**

Build a post with avatar, display name, username, verified state, Premium tier, location, visibility, and timestamp. Assert that the top-left header shows the avatar, verified icon, Premium badge, username on a second line, age/privacy/location metadata, and Follow callback. Assert that `FeedActionRail` contains no avatar widget.

- [ ] **Step 2: Run tests and verify failure**

Run: `flutter test test/feed_creator_header_test.dart test/feed_action_rail_test.dart`

Expected: FAIL because `CreatorHeader` lacks the new contract and the rail still owns the avatar.

- [ ] **Step 3: Implement the author-header API**

```dart
class CreatorHeader extends StatelessWidget {
  const CreatorHeader({
    required this.authorName,
    required this.handle,
    required this.avatarUrl,
    required this.isVerified,
    required this.badgeTier,
    required this.metadata,
    required this.onProfileTap,
    this.onFollow,
  });
}
```

Use `CircleAvatar`/`CachedNetworkImageProvider`, `Icons.verified_rounded`, compact Pro/Premium pills, and a two-line identity layout. Follow is absent for the current user and when already followed.

- [ ] **Step 4: Move identity above media chrome and remove rail avatar**

Place the header in `ImmersivePostCard` below the shared top scrim and above the media-safe region. Remove `avatarText`, `avatarUrl`, `avatarHeroTag`, and `onAvatar` from `FeedActionRail`. Keep profile navigation on the header.

- [ ] **Step 5: Remove fake verification inference**

Delete `CaptionLayer._isVerified`, consume `FeedPost.isAuthorVerified`, and keep the caption focused on caption, location, and audio metadata.

- [ ] **Step 6: Verify the widgets**

Run: `flutter test test/feed_creator_header_test.dart test/feed_action_rail_test.dart test/feed_chrome_widgets_test.dart`

Expected: PASS with stable 44x44 action targets and no duplicate avatar.

- [ ] **Step 7: Commit the header**

```bash
git add native/flutter/lib/src/features/feed/immersive native/flutter/test/feed_creator_header_test.dart native/flutter/test/feed_action_rail_test.dart
git commit -m "feat(feed): add complete author header"
```

### Task 4: Replace the center action with the approved create sheets

**Files:**
- Create: `native/flutter/lib/src/features/create/create_action_sheet.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/lib/src/features/create/create_post_screen.dart`
- Test: `native/flutter/test/create_action_sheet_test.dart`
- Modify: `native/flutter/test/create_publish_navigation_test.dart`

- [ ] **Step 1: Write failing route tests**

Assert exact rows and descriptions for Video, Photo+, Story, and Go Live. Assert Go Live opens a second sheet with Video Live and Audio Space. Verify Photo+/Video enter `CameraStudioScreen`, Story enters the story composer, and both live choices enter their existing preparation routes.

- [ ] **Step 2: Run tests and verify failure**

Run: `flutter test test/create_action_sheet_test.dart test/create_publish_navigation_test.dart`

Expected: FAIL because the four-option sheet does not exist.

- [ ] **Step 3: Implement typed actions and sheets**

```dart
enum CreateAction { video, photo, story, goLive }
enum LiveCreateAction { videoLive, audioSpace }

Future<CreateAction?> showCreateActionSheet(BuildContext context);
Future<LiveCreateAction?> showLiveCreateActionSheet(BuildContext context);
```

Use neutral dark surfaces, restrained pink selection, 56px minimum rows, icons, and the approved descriptions.

- [ ] **Step 4: Route actions in `FeedShell`**

Replace `_openCreate`'s direct `showCreateMediaSourceSheet` call. Reuse `_openCameraStudio` for Photo+ and Video with the correct initial mode/source; reuse existing story and live/space constructors. A back action closes only the active sheet.

- [ ] **Step 5: Verify create navigation**

Run: `flutter test test/create_action_sheet_test.dart test/create_publish_navigation_test.dart test/camera_studio_flow_test.dart test/camera_studio_publish_test.dart`

Expected: PASS and no nested `CreatePostScreen` route after Camera Studio Next.

- [ ] **Step 6: Commit create parity**

```bash
git add native/flutter/lib/src/features/create/create_action_sheet.dart native/flutter/lib/src/features/feed/feed_shell.dart native/flutter/lib/src/features/create/create_post_screen.dart native/flutter/test/create_action_sheet_test.dart native/flutter/test/create_publish_navigation_test.dart
git commit -m "feat(create): add native creation menu"
```

### Task 5: Complete media and comment parity regression checks

**Files:**
- Modify: `native/flutter/test/feed_media_layer_test.dart`
- Modify: `native/flutter/test/post_photo_viewer_test.dart`
- Modify: `native/flutter/test/comment_sheet_test.dart`

- [ ] **Step 1: Add regression cases**

Assert that video-containing posts never enter the Photos tab, photo taps open `PostPhotoViewer`, pinch/double-tap zoom remains enabled, and adding a reply increments the post total before server reconciliation.

- [ ] **Step 2: Run the focused regression suite**

Run: `flutter test test/feed_media_layer_test.dart test/post_photo_viewer_test.dart test/comment_sheet_test.dart test/feed_creator_header_test.dart test/create_action_sheet_test.dart`

Expected: PASS.

- [ ] **Step 3: Run full source verification**

Run: `flutter analyze`

Run: `flutter test`

Expected: no analyzer issues and all tests pass.

- [ ] **Step 4: Commit regression coverage**

```bash
git add native/flutter/test/feed_media_layer_test.dart native/flutter/test/post_photo_viewer_test.dart native/flutter/test/comment_sheet_test.dart
git commit -m "test(feed): cover native parity flows"
```
