# Feed Media and Engagement Regression Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six native Flutter regressions covering video preview, per-image filters, post-publish navigation, feed media classification, photo zoom, and reply-inclusive comment totals.

**Architecture:** Extend the existing ordered media arrays with an ordered filter array, centralize post media classification on `FeedPost`, and add focused UI callbacks for filter selection and photo viewing. Keep publication and comment-count ownership in the existing FeedShell/PostController boundaries so navigation and optimistic totals remain deterministic.

**Tech Stack:** Flutter/Dart, Riverpod, Hive CE, Supabase/Postgres migrations, `video_player`, Flutter widget tests.

---

### Task 1: Ordered per-image filter data

**Files:**
- Modify: `native/flutter/lib/src/features/create/parity/create_view_models.dart`
- Modify: `native/flutter/lib/src/features/create/post_draft.dart`
- Modify: `native/flutter/lib/src/data/local/post_draft_repository.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_post.dart`
- Modify: `native/flutter/lib/src/core/sync/upload_queue_service.dart`
- Modify: `native/flutter/lib/src/data/remote/feed_remote_data_source.dart`
- Create: `supabase/migrations/20260814010000_post_media_filter_ids.sql`
- Test: `native/flutter/test/create_models_test.dart`

- [ ] Add failing model tests that round-trip `mediaFilterIds`, preserve legacy `mediaFilterId`, and keep a filter attached to a `ComposerMediaItem` through `copyWith`.
- [ ] Run `flutter test test/create_models_test.dart` and confirm the new assertions fail because the ordered field does not exist.
- [ ] Add `filterId` to `ComposerMediaItem`; add `mediaFilterIds` to draft/post serialization; pass it through draft persistence, post upload, and remote mapping.
- [ ] Add a migration defining `posts.media_filter_ids text[] not null default '{}'` with allowed preset validation for every array element.
- [ ] Run the focused model test and confirm it passes.

### Task 2: Composer video state and per-image filter UI

**Files:**
- Modify: `native/flutter/lib/src/features/create/create_post_screen.dart`
- Modify: `native/flutter/lib/src/features/create/parity/create_view_models.dart`
- Modify: `native/flutter/lib/src/features/create/parity/widgets/post_composer_panel.dart`
- Modify: `native/flutter/lib/src/features/create/parity/widgets/composer_media_carousel.dart`
- Test: `native/flutter/test/create_composer_regression_test.dart`

- [ ] Add widget/model tests proving a loading label is shown for an uninitialized video, the Filter control remains present for the active image in a multi-item carousel, and filter updates target media ID rather than list position.
- [ ] Run the focused test and confirm it fails against the current composer.
- [ ] Render explicit loading/ready/failed video states with stable keys.
- [ ] Add a filter callback to the composer view contract and reuse the Studio preset tray for the active image only.
- [ ] Persist ordered filter IDs from `_media` when saving the draft; keep videos at `original`.
- [ ] Run the focused composer test and confirm it passes.

### Task 3: Normalize media classification and rendering

**Files:**
- Modify: `native/flutter/lib/src/features/feed/feed_post.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/media_layer.dart`
- Test: `native/flutter/test/feed_post_test.dart`
- Test: `native/flutter/test/feed_media_layer_test.dart`

- [ ] Add failing tests for image-only, video-only, mixed-media, and legacy singular posts.
- [ ] Add `normalizedMedia`, `hasVideoMedia`, and `isPhotoOnly` helpers on `FeedPost`, pairing URL/type/filter entries safely.
- [ ] Replace FeedShell's singular `mediaType` tab test with the normalized helpers so mixed posts never enter Photos.
- [ ] Render image filters by image index and never wrap videos in an image `ColorFiltered`.
- [ ] Run the focused feed model/media tests and confirm they pass.

### Task 4: Full-screen photo viewer

**Files:**
- Create: `native/flutter/lib/src/features/feed/immersive/post_photo_viewer.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/photo_carousel.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/media_layer.dart`
- Test: `native/flutter/test/post_photo_viewer_test.dart`

- [ ] Add a failing widget test that taps the second carousel image, opens at index 1, finds `InteractiveViewer`, swipes pages, and closes.
- [ ] Implement a full-screen `PageRoute` with one zoom/pan surface per image, safe loading/error UI, current/total indicator, and close/back controls.
- [ ] Add `onPhotoTap(index)` to `PhotoCarousel`; open the viewer from `MediaLayer` with image-only normalized media.
- [ ] Run the viewer test and confirm it passes without changing video tap behavior.

### Task 5: Deterministic publication return to Feed

**Files:**
- Modify: `native/flutter/lib/src/features/create/create_post_screen.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Test: `native/flutter/test/create_publish_navigation_test.dart`
- Test: `native/flutter/test/feed_post_test.dart`

- [ ] Add a failing test around a pure created-post placement helper: published post ID selects the correct tab and index after refresh, with a safe fallback when absent.
- [ ] Remove duplicate publication callback dispatch from the Create success loop and return exactly one `CreatePublished(postId)` result.
- [ ] Add/use a Feed placement helper so FeedShell refreshes, selects Video or Photos from normalized media, resets pager state, and jumps to the created post instead of opening a separate search-post route.
- [ ] Run the focused navigation/placement tests and confirm they pass.

### Task 6: Reply-inclusive comment totals

**Files:**
- Modify: `native/flutter/lib/src/features/feed/immersive/comment_sheet.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/lib/src/features/feed/state/post_controller.dart`
- Test: `native/flutter/test/comment_sheet_test.dart`
- Test: `native/flutter/test/post_controller_test.dart`

- [ ] Add failing tests showing the sheet header counts roots plus replies and deletion reports the exact descendant count.
- [ ] Add `onCountChanged(delta)` to the comment sheet boundary; emit `+1` only after successful submit and `-removedCount` only after successful deletion.
- [ ] Replace root-only header counting with loaded total counting and add `adjustCommentCount(delta)` to `PostController`.
- [ ] Wire FeedShell to the delta callback and remove one-at-a-time assumptions.
- [ ] Verify the checked-in trigger counts every inserted/deleted comment row; do not add a duplicate trigger migration.
- [ ] Run the focused comment/controller tests and confirm they pass.

### Task 7: Integrated verification

**Files:**
- All files changed above.

- [ ] Run `dart format` on changed Dart files.
- [ ] Run targeted `dart analyze` on changed sources and tests.
- [ ] Run all focused regression tests together.
- [ ] Run the full `flutter test` suite.
- [ ] Run `git diff --check` and inspect `git status --short` and the focused diff.
- [ ] Build a live-configured release APK and run the six device smoke checks when an Android device is available; report device verification separately from source/test verification.
