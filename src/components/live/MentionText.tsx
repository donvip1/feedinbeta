import React from 'react';

interface MentionTextProps {
  text: string;
  className?: string;
  onMentionClick?: (username: string) => void;
}

/**
 * Renders text with @mentions highlighted in blue (Twitter/X style).
 */
export const MentionText: React.FC<MentionTextProps> = ({ text, className = '', onMentionClick }) => {
  const parts = text.split(/(@\w+)/g);

  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span
            key={i}
            className="text-blue-400 font-medium cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick?.(part.slice(1));
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
};
