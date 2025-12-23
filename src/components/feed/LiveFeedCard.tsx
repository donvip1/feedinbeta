import { Radio, Users, Mic, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LiveFeedCardProps {
  item: {
    id: string;
    title: string;
    type: 'video' | 'space';
    status: 'live' | 'ended';
    viewer_count: number;
    thumbnail_url?: string;
    topic_category?: string;
    share_link?: string;
    host: {
      display_name: string;
      username: string;
      avatar_url: string;
    };
  };
  onClick: () => void;
}

export const LiveFeedCard = ({ item, onClick }: LiveFeedCardProps) => {
  const isSpace = item.type === 'space';
  const isLive = item.status === 'live';

  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[9/16] max-h-[70vh] rounded-2xl overflow-hidden cursor-pointer group",
        "bg-gradient-to-br from-background via-muted to-background",
        "border border-border hover:border-primary/50 transition-all"
      )}
    >
      {/* Background */}
      {item.thumbnail_url ? (
        <img 
          src={item.thumbnail_url} 
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className={cn(
          "absolute inset-0",
          isSpace 
            ? "bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20"
            : "bg-gradient-to-br from-red-500/20 via-pink-500/10 to-purple-500/20"
        )}>
          {/* Animated wave pattern for spaces */}
          {isSpace && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1 items-end h-20">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-1.5 bg-primary/40 rounded-full animate-pulse"
                    style={{ 
                      height: `${20 + Math.random() * 60}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

      {/* Live badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        {isLive ? (
          <Badge className="bg-red-500 text-white animate-pulse gap-1 px-3 py-1">
            <span className="w-2 h-2 bg-white rounded-full" />
            LIVE
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Play className="w-3 h-3" />
            Replay
          </Badge>
        )}
        
        <Badge variant="secondary" className="gap-1 bg-black/50 border-none">
          {isSpace ? <Mic className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
          {isSpace ? 'Space' : 'Video'}
        </Badge>
      </div>

      {/* Viewer count */}
      <div className="absolute top-4 right-4">
        <Badge variant="secondary" className="gap-1 bg-black/50 border-none">
          <Users className="w-3 h-3" />
          {item.viewer_count.toLocaleString()}
        </Badge>
      </div>

      {/* Content info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* Topic category */}
        {item.topic_category && (
          <Badge variant="outline" className="mb-2 bg-black/30 border-white/20 text-white text-xs">
            {item.topic_category}
          </Badge>
        )}

        {/* Title */}
        <h3 className="text-white font-bold text-lg mb-3 line-clamp-2">
          {item.title}
        </h3>

        {/* Host info */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="w-10 h-10 ring-2 ring-white/30">
            <AvatarImage src={item.host.avatar_url} />
            <AvatarFallback>{item.host.display_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium text-sm">{item.host.display_name}</p>
            <p className="text-white/60 text-xs">@{item.host.username}</p>
          </div>
        </div>

        {/* Join button */}
        <Button 
          className={cn(
            "w-full h-12 text-base font-semibold",
            isLive 
              ? "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {isLive ? (
            <>
              <Play className="w-5 h-5 mr-2" />
              {isSpace ? 'Join Space' : 'Watch Now'}
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              {isSpace ? 'Listen to Replay' : 'Watch Replay'}
            </>
          )}
        </Button>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};
