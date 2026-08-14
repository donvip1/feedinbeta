# Single-Route Full-Screen Post Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make capture, media review, caption/filter editing, and publication one portrait full-screen Camera Studio route that returns users to the published Feed post.

**Architecture:** Keep `CameraStudioScreen` as the single navigation route and replace review-to-composer pushes with an internal `capture → review → details` state machine. Add a focused media-first details widget that receives state and callbacks, while the screen creates the existing draft/upload queue records and returns the existing `CreatePublished(postId)` result to FeedShell.

**Tech Stack:** Flutter/Dart, `camera`, `image_picker`, `video_player`, existing Hive drafts and Supabase upload queue, Flutter widget tests.

---

### Task 1: Define the Camera Studio stage transition contract

**Files:**
- Modify: `native/flutter/lib/src/features/create/camera_studio/camera_studio_screen.dart`
- Test: `native/flutter/test/camera_studio_flow_test.dart`

- [ ] Add a failing pure/widget test describing review Next changing the existing route into a keyed `studio-post-details` stage rather than pushing `CreatePostScreen`.

```dart
testWidgets('review Next stays in Camera Studio and opens full-screen details',
    (tester) async {
  await tester.pumpWidget(_studioHarness());
  await tester.tap(find.byKey(const Key('studio-review-next')));
  await tester.pumpAndSettle();

  expect(find.byKey(const Key('studio-post-details')), findsOneWidget);
  expect(find.text('Complete Post'), findsNothing);
});
```

- [ ] Run `flutter test test/camera_studio_flow_test.dart` and confirm the test fails because the current code pushes a second `CreatePostScreen` route.
- [ ] Add `_StudioStage { capture, review, details }`, selected `XFile`, video flag, and selected filter to `_CameraStudioScreenState`. Make capture/gallery set review state; make review Next set details state. Remove `_handoffToComposer` and the `CreatePostScreen` import.
- [ ] Give the review Next control `Key('studio-review-next')`, render review/details in the Camera Studio scaffold, and handle Back from details by returning to review without clearing media/filter state.
- [ ] Run `flutter test test/camera_studio_flow_test.dart` and confirm it passes.
- [ ] Commit the focused route-state change.

### Task 2: Build the full-screen media-first post-details surface

**Files:**
- Create: `native/flutter/lib/src/features/create/camera_studio/studio_post_details.dart`
- Modify: `native/flutter/lib/src/features/create/camera_studio/camera_studio_screen.dart`
- Test: `native/flutter/test/studio_post_details_test.dart`

- [ ] Add a failing widget test that expects a full-screen media preview, caption field, Filter control for an image, privacy selector, Back action, and Post action.

```dart
expect(find.byKey(const Key('studio-post-details')), findsOneWidget);
expect(find.byKey(const Key('studio-post-media-preview')), findsOneWidget);
expect(find.byKey(const Key('studio-post-caption')), findsOneWidget);
expect(find.byKey(const Key('studio-post-filter')), findsOneWidget);
expect(find.byKey(const Key('studio-post-privacy')), findsOneWidget);
expect(find.byKey(const Key('studio-post-submit')), findsOneWidget);
```

- [ ] Run `flutter test test/studio_post_details_test.dart` and confirm the missing component makes the test fail.
- [ ] Implement `StudioPostDetails` as a presentational full-screen stack. It accepts `XFile`, `isVideo`, `StudioFilter`, caption, `PostPrivacy`, busy/error state, and callbacks. Render an `Image.file` with the selected image filter or a real `VideoPlayer`-based preview state for video. Use a keyboard-aware bottom overlay for caption/privacy and keep the preview behind it at full available height.
- [ ] Reuse `StudioFilterTray`, `kStudioFilters`, and `PrivacySelector`; expose stable keys from the test. Hide image-only filtering for videos. Disable Post during submission and show upload/error feedback in the same details stage.
- [ ] Run `flutter test test/studio_post_details_test.dart` and confirm it passes.
- [ ] Commit the presentational full-screen details component and its tests.

### Task 3: Reuse the upload queue from Camera Studio details

**Files:**
- Modify: `native/flutter/lib/src/features/create/camera_studio/camera_studio_screen.dart`
- Test: `native/flutter/test/camera_studio_publish_test.dart`

- [ ] Add a failing test for a successful details submission returning one `CreatePublished('post-1')`, and a failed submission retaining `studio-post-details`, caption, and filter state.

```dart
expect(await navigatorResult, isA<CreatePublished>());
expect((navigatorResult as CreatePublished).postId, 'post-1');

expect(find.byKey(const Key('studio-post-details')), findsOneWidget);
expect(find.text('Keep this caption'), findsOneWidget);
```

- [ ] Run `flutter test test/camera_studio_publish_test.dart` and confirm it fails before Camera Studio owns publishing.
- [ ] In `CameraStudioScreen`, create one post draft from selected media, caption, privacy, and filter. Enqueue it, process the queue, and only pop `CreatePublished(postId)` when `publishedPostIds` contains a confirmed ID. Do not invoke `onPostUploaded` on that success path because FeedShell handles the returned outcome.
- [ ] Preserve details state on an upload failure and show the queue summary/error. Guard against repeat submit while busy. Keep offline behavior explicit with the current offline notice.
- [ ] Run `flutter test test/camera_studio_publish_test.dart` and confirm it passes.
- [ ] Commit the Camera Studio publish handoff.

### Task 4: Harden Feed focus after a successful post

**Files:**
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/test/create_publish_navigation_test.dart`

- [ ] Add a failing test that publishes a photo/video outcome through the shell placement contract and asserts the success banner is present after focusing the normalized tab/page.

```dart
final placement = locatePublishedPost(items, 'created');
expect(placement.found, isTrue);
expect(placement.tabIndex, 1);
expect(placement.pageIndex, 0);
```

- [ ] Run `flutter test test/create_publish_navigation_test.dart` and confirm the new assertion fails if the handoff can leave the stale Create transition active.
- [ ] Ensure `CreatePublished` is the single authority in `_openSelectedCreateMethod`: refresh, select Feed index zero, set the target ID, and let `FeedScreen._focusPublishedPost` set the visible page and `Post published.` notice. Do not open search or invoke competing upload callbacks.
- [ ] Run `flutter test test/create_publish_navigation_test.dart` and confirm it passes.
- [ ] Commit the Feed success-handoff hardening.

### Task 5: Integrated verification and Android smoke test

**Files:**
- All changed files.

- [ ] Format all changed Dart files with `dart format`.
- [ ] Run focused analysis:

```bash
dart analyze \
  lib/src/features/create/camera_studio/camera_studio_screen.dart \
  lib/src/features/create/camera_studio/camera_studio_review.dart \
  lib/src/features/create/camera_studio/studio_post_details.dart \
  lib/src/features/feed/feed_shell.dart \
  test/camera_studio_flow_test.dart \
  test/studio_post_details_test.dart \
  test/camera_studio_publish_test.dart \
  test/create_publish_navigation_test.dart
```

- [ ] Run focused regression tests, then `flutter test` from `native/flutter`.
- [ ] Run `git diff --check`, inspect `git status --short`, and review the final diff before committing any remaining changes.
- [ ] Build the live-configured signed release APK with the existing `FEEDIN_SUPABASE_URL` and `FEEDIN_SUPABASE_PUBLISHABLE_KEY` dart defines.
- [ ] When a device is attached, install the exact APK, foreground `com.feedin.app`, and verify gallery photo, gallery video, camera photo, filters/caption, successful Feed focus/banner, and failed-upload state separately.
- [ ] Commit and push only after automated and available device checks are recorded.
