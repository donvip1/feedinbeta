import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Users, Clock, Radio, Play, Settings, Trash2, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [deleting, setDeleting] = useState(false);
  const isLive = stream.status === 'live';
  const isScheduled = stream.status === 'scheduled';
  const isEnded = stream.status === 'ended';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this stream?")) return;
    
    setDeleting(true);
    try {
      await supabase.from("live_streams").delete().eq("id", stream.id);
      toast.success("Stream deleted");
    } catch (error: any) {
      toast.error("Failed to delete stream");
    } finally {
      setDeleting(false);
    }
  };
  
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
          <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <Radio className={cn("w-12 h-12", isLive ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
          </div>
        )}
        
        <div className="absolute top-3 left-3 flex gap-2">
          {isLive && <Badge className="bg-red-500 text-white animate-pulse"><span className="w-2 h-2 bg-white rounded-full mr-1" />LIVE</Badge>}
          {isScheduled && <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>}
          {isEnded && <Badge variant="outline" className="bg-background/80">Ended</Badge>}
        </div>
        
        {stream.is_premium && (
          <Badge className="absolute top-3 right-12 bg-gradient-to-r from-amber-500 to-orange-500 text-white">Premium</Badge>
        )}

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="w-4 h-4 mr-2" />{deleting ? "Deleting..." : "Delete Stream"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
          <Users className="w-3 h-3" />{stream.viewer_count || 0}
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={stream.profiles?.avatar_url || undefined} />
            <AvatarFallback>{stream.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">{stream.title}</h3>
            <p className="text-sm text-muted-foreground">{stream.profiles?.display_name || 'Unknown'}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {stream.started_at && isLive && <span>Started {formatDistanceToNow(new Date(stream.started_at))} ago</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};