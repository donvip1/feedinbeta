/**
 * Utility functions for screen sharing compatibility detection
 */

/**
 * Detects if the app is running in standalone PWA/homescreen mode
 * where getDisplayMedia may be restricted or return blank streams.
 */
export function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/**
 * Validates that a captured screen share stream is not blank.
 * On some Android WebViews/PWAs, getDisplayMedia returns a valid stream
 * but with 0x0 dimensions or immediately muted/ended tracks.
 */
export function isStreamBlank(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState === 'ended' || track.muted) return true;
  const settings = track.getSettings();
  if (settings.width === 0 || settings.height === 0) return true;
  return false;
}

/** Standard error message for PWA users */
export const SCREEN_SHARE_PWA_ERROR =
  'Screen sharing requires opening feedinn.com in Chrome browser, not the installed app.';

/** Standard error message for blank streams */
export const SCREEN_SHARE_BLANK_ERROR =
  'Screen capture returned a blank stream. Try using Chrome browser directly.';
