import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface StoryCircleProps {
  user: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  hasViewed: boolean;
  isOwn: boolean;
  onClick: () => void;
}

export const StoryCircle = ({ user, hasViewed, isOwn, onClick }: StoryCircleProps) => {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2"
    >
      <div
        className={`w-16 h-16 rounded-full p-0.5 ${
          hasViewed
            ? 'bg-gray-700'
            : 'bg-gradient-to-r from-pink-500 to-blue-500'
        }`}
      >
        <div className="w-full h-full rounded-full bg-background p-0.5">
          <Avatar className="w-full h-full">
            <AvatarImage src={user.avatar_url || ''} />
            <AvatarFallback>{user.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <span className="text-xs text-muted-foreground max-w-[64px] truncate">
        {isOwn ? 'Your Story' : user.display_name || 'Unknown'}
      </span>
    </button>
  );
};
