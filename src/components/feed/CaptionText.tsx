import { useNavigate } from 'react-router-dom';
import { formatTextWithHashtagsAndMentions } from '@/lib/text-formatting-utils';

interface CaptionTextProps {
  text: string;
  maxLength?: number;
  showMore?: boolean;
  onToggleMore?: () => void;
}

export default function CaptionText({ text, maxLength = 150, showMore = false, onToggleMore }: CaptionTextProps) {
  const navigate = useNavigate();
  const shouldTruncate = text.length > maxLength;
  const displayText = showMore || !shouldTruncate ? text : text.slice(0, maxLength);
  const formattedParts = formatTextWithHashtagsAndMentions(displayText);

  return (
    <p className="text-sm leading-relaxed">
      {formattedParts.map((part: any) => {
        if (part.type === 'hashtag') {
          return (
            <span
              key={part.key}
              className="text-primary cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/feed/hashtag/${encodeURIComponent(part.searchTerm.replace('#', ''))}`);
              }}
            >
              {part.text}
            </span>
          );
        }
        if (part.type === 'mention') {
          return (
            <span
              key={part.key}
              className="text-primary cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${part.username}`);
              }}
            >
              {part.text}
            </span>
          );
        }
        return <span key={part.key}>{part.text}</span>;
      })}
      {shouldTruncate && onToggleMore && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleMore();
          }} 
          className="text-primary ml-1 font-medium"
        >
          {showMore ? 'show less' : '... more'}
        </button>
      )}
    </p>
  );
}
