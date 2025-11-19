import { useState } from 'react';

interface CaptionTextProps {
  content: string;
  hasMedia: boolean;
  className?: string;
}

export const CaptionText = ({ content, hasMedia, className = '' }: CaptionTextProps) => {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const shouldTruncate = hasMedia && content.length > 120;

  if (!shouldTruncate) {
    return <p className={`text-foreground whitespace-pre-wrap ${className}`}>{content}</p>;
  }

  return (
    <div className={`text-foreground whitespace-pre-wrap ${className}`}>
      {showFullCaption ? content : content.slice(0, 120) + '...'}
      {!showFullCaption && (
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
