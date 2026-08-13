# Feed Media and Engagement Regression Repair Design

## Objective

Repair six regressions in the native Flutter Feed experience:

1. A selected video must show visible loading feedback and then a usable preview instead of a blank composer page.
2. Every selected image in a multi-image post must retain an independently editable filter.
3. A successful post publication must close Create, return to Feed, refresh the feed, and surface the new post.
4. Posts containing video must not appear in the Photos feed section.
5. Tapping a feed photo must open a full-screen viewer with pinch zoom, pan, image-to-image swiping, a page indicator, and close/back controls.
6. Replies must contribute to the post's total comment count.

This repair is scoped to the active native Flutter application under `native/flutter`. It does not redesign the composer, introduce video filters, or change unrelated feed ranking behavior.

## Current Root Causes

### Video selection preview

`ComposerMediaCarousel` initializes a file-backed `VideoPlayerController` asynchronously. Until initialization completes, the tile falls through to a generic media fallback without an explicit loading state. On devices where initialization is slow, this reads as an empty or blank page.

### Multi-image filters

The composer stores one optional `initialMediaFilterId` on `CreatePostScreen` and persists one `media_filter_id` for the complete draft/post. `ComposerMediaItem` does not own a filter selection, so the UI cannot preserve a different filter while the user moves between selected images. The canonical Filter control currently belongs to the single-item Camera Studio review surface.

### Successful publication navigation

`CreatePostScreen` can return `CreatePublished(postId)`, but the surrounding Feed flow does not consistently use that outcome to refresh, return to the correct Feed tab, and focus the new item. Publication callbacks and route completion currently overlap, which makes the visible result dependent on which callback completes first.

### Photo/video section classification

Feed filtering combines legacy singular media fields with multi-media fields. The current classification is not strict enough for posts whose media arrays contain video, allowing a post with video to qualify for Photos.

### Feed photo interaction

`PhotoCarousel` supports horizontal paging but does not open a dedicated viewer. `MediaLayer` forwards broad surface taps for chrome behavior, so photo taps have no zoom-specific destination.

### Comment totals

The database trigger counts every inserted `post_comments` row, including replies. The comment sheet, however, replaces the post total with `_rootComments.length` whenever roots are loaded. This makes the displayed count exclude replies even when both the fetched list and server total include them.

## Design

### 1. Explicit video-preview state

The composer video tile will represent three states:

- loading: a dark media surface with a centered progress indicator and a video glyph;
- ready: the initialized first frame with the existing play overlay;
- failed: the existing error/fallback surface with a clear unavailable-preview label.

The controller lifecycle remains local to the video tile. Source changes dispose and recreate the controller. Every asynchronous completion must verify that the widget is mounted and that the completed controller is still the active controller.

### 2. Per-image filter ownership

Each `ComposerMediaItem` will own an optional `filterId`. Image items default to the original/no-filter preset; video items expose no filter control. Filter state will be updated by media item ID so reordering and removal cannot attach a filter to the wrong image.

The selected carousel page controls the visible filter editor. When the active item is an image, the Filter button remains available regardless of how many media items are selected. Opening it displays the existing Studio filter presets and updates only that item. When the active item is a video, the Filter button is hidden or disabled with no mutation to image filters.

Draft and publication models will preserve an ordered filter list aligned with `mediaPaths` and `mediaTypes`. The first-image legacy `media_filter_id` remains populated where needed for backward-compatible rendering, while the ordered per-item representation becomes authoritative for multi-image posts. Serialization must tolerate old drafts/posts that lack the new list by treating every missing entry as original/no filter.

The remote post mapper and Feed media renderer will apply the filter corresponding to the displayed image index. Video entries will never receive an image color filter.

### 3. Deterministic post-publication handoff

`CreatePostScreen` will have one success path:

1. The upload service confirms a published post ID.
2. The screen sends the existing publication notification once.
3. The route pops with `CreatePublished(postId)`.

`FeedShell` will treat `CreatePublished` as the navigation authority. It will select the main Feed surface, refresh/reconcile repository data, locate the returned post ID, and move the pager to that post when it is present. If the refreshed page does not yet contain the new post, Feed remains at its normal starting item and displays a success acknowledgement; the user is never left in Create after confirmed publication.

Queued, failed, or offline publication is not treated as successful. Those states retain the current draft/upload feedback and do not falsely navigate as though the post is live.

### 4. Strict media-section classification

Introduce a single normalized media-kind helper used by Feed tabs and related tests. It will inspect paired `mediaUrls`/`mediaTypes` first and fall back to singular `mediaUrl`/`mediaType` for legacy posts.

