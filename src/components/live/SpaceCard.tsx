import { Mic, Users, Lock, Clock, Play, Sparkles, Gift, Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

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
    <motion.div 
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative rounded-3xl p-5 cursor-pointer transition-all overflow-hidden group",
        isLive 
          ? "bg-gradient-to-br from-purple-500/20 via-primary/10 to-pink-500/20 border-2 border-purple-500/30 shadow-lg shadow-purple-500/10" 
          : isEnded 
          ? "bg-gradient-to-br from-muted/80 to-muted/50 border border-border"
          : "bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/30"
      )}
    >
      {/* Animated background glow for live spaces */}
      {isLive && (
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
      )}

      {/* Status badges */}
      <div className="absolute -top-2 right-4 flex gap-2">
        {isLive && (
          <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 shadow-lg shadow-red-500/30 animate-pulse gap-1.5">
            <span className="w-2 h-2 bg-white rounded-full animate-ping" />
            LIVE
          </Badge>
        )}
        {isScheduled && (
          <Badge variant="secondary" className="gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock className="w-3 h-3" />
            Scheduled
          </Badge>
        )}
        {isEnded && (
          <Badge variant="outline" className="gap-1 bg-background/80">
            <Play className="w-3 h-3" />
            Replay
          </Badge>
        )}
      </div>

      {/* Private indicator */}
      {space.is_private && (
        <div className="absolute -top-2 left-4">
          <Badge variant="outline" className="gap-1 bg-background border-muted-foreground/30">
            <Lock className="w-3 h-3" />
            Private
          </Badge>
        </div>
      )}

      {/* Content */}
      <div className="relative pt-3">
        {/* Host info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Avatar className={cn(
              "w-12 h-12 ring-2",
              isLive ? "ring-purple-500 shadow-lg shadow-purple-500/30" : "ring-border"
            )}>
              <AvatarImage src={space.profiles?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/50 to-purple-500/50">
                {space.profiles?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            {isLive && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center border-2 border-background">
                <Mic className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{space.profiles?.display_name}</p>
              {isOwner && (
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] h-4">
                  <Crown className="w-2.5 h-2.5 mr-0.5" />
                  Your Space
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">@{space.profiles?.username}</p>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg mb-2 line-clamp-2 leading-tight">{space.title}</h3>

        {/* Category */}
        {space.topic_category && (
          <Badge variant="secondary" className="mb-3 text-xs bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-3 h-3 mr-1" />
            {space.topic_category}
          </Badge>
        )}

        {/* Speakers preview */}
        {speakers.length > 0 && isLive && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex -space-x-2">
              {speakers.slice(0, 5).map((speaker, i) => (
                <Avatar key={i} className="w-7 h-7 border-2 border-background ring-1 ring-purple-500/30">
                  <AvatarImage src={speaker.profile?.avatar_url || ''} />
                  <AvatarFallback className="text-[10px] bg-muted">S</AvatarFallback>
                </Avatar>
              ))}
            </div>
            {speakers.length > 5 && (
              <span className="text-xs text-muted-foreground font-medium">+{speakers.length - 5} speaking</span>
            )}
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="font-medium">{space.viewer_count || 0}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Mic className="w-4 h-4" />
              <span className="font-medium">Space</span>
            </span>
          </div>

          {isScheduled && space.scheduled_start && (
            <span className="text-xs text-blue-400 font-medium">
              {formatDistanceToNow(new Date(space.scheduled_start), { addSuffix: true })}
            </span>
          )}

          {isEnded && space.ended_at && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Action button */}
        {isLive && (
          <Button className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-shadow">
            <Mic className="w-4 h-4 mr-2" />
            Join Space
          </Button>
        )}

        {isEnded && (
          <Button variant="outline" className="w-full mt-4 border-muted-foreground/20 hover:bg-muted">
            <Play className="w-4 h-4 mr-2" />
            Listen to Replay
          </Button>
        )}

        {isScheduled && (
          <Button variant="outline" className="w-full mt-4 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            <Clock className="w-4 h-4 mr-2" />
            Set Reminder
          </Button>
        )}
      </div>
    </motion.div>
  );
};
