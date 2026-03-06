

## The Problem

On Android mobile (Chrome or PWA), `getDisplayMedia()` is technically available but the system screen picker UI **does show up** — Android Chrome has supported screen sharing since Chrome 72+. The issue is likely that:

1. The screen share **starts** but the video appears **blank/black** to the user — this is a known Android Chrome behavior where the returned stream is valid but the local preview doesn't render properly in certain contexts.
2. In PWA standalone mode, `getDisplayMedia` may exist as a function but fail silently or return a blank stream.

The real fix is **not about the picker** (Android handles that natively) — it's about detecting blank streams and handling the PWA standalone limitation properly.

## Root Cause

- On **mobile Chrome browser**: `getDisplayMedia` works and shows the native Android picker. If users see a blank screen, it's likely a preview rendering issue.
- On **PWA/homescreen app** (standalone mode): `getDisplayMedia` may exist but returns a blank/unusable stream because standalone WebViews restrict it. The function doesn't throw — it just gives empty video.

## Fix — 3 Files

### 1. Add PWA standalone detection + blank stream validation

In all screen share entry points (`TwitterSpaceRoom.tsx`, `LiveSpaceRoom.tsx`, `ScreenShareButton.tsx`, `CoHostPanel.tsx`, `LiveKitBroadcaster.tsx`):

- **Detect standalone/PWA mode** using `window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone`. If in standalone mode, show a clear message: *"Screen sharing requires a full browser. Please open feedinn.com in Chrome instead of the installed app."* and return early.
- **Validate the stream after capture**: After `getDisplayMedia` returns, check if the video track's settings report 0x0 dimensions or if the track is muted/ended — signs of a blank stream. If detected, stop the stream and show an error.

### 2. Specific changes per file

**`src/components/live/twitter-space/TwitterSpaceRoom.tsx`** (line ~943):
- Add standalone detection before the `getDisplayMedia` call
- Add stream validation after successful capture

**`src/components/live/LiveSpaceRoom.tsx`** (line ~1019):
- Same standalone detection + stream validation

**`src/components/live/ScreenShareButton.tsx`** (line ~37):
- Same pattern

**`src/components/live/CoHostPanel.tsx`** (line ~208):
- Same pattern

**`src/components/live/LiveKitBroadcaster.tsx`** (line ~338):
- Same pattern

### 3. Shared helper utility

Create a small helper in `src/lib/screen-share-utils.ts`:

```typescript
export function isStandalonePWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches 
    || (navigator as any).standalone === true;
}

export function isStreamBlank(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState === 'ended' || track.muted) return true;
  const settings = track.getSettings();
  if (settings.width === 0 || settings.height === 0) return true;
  return false;
}
```

Then import and use in all 5 files:
- Before capture: `if (isStandalonePWA()) { toast.error('Screen sharing requires opening feedinn.com in Chrome browser, not the installed app.'); return; }`
- After capture: `if (isStreamBlank(stream)) { stream.getTracks().forEach(t => t.stop()); toast.error('Screen capture returned a blank stream. Try using Chrome browser directly.'); return; }`

