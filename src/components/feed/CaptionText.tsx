import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTextWithHashtagsAndMentions } from '@/lib/text-formatting-utils';

interface CaptionTextProps {
  content: string;
  hasMedia: boolean;
  className?: string;
}

export const CaptionText = ({ content, hasMedia, className = '' }: CaptionTextProps) => {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const navigate = useNavigate();
  const shouldTruncate = hasMedia && content.length > 120;

  const displayText = shouldTruncate && !showFullCaption 
    ? content.slice(0, 120) + '...' 
    : content;

  const formattedParts = formatTextWithHashtagsAndMentions(displayText);

  const handleHashtagClick = (searchTerm: string) => {
    navigate(`/feed?search=${encodeURIComponent(searchTerm)}`);
  };

  const handleMentionClick = (username: string) => {
    // TODO: Navigate to user profile when implemented
    console.log('Navigate to user:', username);
  };

  return (
    <div className={`text-foreground break-words ${className}`}>
      {formattedParts.map((part) => {
        if (part.type === 'hashtag') {
          return (
            <button
              key={part.key}
              onClick={() => handleHashtagClick(part.searchTerm!)}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {part.text}
            </button>
          );
        }
        
        if (part.type === 'mention') {
          return (
            <button
              key={part.key}
              onClick={() => handleMentionClick(part.username!)}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {part.text}
            </button>
          );
        }
        
        return <span key={part.key}>{part.text}</span>;
      })}
      {shouldTruncate && !showFullCaption && (
        <button 
          onClick={() => setShowFullCaption(true)}
          className="ml-1 text-pink-500 font-medium hover:text-pink-600 transition-colors"
        >
          more
        </button>
      )}
    </div>
  );
};
