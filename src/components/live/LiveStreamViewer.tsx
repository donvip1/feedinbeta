import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Send, Heart, ThumbsUp, Laugh, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LiveStreamViewerProps {
  streamId: string;
  onClose: () => void;
}

export const LiveStreamViewer = ({ streamId, onClose }: LiveStreamViewerProps) => {
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);

  useEffect(() => {
    fetchStream();
    joinStream();
    subscribeToUpdates();

    return () => {
      leaveStream();
    };
  }, [streamId]);

  const fetchStream = async () => {
    // First fetch the stream
    const { data: streamData, error: streamError } = await supabase
      .from("live_streams")
      .select("*")
      .eq("id", streamId)
      .single();

    if (streamError) {
      console.error("Error fetching stream:", streamError);
      toast.error("Failed to load stream");
      return;
    }

    // Then fetch the profile separately
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", streamData.user_id)
      .single();

    setStream({
      ...streamData,
      profiles: profileData
    });
  };

  const joinStream = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from("live_stream_viewers")
      .insert({
        stream_id: streamId,
        user_id: user?.id || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error joining stream:", error);
      return;
    }

    setViewerSession(data.id);
  };

  const leaveStream = async () => {
    if (viewerSession) {
      await supabase
        .from("live_stream_viewers")
        .update({ is_active: false })
        .eq("id", viewerSession);
    }
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`live-stream-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_stream_comments',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          fetchComments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          setStream(payload.new);
        }
      )
      .subscribe();

    fetchComments();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchComments = async () => {
    const { data: commentsData, error } = await supabase
      .from("live_stream_comments")
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !commentsData) return;

    // Fetch profiles for all comment authors
    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const commentsWithProfiles = commentsData.map(comment => ({
      ...comment,
      profiles: profileMap.get(comment.user_id)
    }));

    setComments(commentsWithProfiles.reverse());
  };

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }

    const { error } = await supabase
      .from("live_stream_comments")
      .insert({
        stream_id: streamId,
        user_id: user.id,
        content: newComment.trim(),
      });

    if (error) {
      console.error("Error sending comment:", error);
      toast.error("Failed to send comment");
      return;
    }

    setNewComment("");
  };

  const sendReaction = async (reactionType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("live_stream_reactions")
      .insert({
        stream_id: streamId,
        user_id: user.id,
        reaction_type: reactionType,
      });
  };

  if (!stream) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-card border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={stream.profiles?.avatar_url} />
              <AvatarFallback>
                {stream.profiles?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">{stream.title}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {stream.viewer_count}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Video Player Area */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="text-white text-center">
            <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">Video player would be integrated here</p>
            <p className="text-xs text-muted-foreground mt-2">Stream Key: {stream.stream_key}</p>
          </div>
        </div>

        {/* Chat Section */}
        <Card className="h-80 rounded-none border-t">
          <CardContent className="p-4 h-full flex flex-col">
            <ScrollArea className="flex-1 mb-4">
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback>
                        {comment.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {comment.profiles?.display_name || 'Anonymous'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mb-2">
              <Button size="sm" variant="ghost" onClick={() => sendReaction('heart')}>
                <Heart className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => sendReaction('like')}>
                <ThumbsUp className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => sendReaction('laugh')}>
                <Laugh className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Send a message..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendComment()}
              />
              <Button onClick={sendComment}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Video = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);