import { Mic, Users, Lock, Clock, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SpaceCardProps {
  space: {
    id: string;
    title: string;
    description?: string;
    status: 'scheduled' | 'live' | 'ended';
    topic_category?: string;
    viewer_count: number;
    is_private: boolean;
    scheduled_start?: string;
    started_at?: string;
    ended_at?: string;
    user_id: string;
    profiles?: {
      display_name: string;
      username: string;
      avatar_url: string;
    };
  };
  speakers?: {
    profile?: {
      avatar_url: string;
    };
  }[];
  onClick: () => void;
  isOwner?: boolean;
}

export const SpaceCard = ({ space, speakers = [], onClick, isOwner }: SpaceCardProps) => {
  const isLive = space.status === 'live';
  const isEnded = space.status === 'ended';
  const isScheduled = space.status === 'scheduled';

  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border p-4 cursor-pointer transition-all hover:scale-[1.02]",
        isLive 
          ? "bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border-primary/30" 
          : isEnded 
          ? "bg-muted/50 border-border"
          : "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30"
      )}
    >
      {/* Status badge */}
      <div className="absolute -top-2 right-4">
        {isLive && (
          <Badge className="bg-red-500 text-white animate-pulse gap-1">
            <span className="w-2 h-2 bg-white rounded-full" />
            LIVE
          </Badge>
        )}
        {isScheduled && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Scheduled
          </Badge>
        )}
        {isEnded && (
          <Badge variant="outline" className="gap-1">
            <Play className="w-3 h-3" />
            Replay
          </Badge>
        )}
      </div>

      {/* Private indicator */}
      {space.is_private && (
        <div className="absolute -top-2 left-4">
          <Badge variant="outline" className="gap-1 bg-background">
            <Lock className="w-3 h-3" />
            Private
          </Badge>
        </div>
      )}

      {/* Content */}
      <div className="pt-2">
        {/* Host info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="w-8 h-8 ring-2 ring-primary/50">
            <AvatarImage src={space.profiles?.avatar_url || ''} />
            <AvatarFallback>{space.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{space.profiles?.display_name}</p>
            <p className="text-xs text-muted-foreground">@{space.profiles?.username}</p>
          </div>
          {isOwner && (
            <Badge variant="secondary" className="text-xs">Your Space</Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold mb-2 line-clamp-2">{space.title}</h3>

        {/* Category */}
        {space.topic_category && (
          <Badge variant="outline" className="mb-3 text-xs">
            {space.topic_category}
          </Badge>
        )}

        {/* Speakers preview */}
        {speakers.length > 0 && isLive && (
          <div className="flex items-center gap-1 mb-3">
            <div className="flex -space-x-2">
              {speakers.slice(0, 4).map((speaker, i) => (
                <Avatar key={i} className="w-6 h-6 border-2 border-background">
                  <AvatarImage src={speaker.profile?.avatar_url || ''} />
                  <AvatarFallback className="text-[10px]">S</AvatarFallback>
                </Avatar>
              ))}
            </div>
            {speakers.length > 4 && (
              <span className="text-xs text-muted-foreground">+{speakers.length - 4}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {space.viewer_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              Space
            </span>
          </div>

          {isScheduled && space.scheduled_start && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(space.scheduled_start), { addSuffix: true })}
            </span>
          )}

          {isEnded && space.ended_at && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Join button for live spaces */}
        {isLive && (
          <Button className="w-full mt-3 bg-primary hover:bg-primary/90">
            Join Space
          </Button>
        )}

        {isEnded && (
          <Button variant="outline" className="w-full mt-3">
            Listen to Replay
          </Button>
        )}
      </div>
    </div>
  );
};