Classification rules:

- photo-only: contains at least one image and contains no video;
- video: contains at least one video, including mixed image/video posts;
- text/other: contains neither image nor video.

The Photos section accepts only photo-only posts. The Reels/Video section accepts video posts. Sponsored/non-organic cards retain their existing explicit placement policy and are not reclassified by accidental missing media metadata.

### 5. Full-screen post photo viewer

Add a focused feed photo viewer separate from profile-avatar viewing. It accepts resolved image URLs and an initial index, and presents a full-screen dark route containing:

- a horizontal `PageView` for all images in the post;
- one `InteractiveViewer` per page for pinch zoom and pan;
- current/total page indication;
- close button and system back support;
- safe loading and broken-image states.

`PhotoCarousel` will expose a photo-tap callback with the tapped index. `MediaLayer` will route that callback to the viewer while preserving horizontal carousel swipes. The surrounding immersive card's single-tap chrome behavior must not also fire when the photo viewer consumes the tap. Video taps retain their current play/pause behavior and never open the photo viewer.

Only image entries are passed into the viewer. For a mixed-media post encountered outside the Photos tab, viewer indexing is calculated against the filtered image list rather than the raw media list.

### 6. Reply-inclusive comment totals

Loaded comment totals will use `_comments.length`, not `_rootComments.length`. This includes roots, replies, and deeper descendants already supported by the threaded model.

Submitting either a root comment or reply adds one loaded comment and increments the Feed post controller once. Deleting a comment removes that comment and all loaded descendants, and decrements the Feed post count by the exact number removed. The counter remains clamped at zero.

The existing threaded-comments database trigger will remain unchanged if verification confirms it increments `posts.comments_count` for every inserted row and decrements it for every deleted row. A new migration is warranted only if current deployed schema evidence contradicts the checked-in migration.

## Data and Compatibility

- Existing posts and drafts without per-media filters continue to render as original/unfiltered.
- Existing singular `media_filter_id`, `media_url`, and `media_type` fields remain readable.
- Ordered media arrays must stay index-aligned. Normalization will safely handle missing, short, or unknown media-type/filter arrays.
- No local file path or upload credential is logged or added to source control.
- Feed ranking and ad injection remain unchanged; only tab classification and post-refresh placement are touched.

## Error Handling

- Slow video initialization shows progress rather than blank content.
- Failed video initialization shows an explicit fallback and still allows removal or proceeding with the post.
- Failed feed refresh after publication does not reopen Create; it shows publication success plus a refresh error/retry affordance.
- Failed photo loading shows the existing dark broken-image treatment without crashing the viewer.
- Comment mutations retain existing optimistic rollback behavior. Count changes must roll back when the repository rejects creation or deletion.

## Verification Strategy

### Automated regression tests

- Composer video preview renders a loading indicator before initialization and a failure state when initialization fails.
- Multi-item composer keeps Filter available on every image page and stores independent filter IDs through reorder/removal.
- Draft/post serialization round-trips ordered per-media filters and safely reads legacy data.
- A confirmed publish returns `CreatePublished`, and FeedShell switches to Feed and refreshes/focuses the new post.
- Media classification excludes video and mixed-media posts from Photos.
- Photo tap opens the viewer at the correct index; viewer supports multiple pages and contains `InteractiveViewer` zoom surfaces.
- Comment sheet count includes roots plus replies; adding a reply increments by one; deleting a thread decrements by the number of removed nodes.

### Source and suite verification

- Format every changed Dart file.
- Run focused `dart analyze` on changed source and tests.
- Run the focused Flutter tests for composer, feed, viewer, navigation, and comments.
- Run the broader native Flutter test suite if focused verification passes.
- Run `git diff --check` before completion.

### Device smoke test

On a live-configured Android build:

1. Select a video and confirm immediate visible loading followed by a frame or explicit failure state.
2. Select at least three photos, set distinct filters, move between them, and confirm each filter persists.
3. Publish and confirm Create closes, Feed refreshes, and the new post is surfaced.
4. Confirm the video post is absent from Photos and present in Video/Reels.
5. Open a multi-photo post, pinch zoom, pan, swipe between photos, and close/back successfully.
6. Add a reply and confirm both the sheet total and post action-rail total increase; delete a thread and confirm the correct total decrease.

## Acceptance Criteria

The repair is complete only when all six reported behaviors pass their focused automated tests and live device smoke checks, with no unrelated working-tree changes bundled into the implementation.
