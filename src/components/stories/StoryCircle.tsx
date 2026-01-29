import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UnreadBadge } from '@/components/shared/UnreadBadge';
import { cn } from '@/lib/utils';

interface StoryCircleProps {
  user: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  hasViewed: boolean;
  isOwn: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export const StoryCircle = ({ user, hasViewed, isOwn, onClick, unreadCount = 0 }: StoryCircleProps) => {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2 group"
    >
      <div className="relative">
        <div
          className={cn(
            "w-16 h-16 rounded-full p-0.5 transition-all duration-300",
            hasViewed
              ? 'bg-muted-foreground/40'
              : 'bg-gradient-to-tr from-pink-500 via-rose-500 to-orange-400 shadow-pink'
          )}
        >
          <div className="w-full h-full rounded-full bg-background p-0.5">
            <Avatar className="w-full h-full">
              <AvatarImage src={user.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-500 text-white">
                {user.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <UnreadBadge count={unreadCount} size="sm" />
      </div>
      <span className="text-xs text-muted-foreground max-w-[64px] truncate group-hover:text-foreground transition-colors">
        {isOwn ? 'Your Story' : user.display_name || 'Unknown'}
      </span>
    </button>
  );
};
