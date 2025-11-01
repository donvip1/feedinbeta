import React from 'react';

export const TypingIndicator = () => {
  return (
    <div className="flex gap-2 items-center">
      <div className="flex gap-1 px-4 py-3 rounded-2xl bg-accent">
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};
