import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onClick: () => void;
}

export const LiveStreamCard = ({ stream, onClick }: LiveStreamCardProps) => {
  const isLive = stream.status === 'live';
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all overflow-hidden group"
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
          <div className="w-full h-full flex items-center justify-center">
            <Eye className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {isLive && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-red-500 text-white animate-pulse">
              LIVE
            </Badge>
          </div>
        )}
        
        {stream.is_premium && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-primary to-accent">
              Premium
            </Badge>
          </div>
        )}
        
        <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
          <Users className="w-3 h-3" />
          {stream.viewer_count}
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={stream.profiles.avatar_url || undefined} />
            <AvatarFallback>
              {stream.profiles.display_name?.[0] || stream.profiles.username?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {stream.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {stream.profiles.display_name || stream.profiles.username}
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
                  {formatDistanceToNow(new Date(stream.started_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};