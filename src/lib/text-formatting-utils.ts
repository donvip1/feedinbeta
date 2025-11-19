export const formatTextWithHashtagsAndMentions = (text: string) => {
  // Split text by spaces to process each word
  const words = text.split(/(\s+)/);
  
  return words.map((word, index) => {
    // Check if word is a hashtag
    if (word.startsWith('#') && word.length > 1) {
      return {
        type: 'hashtag',
        text: word,
        searchTerm: word.slice(1),
        key: `hashtag-${index}`
      };
    }
    
    // Check if word is a mention
    if (word.startsWith('@') && word.length > 1) {
      return {
        type: 'mention',
        text: word,
        username: word.slice(1),
        key: `mention-${index}`
      };
    }
    
    // Regular text
    return {
      type: 'text',
      text: word,
      key: `text-${index}`
    };
  });
};

export const extractHashtags = (text: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.slice(1)) : [];
};

export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(mention => mention.slice(1)) : [];
};
