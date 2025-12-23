import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Users, Clock, Radio, Play, Trash2, MoreVertical, Gift, Crown, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { motion } from "framer-motion";
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
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "cursor-pointer rounded-3xl overflow-hidden group relative transition-all",
        isLive && "ring-2 ring-red-500/50 shadow-lg shadow-red-500/20",
        isEnded && "opacity-70"
      )}
      onClick={onClick}
    >
      {/* Thumbnail / Video Preview Area */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {stream.thumbnail_url ? (
          <img 
            src={stream.thumbnail_url} 
            alt={stream.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className={cn(
              "relative",
              isLive && "animate-pulse"
            )}>
              {isLive && (
                <div className="absolute inset-0 bg-red-500/30 rounded-full blur-2xl animate-ping" />
              )}
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                isLive 
                  ? "bg-gradient-to-br from-red-500 to-pink-500" 
                  : "bg-gradient-to-br from-muted to-muted/50"
              )}>
                <Radio className={cn("w-8 h-8", isLive ? "text-white" : "text-muted-foreground")} />
              </div>
            </div>
          </div>
        )}
        
        {/* Status Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isLive && (
            <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 shadow-lg shadow-red-500/30 animate-pulse gap-1.5">
              <span className="w-2 h-2 bg-white rounded-full" />
              LIVE
            </Badge>
          )}
          {isScheduled && (
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
              <Clock className="w-3 h-3" />
              Scheduled
            </Badge>
          )}
          {isEnded && (
            <Badge variant="outline" className="bg-background/80 gap-1">
              <Play className="w-3 h-3" />
              Ended
            </Badge>
          )}
        </div>
        
        {/* Premium Badge */}
        {stream.is_premium && (
          <Badge className="absolute top-3 right-12 bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-lg gap-1">
            <Crown className="w-3 h-3" />
            Premium
          </Badge>
        )}

        {/* Owner Menu */}
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white h-8 w-8 rounded-full"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="w-4 h-4 mr-2" />
                {deleting ? "Deleting..." : "Delete Stream"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* Viewer Count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <div className="bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs text-white flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5" />
            {stream.viewer_count || 0}
          </div>
        </div>

        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
      
      {/* Content */}
      <div className="p-4 bg-card">
        <div className="flex gap-3">
          <Avatar className={cn(
            "w-11 h-11 ring-2",
            isLive ? "ring-red-500/50" : "ring-border"
          )}>
            <AvatarImage src={stream.profiles?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary/50 to-purple-500/50">
              {stream.profiles?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {stream.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground truncate">
                {stream.profiles?.display_name || 'Unknown'}
              </p>
              {isOwner && (
                <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary">
                  You
                </Badge>
              )}
            </div>
            {stream.category && (
              <Badge variant="outline" className="mt-2 text-[10px] h-5 gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                {stream.category}
              </Badge>
            )}
            {stream.started_at && isLive && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Started {formatDistanceToNow(new Date(stream.started_at))} ago
              </p>
            )}
            {isScheduled && stream.scheduled_start && (
              <p className="text-xs text-blue-400 mt-1.5 font-medium">
                Starts {formatDistanceToNow(new Date(stream.scheduled_start), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
