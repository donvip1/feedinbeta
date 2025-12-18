/**
 * Generate a profile URL using username when available, falling back to user ID
 * This ensures shareable, human-readable profile links
 */
export const getProfileUrl = (username: string | null | undefined, userId?: string): string => {
  if (username) {
    return `/profile/${username}`;
  }
  if (userId) {
    return `/profile/${userId}`;
  }
  return '/profile';
};

/**
 * Generate a post URL
 */
export const getPostUrl = (postId: string): string => {
  return `/feed/post/${postId}`;
};

/**
 * Generate a story URL
 */
export const getStoryUrl = (storyId: string): string => {
  return `/story/${storyId}`;
};

/**
 * Generate a live stream URL
 */
export const getLiveStreamUrl = (streamId: string): string => {
  return `/live/stream/${streamId}`;
};
