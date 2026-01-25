import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarButtonProps {
  isStarred: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const StarButton: React.FC<StarButtonProps> = ({
  isStarred,
  onToggle,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'p-1 rounded-full transition-colors',
        isStarred
          ? 'text-yellow-500 hover:text-yellow-600'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      title={isStarred ? 'Unstar message' : 'Star message'}
    >
      <Star
        className={cn(
          sizeClasses[size],
          isStarred && 'fill-current'
        )}
      />
    </button>
  );
};
