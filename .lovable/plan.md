

## Issues Found

### 1. Hashtag Input Bug
The `onChange` handler on line 253 of `CreateSpaceModal.tsx` strips all whitespace: `.replace(/\s/g, '')`. This prevents the space key from ever reaching the `onKeyDown` handler because the space character is removed before `handleHashtagKeyDown` fires. On mobile keyboards, the `keyDown` event for space may not fire reliably either. The same issue exists in `CreateLiveStreamModal.tsx` (line 337).

**Fix:** Remove the `.replace(/\s/g, '')` from `onChange`. Instead, handle space-triggered tag creation inside `onChange` itself (detect if input ends with a space, extract the tag, add it). This works reliably on both desktop and mobile virtual keyboards.

### 2. Screen Share on PWA/Homescreen APK
`getDisplayMedia` is not available in Android WebView or standalone PWA mode (homescreen apps). The `TwitterSpaceRoom.tsx` screen share code (line 944) calls `getDisplayMedia` directly without checking availability first, causing the "not a function" error.

**Fix:** Add the same availability check used in `LiveSpaceRoom.tsx` (line 1021) to `TwitterSpaceRoom.tsx`. When unavailable, show a user-friendly message: "Screen sharing is not available in the app. Please open feedinn.com in Chrome to use this feature." Also add the `getUserMedia` fallback from `ScreenShareButton.tsx` as a secondary attempt.

### Files to Modify

1. **`src/components/live/CreateSpaceModal.tsx`** — Fix `onChange` to handle space/comma as tag separators directly, remove `replace(/\s/g, '')`
2. **`src/components/live/CreateLiveStreamModal.tsx`** — Same hashtag fix for consistency
3. **`src/components/live/twitter-space/TwitterSpaceRoom.tsx`** — Add `getDisplayMedia` availability check before calling it, with fallback and clear error message

