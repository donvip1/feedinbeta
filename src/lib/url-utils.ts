/**
 * URL utilities for generating shareable links
 * 
 * This utility ensures links always use the canonical production URL,
 * even when accessed from preview/development environments.
 */

// The production domain - update this when you have a custom domain
const PRODUCTION_DOMAIN = 'feedinn.com';

/**
 * Checks if the current origin is a Lovable preview/development URL
 */
const isPreviewEnvironment = (): boolean => {
  const origin = window.location.origin;
  return (
    origin.includes('lovableproject.com') ||
    origin.includes('id-preview--') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
};

/**
 * Gets the canonical base URL for shareable links.
 * Uses production domain when on preview, otherwise uses current origin.
 * This ensures shared links always point to the published site.
 */
export const getShareableBaseUrl = (): string => {
  // If we're on a preview/dev environment, use the production domain
  if (isPreviewEnvironment()) {
    return `https://${PRODUCTION_DOMAIN}`;
  }
  
  // Otherwise use the current origin (works for custom domains)
  return window.location.origin;
};

/**
 * Generates a shareable URL for a specific path
 */
export const createShareableUrl = (path: string): string => {
  const baseUrl = getShareableBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * Generates shareable URLs for common resources.
 * All links use the canonical feedinn.com domain.
 */
export const shareUrls = {
  post: (postId: string) => createShareableUrl(`/feed/post/${postId}`),
  profile: (username: string) => createShareableUrl(`/profile/${username}`),
  groupJoin: (inviteCode: string) => createShareableUrl(`/groups/join/${inviteCode}`),
  group: (groupId: string) => createShareableUrl(`/groups/${groupId}`),
  liveStream: (streamId: string) => createShareableUrl(`/live/stream/${streamId}`),
  liveSpace: (spaceId: string) => createShareableUrl(`/live/space/${spaceId}`),
};
