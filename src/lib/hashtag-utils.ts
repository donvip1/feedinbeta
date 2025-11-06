export const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex);
  if (matches) {
    return matches.map(match => match.substring(1)); // Remove the #
  }
  return [];
};