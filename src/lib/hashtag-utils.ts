/**
 * Extract hashtags from text content
 * @param text - The text to extract hashtags from
 * @returns Array of hashtag strings (without # symbol)
 */
export const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) return [];
  
  // Remove # symbol and convert to lowercase
  return [...new Set(matches.map(tag => tag.slice(1).toLowerCase()))];
};

/**
 * Check if text contains hashtags
 * @param text - The text to check
 * @returns Boolean indicating if hashtags are present
 */
export const hasHashtags = (text: string): boolean => {
  if (!text) return false;
  return /#(\w+)/.test(text);
};
