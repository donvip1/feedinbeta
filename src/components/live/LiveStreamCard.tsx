import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Users, Clock, Radio, Play, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface LiveStreamCardProps {
  stream: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    status: string;
    viewer_count: number;
    category: string | null;
    is_premium: boolean;
    started_at: string | null;
    scheduled_start?: string | null;
    profiles?: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    } | null;
  };
  onClick: () => void;
  isOwner?: boolean;
}

export const LiveStreamCard = ({ stream, onClick, isOwner }: LiveStreamCardProps) => {
  const isLive = stream.status === 'live';
  const isScheduled = stream.status === 'scheduled';
  const isEnded = stream.status === 'ended';
  
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all overflow-hidden group relative",
        isLive && "ring-2 ring-red-500/50",
        isEnded && "opacity-60"
      )}
      onClick={onClick}
    >
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/20">
        {stream.thumbnail_url ? (
          <img 
            src={stream.thumbnail_url} 
            alt={stream.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <Radio className={cn(
              "w-12 h-12",
              isLive ? "text-red-500 animate-pulse" : "text-muted-foreground"
            )} />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isLive && (
            <Badge className="bg-red-500 text-white animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full" />
              LIVE
            </Badge>
          )}
          {isScheduled && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Scheduled
            </Badge>
          )}
          {isEnded && (
            <Badge variant="outline" className="bg-background/80">
              Ended
            </Badge>
          )}
        </div>
        
        {stream.is_premium && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              Premium
            </Badge>
          </div>
        )}
        
        <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
          <Users className="w-3 h-3" />
          {stream.viewer_count || 0}
        </div>

        {/* Owner Controls Overlay */}
        {isOwner && !isLive && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 text-white">
              <Play className="w-8 h-8" />
              <span className="font-semibold">
                {isScheduled ? "Start Stream" : "View Details"}
              </span>
            </div>
          </div>
        )}

        {isOwner && isLive && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 text-white">
              <Settings className="w-8 h-8" />
              <span className="font-semibold">Manage Stream</span>
            </div>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 border-2 border-transparent group-hover:border-primary transition-colors">
            <AvatarImage src={stream.profiles?.avatar_url || undefined} />
            <AvatarFallback>
              {stream.profiles?.display_name?.[0] || stream.profiles?.username?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {stream.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {stream.profiles?.display_name || stream.profiles?.username || 'Unknown'}
            </p>
            
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {stream.category && (
                <span className="px-2 py-1 bg-secondary rounded">
                  {stream.category}
                </span>
              )}
              {stream.started_at && isLive && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Started {formatDistanceToNow(new Date(stream.started_at), { addSuffix: true })}
                </span>
              )}
              {stream.scheduled_start && isScheduled && (
                <span className="flex items-center gap-1 text-primary">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(stream.scheduled_start), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};