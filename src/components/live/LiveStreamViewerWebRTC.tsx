import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Send, Heart, ThumbsUp, Laugh, X, Gift, 
  Volume2, VolumeX, Maximize, Minimize, Flame, 
  PartyPopper, MessageCircle, Share2, Radio, Home
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { FlyingChat } from './FlyingChat';
import { LiveStreamMentionInput } from './LiveStreamMentionInput';

interface LiveStreamViewerWebRTCProps {
  streamId: string;
  onClose: () => void;
}

export const LiveStreamViewerWebRTC = ({ streamId, onClose }: LiveStreamViewerWebRTCProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef<string>(crypto.randomUUID());
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number }[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [flyingGifts, setFlyingGifts] = useState<{ id: string; gift_type: string; sender_name: string; credit_value: number }[]>([]);

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      const { data: streamData, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .single();

      if (error) {
        console.error("Error fetching stream:", error);
        toast.error("Failed to load stream");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", streamData.user_id)
        .single();

      setStream({ ...streamData, profiles: profileData });
      
      if (streamData.status !== 'live') {
        setIsConnecting(false);
      }
    };

    fetchStream();
  }, [streamId]);

  // Join stream as viewer
  useEffect(() => {
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

      if (!error && data) {
        setViewerSession(data.id);
      }
    };

    joinStream();

    return () => {
      if (viewerSession) {
        supabase
          .from("live_stream_viewers")
          .update({ is_active: false, left_at: new Date().toISOString() })
          .eq("id", viewerSession);
      }
    };
  }, [streamId]);

  // WebRTC connection setup with retry mechanism
  useEffect(() => {
    if (stream?.status !== 'live') return;

    const viewerId = viewerIdRef.current;
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeout: NodeJS.Timeout | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ]
    });

    pcRef.current = pc;

    // Add transceiver to receive video/audio
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    // Handle incoming stream
    pc.ontrack = (event) => {
      console.log("[Viewer] Received track:", event.track.kind);
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setHasVideo(true);
        setIsConnecting(false);
        
        // Clear any retry timeouts since we're connected
        if (retryTimeout) clearTimeout(retryTimeout);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        
        toast.success('Connected to stream!');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[Viewer] Connection state:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        retryCount = 0;
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setIsConnecting(true);
        // Attempt reconnect
        if (retryCount < maxRetries) {
          retryTimeout = setTimeout(() => {
            console.log(`[Viewer] Retrying connection (attempt ${retryCount + 1}/${maxRetries})`);
            announceViewerJoin();
          }, 2000 * Math.pow(2, retryCount));
          retryCount++;
        }
      }
    };

    // Subscribe to broadcast channel
    const channel = supabase
      .channel(`broadcast-${streamId}`, {
        config: {
          broadcast: { self: false },
        }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.viewerId !== viewerId) return;

        console.log("[Viewer] Received offer from host");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Send answer back
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { viewerId, answer },
          });
          console.log("[Viewer] Sent answer to host");
        } catch (err) {
          console.error("[Viewer] Error handling offer:", err);
        }
      })
      .on('broadcast', { event: 'ice-candidate-from-host' }, async ({ payload }) => {
        if (payload.viewerId !== viewerId) return;
        if (payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error("[Viewer] Error adding ICE candidate:", err);
          }
        }
      })
      .on('broadcast', { event: 'host-ready' }, () => {
        // Host is signaling they're ready - announce ourselves
        console.log("[Viewer] Host signaled ready, announcing join");
        announceViewerJoin();
      });

    // Function to announce viewer join
    const announceViewerJoin = () => {
      console.log("[Viewer] Announcing join with viewerId:", viewerId);
      channel.send({
        type: 'broadcast',
        event: 'viewer-join',
        payload: { viewerId },
      });
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { viewerId, candidate: event.candidate },
        });
      }
    };

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("[Viewer] Subscribed to broadcast channel");
        // Announce viewer join immediately
        announceViewerJoin();
        
        // Set a connection timeout - if no video after 10 seconds, retry
        connectionTimeout = setTimeout(() => {
          if (!hasVideo && retryCount < maxRetries) {
            console.log("[Viewer] Connection timeout, retrying...");
            announceViewerJoin();
            retryCount++;
          }
        }, 10000);
        
        // Also retry every 3 seconds initially
        retryTimeout = setTimeout(() => {
          if (!hasVideo) {
            console.log("[Viewer] Initial retry...");
            announceViewerJoin();
          }
        }, 3000);
      }
    });

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (connectionTimeout) clearTimeout(connectionTimeout);
      pc.close();
      supabase.removeChannel(channel);
    };
  }, [stream?.status, streamId, hasVideo]);

  // Subscribe to comments
  useEffect(() => {
    const fetchComments = async () => {
      const { data: commentsData } = await supabase
        .from("live_stream_comments")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!commentsData) return;

      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setComments(commentsData.map(comment => ({
        ...comment,
        profiles: profileMap.get(comment.user_id)
      })).reverse());
    };

    fetchComments();

    const channel = supabase
      .channel(`comments-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchComments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, (payload: any) => {
        const newReaction = { 
          type: payload.new.reaction_type, 
          id: Date.now(),
          x: Math.random() * 60 + 20,
        };
        setReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }

    await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment("");
  };

  const sendReaction = async (reactionType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("live_stream_reactions").insert({
      stream_id: streamId,
      user_id: user.id,
      reaction_type: reactionType,
    });
  };

  const getReactionEmoji = (type: string) => {
    switch (type) {
      case 'heart': return '❤️';
      case 'like': return '👍';
      case 'laugh': return '😂';
      case 'fire': return '🔥';
      case 'clap': return '👏';
      default: return '❤️';
    }
  };

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black",
      !isFullscreen && "flex flex-col"
    )}>
      {/* Video Container */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-contain"
        />

        {/* Loading/Waiting State */}
        {(isConnecting || stream.status !== 'live') && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              {stream.status === 'live' ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-white">Connecting to stream...</p>
                </>
              ) : stream.status === 'scheduled' ? (
                <>
                  <Radio className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold text-white mb-2">Stream Not Started Yet</h3>
                  <p className="text-muted-foreground">
                    {stream.scheduled_start 
                      ? `Starts ${formatDistanceToNow(new Date(stream.scheduled_start), { addSuffix: true })}`
                      : "Waiting for host to start..."}
                  </p>
                </>
              ) : (
                <>
                  <Radio className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold text-white mb-2">Stream Ended</h3>
                  <p className="text-muted-foreground">This stream has ended</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stream Info Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="border-2 border-primary">
                <AvatarImage src={stream.profiles?.avatar_url} />
                <AvatarFallback>{stream.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-bold text-white">{stream.profiles?.display_name}</h2>
                <div className="flex items-center gap-2">
                  {stream.status === 'live' && (
                    <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
                  )}
                  <span className="text-sm text-white/80 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {stream.viewer_count || 0}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => navigate('/feed')}
                title="Go to Feed"
              >
                <Home className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
          <p className="text-white/80 text-sm mt-2 line-clamp-1">{stream.title}</p>
        </div>

        {/* Flying Chat Overlay */}
        {stream.status === 'live' && (
          <FlyingChat 
            messages={comments} 
            gifts={flyingGifts}
            maxMessages={8}
          />
        )}

        {/* Floating Reactions */}
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute bottom-32 text-4xl pointer-events-none"
            style={{
              left: `${reaction.x}%`,
              animation: 'floatUp 3s ease-out forwards',
            }}
          >
            {getReactionEmoji(reaction.type)}
          </div>
        ))}

        {/* Video Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
        </div>

        {/* Reaction Buttons */}
        <div className="absolute right-4 bottom-32 flex flex-col gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:scale-110 transition-transform"
            onClick={() => sendReaction('heart')}
          >
            <Heart className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:scale-110 transition-transform"
            onClick={() => sendReaction('fire')}
          >
            <Flame className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:scale-110 transition-transform"
            onClick={() => sendReaction('clap')}
          >
            <PartyPopper className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:scale-110 transition-transform"
            onClick={() => sendReaction('like')}
          >
            <ThumbsUp className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-primary text-white hover:bg-primary/80 hover:scale-110 transition-transform"
          >
            <Gift className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Chat Section */}
      {!isFullscreen && showChat && (
        <Card className="h-64 rounded-none border-t bg-background/95 backdrop-blur">
          <CardContent className="p-3 h-full flex flex-col">
            <ScrollArea className="flex-1 mb-2">
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 items-start">
                    <Avatar className="w-6 h-6 shrink-0">
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {comment.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-xs text-primary">
                        {comment.profiles?.display_name || 'Anonymous'}
                      </span>
                      <span className="text-sm ml-2 break-words">{comment.content}</span>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No comments yet. Be the first!
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Send a message..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                className="flex-1 h-9"
              />
              <Button size="sm" onClick={sendComment} className="h-9 px-3">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          50% { opacity: 0.8; transform: translateY(-50px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-150px) scale(0.8); }
        }
      `}</style>
    </div>
  );
};