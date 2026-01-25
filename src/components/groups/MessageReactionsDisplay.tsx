import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Reaction {
  emoji: string;
  user_id: string;
  user: {
    display_name: string;
    avatar_url?: string | null;
  };
}

interface MessageReactionsDisplayProps {
  reactions: Reaction[];
  isOwn: boolean;
  onReact: (emoji: string) => void;
}

export const MessageReactionsDisplay = ({
  reactions,
  isOwn,
  onReact,
}: MessageReactionsDisplayProps) => {
  const navigate = useNavigate();
  const [openEmoji, setOpenEmoji] = useState<string | null>(null);

  // Group reactions by emoji
  const reactionGroups = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  if (Object.keys(reactionGroups).length === 0) return null;

  return (
    <div className={cn(
      "flex gap-1 mt-1 flex-wrap",
      isOwn ? 'justify-end' : 'justify-start'
    )}>
      {Object.entries(reactionGroups).map(([emoji, emojiReactions]) => (
        <Popover 
          key={emoji} 
          open={openEmoji === emoji} 
          onOpenChange={(open) => setOpenEmoji(open ? emoji : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-background/90 backdrop-blur-sm border border-border rounded-full text-xs hover:scale-110 hover:border-primary/30 transition-all shadow-sm group"
            >
              <span>{emoji}</span>
              {/* Show up to 3 avatars inline */}
              <div className="flex -space-x-1.5 ml-0.5">
                {emojiReactions.slice(0, 3).map((reaction, i) => (
                  <Avatar 
                    key={reaction.user_id + i} 
                    className="w-4 h-4 border border-background"
                  >
                    <AvatarImage src={reaction.user.avatar_url || ''} />
                    <AvatarFallback className="text-[6px] bg-muted">
                      {reaction.user.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {emojiReactions.length > 3 && (
                <span className="text-muted-foreground font-medium ml-0.5">
                  +{emojiReactions.length - 3}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 p-2 bg-background border-border rounded-xl"
            side={isOwn ? "left" : "right"}
            align="start"
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
              <span className="text-xl">{emoji}</span>
              <span className="text-sm text-muted-foreground">
                {emojiReactions.length} {emojiReactions.length === 1 ? 'reaction' : 'reactions'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {emojiReactions.map((reaction, i) => (
                <button
                  key={reaction.user_id + i}
                  onClick={() => {
                    setOpenEmoji(null);
                    navigate(`/profile/${reaction.user_id}`);
                  }}
                  className="flex items-center gap-2 w-full p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={reaction.user.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-muted">
                      {reaction.user.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate flex-1 text-left">
                    {reaction.user.display_name || 'User'}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                onReact(emoji);
                setOpenEmoji(null);
              }}
              className="w-full mt-2 pt-2 border-t border-border text-xs text-primary hover:underline"
            >
              Add {emoji} reaction
            </button>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
};
