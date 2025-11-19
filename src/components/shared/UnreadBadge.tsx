import React from 'react';
import { cn } from '@/lib/utils';

interface UnreadBadgeProps {
  count: number;
  className?: string;
  size?: 'sm' | 'md';
}

export const UnreadBadge = ({ count, className, size = 'md' }: UnreadBadgeProps) => {
  if (count === 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <div
      className={cn(
        'absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center font-bold',
        size === 'sm' ? 'min-w-[16px] h-4 text-[10px] px-1' : 'min-w-[20px] h-5 text-xs px-1.5',
        className
      )}
    >
      {displayCount}
    </div>
  );
};
