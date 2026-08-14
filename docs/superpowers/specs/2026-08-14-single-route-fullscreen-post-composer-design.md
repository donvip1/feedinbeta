# Single-Route Full-Screen Post Composer Design

## Objective

Replace the current two-window native post flow with one continuous portrait
full-screen experience. After a user captures or selects media, every review,
filter, caption, privacy, and publishing step remains inside the same Camera
Studio route. Successful publication closes Create, opens the new post in Feed,
and shows a post-success notification.

This change is scoped to personal photo and video posts launched from the Feed
`+` action. Story creation and draft management retain their existing flows.

## Current Problem

`CameraStudioScreen` currently pushes `CameraStudioReview` after capture or
selection. Pressing Next then pushes a second route containing a scaffolded
`CreatePostScreen`. The second route repeats the creation experience and uses a
smaller composer media preview, so the interaction appears to contain two post
creation windows.

The publish result must then unwind multiple nested routes. That route depth
makes it possible for the user to remain on a Create surface even after the
upload service has confirmed a live post.

## Confirmed Experience

### One full-screen route

The Feed launches one `CameraStudioScreen` route. That route owns a small,
explicit stage state machine:

1. capture or gallery selection;
2. full-screen media review and filtering;
3. full-screen post details and publishing.

Next changes the stage inside the existing route. It never pushes a separate
`CreatePostScreen` or another "Complete Post" scaffold.

System back and the visible back control move from post details to media review.
From media review, Retake returns to capture when the camera was used, while a
source-first gallery flow can reopen selection or close safely.

### Full-screen post details

The selected photo or video remains the dominant portrait preview throughout
post details. The media is not moved into the compact carousel used by the
general-purpose Create screen.

Post details appear as modern social publishing controls over the media:

- a top bar with Back and Post;
- a bottom sheet or bottom overlay containing the caption field;
- the existing per-image Filter control and preset tray;
- privacy selection;
- add-more/remove/media paging controls when multiple items are supported;
- visible publishing progress and actionable error feedback.

The details overlay must respect the keyboard and safe areas without resizing
the media into a small preview card. It may expand for editing and collapse to
leave the media inspectable.

Videos must show their actual initialized preview/playback surface, not a
generic captured-video placeholder. Photos retain their selected filter during
the transition from review to details.

### Data and upload ownership

Camera Studio will reuse the existing draft repository, upload queue, and
upload service contracts. The new full-screen details stage owns only the
presentation and post-specific form state required for this route: media,
caption, privacy, filters, hashtags if retained, submission state, and errors.

The existing `CreatePostScreen` remains available for draft/upload management
and other entry points, but Camera Studio will no longer push it after Next.
Shared draft construction and upload-result handling should be extracted only
where needed to prevent the two screens from implementing different publishing
contracts.

### Publication handoff

There is one successful completion path:

1. the upload service returns a published post ID;
2. Camera Studio pops once with `CreatePublished(postId)`;
3. `FeedShell` refreshes the repository and selects the main Feed;
4. `FeedScreen` selects the post's normalized Video or Photos tab and pager
   index;
5. the new post is visible and a `Post published.` success notice appears.

No success callback may trigger a competing refresh or route transition. A
failed refresh must not reopen or reveal Create after the post has published;
Feed stays visible and presents retryable refresh feedback.

## Architecture

### Camera Studio state

Introduce a stage enum owned by `_CameraStudioScreenState`, with captured media
and selected filter held at the same level. Capture and gallery operations set
the media and transition to review. Review Next transitions to details. Details
Back transitions to review. Publish completion returns the route result.

The implementation should render stages within the existing full-screen
scaffold, using keyed stage roots so widget tests can assert that no nested
composer route is created.

### Full-screen details component

Create a focused presentational component for the media-first details stage.
It receives the current media preview, caption/privacy/filter state, submission
state, and callbacks. It does not access Supabase, repositories, or navigation.

The component should reuse existing filter presets and privacy values, but it
should not embed `PostComposerPanel`, whose compact scrollable layout is the
behavior being replaced for this entry point.

### Feed focus contract

Keep `CreatePublished(postId)` as the sole route result. The existing
`locatePublishedPost` helper remains responsible for normalized tab and page
placement. Feed focus must use the refreshed repository snapshot and must not
open a separate search-post route.

## Error Handling

- Cancelled gallery selection closes the initial source-first route cleanly.
- Failed media initialization shows an explicit full-screen error with Retake
  or Back available.
- Failed upload keeps the user in full-screen details with their caption,
  privacy, media, and filter state intact.
- Successful upload always exits Create even if the subsequent Feed refresh
  fails.
- Duplicate taps while publishing are ignored and the Post action shows a busy
  state.

## Verification

Automated tests will prove:

- review Next changes Camera Studio to a keyed full-screen details stage without
  pushing `CreatePostScreen`;
- the media preview remains full-screen while caption, filter, and privacy
  controls are available;
- details Back returns to review without losing the selected filter or caption;
- one successful upload returns exactly one `CreatePublished(postId)` result;
- Feed selects and displays the created photo or video post and shows the
  success notice;
- failed upload remains in details and preserves form state.

Focused analysis and tests must pass before the full Flutter suite. A
live-configured Android build must then be installed and smoke-tested through
gallery photo, gallery video, camera photo, publication, and post-focus flows.

## Acceptance Criteria

- The user never sees two post creation windows for one post.
- Capture/selection, review, details, and publishing remain portrait full-screen
  inside one route.
- The media remains the dominant preview through caption and filter editing.
- Publishing closes Create and opens the exact created post in Feed.
- A visible post-success notification appears over Feed.
- Upload failures do not discard the user's media or form state.
