/**
 * Sanitizes search query input to prevent DoS attacks via ILIKE pattern abuse
 * - Limits length to prevent expensive queries
 * - Escapes special ILIKE pattern characters (%, _, \)
 */
export const sanitizeSearchQuery = (query: string, maxLength: number = 100): string => {
  if (!query) return '';
  
  // Trim whitespace and limit length
  const trimmed = query.trim().substring(0, maxLength);
  
  // Escape special ILIKE pattern characters: %, _, \
  // These characters have special meaning in PostgreSQL LIKE/ILIKE patterns
  return trimmed.replace(/[%_\\]/g, '\\$&');
};

/**
 * Validates if a search query meets minimum requirements
 */
export const isValidSearchQuery = (query: string, minLength: number = 1): boolean => {
  return query.trim().length >= minLength;
};
