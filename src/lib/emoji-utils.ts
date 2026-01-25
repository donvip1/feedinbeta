// Regex to match emoji characters (including compound emojis like flags, skin tones, ZWJ sequences)
const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji}\u200D\p{Emoji})+$/u;

// More comprehensive regex to extract all emojis from a string
const emojiExtractRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|[\u{1F1E0}-\u{1F1FF}]{2}|[\u{1F3FB}-\u{1F3FF}]|\p{Emoji}\u200D\p{Emoji}/gu;

/**
 * Check if a string contains only emojis (no other text)
 */
export function isEmojiOnly(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  // Remove all whitespace
  const trimmed = text.replace(/\s/g, '');
  if (trimmed.length === 0) return false;
  
  // Try the simple regex first
  if (emojiRegex.test(trimmed)) return true;
  
  // Fallback: extract all emojis and compare
  const emojis = trimmed.match(emojiExtractRegex);
  if (!emojis) return false;
  
  // Join all matched emojis and compare to original (minus whitespace)
  const joinedEmojis = emojis.join('');
  return joinedEmojis === trimmed;
}

/**
 * Count the number of emojis in a string
 */
export function countEmojis(text: string): number {
  if (!text) return 0;
  const matches = text.match(emojiExtractRegex);
  return matches ? matches.length : 0;
}

/**
 * Get the appropriate text size class for emoji-only messages
 * - 1 emoji: 4x larger (text-5xl)
 * - 2+ emojis: 2x larger (text-3xl)
 */
export function getEmojiSizeClass(text: string): string | null {
  if (!isEmojiOnly(text)) return null;
  
  const count = countEmojis(text);
  if (count === 1) {
    return 'text-5xl leading-tight'; // 4x larger
  }
  return 'text-3xl leading-tight'; // 2x larger for 2+
}
