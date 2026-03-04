

## Plan: Add Cover Image to Chat & Fix Install Banner

### Issue 1: Cover Image Missing in Live Space Chat

The chat sidebar in `TwitterSpaceRoom.tsx` (lines 1570-1606) shows space info (host name, title, listener count) but does **not** display the space's cover image. The `space?.cover_image_url` data is already available in the component.

**Fix**: Insert the cover image between the "Space Info" header and the replies feed in the chat sidebar (around line 1592). If a cover image exists, render it as a banner with a gradient overlay, similar to what `SpaceChat.tsx` already does. If no cover image, keep the current text-only layout.

**Location**: `src/components/live/twitter-space/TwitterSpaceRoom.tsx`, lines ~1591-1606

Changes:
- Add cover image display above the space info text block
- Use the same gradient overlay style (`bg-gradient-to-t from-zinc-900`)
- Show title and live badge overlaid on the image

### Issue 2: Install App Prompt Not Showing

The `BrowserInstallBanner` component is rendered in `App.tsx` but uses `sessionStorage` to track dismissal — meaning it only hides for the current session. However, `InstallAppPrompt` uses `localStorage` with a 24-hour cooldown. Both check for Capacitor/standalone mode correctly.

The likely issue is that users on browsers that don't fire `beforeinstallprompt` (especially iOS Safari, some Android browsers) may never see the banner because the fallback timer only triggers for mobile Android user agents.

**Fix**: 
- In `BrowserInstallBanner.tsx`, extend the fallback to also show on desktop browsers after a delay, not just mobile Android
- Ensure the banner appears more reliably by also showing it on iOS (it already does, but the 2-second timer may be too short for slow connections)

### Files to Modify

1. **`src/components/live/twitter-space/TwitterSpaceRoom.tsx`** — Add cover image banner to chat sidebar
2. **`src/components/pwa/BrowserInstallBanner.tsx`** — Improve fallback logic so the install prompt appears more reliably for all users

