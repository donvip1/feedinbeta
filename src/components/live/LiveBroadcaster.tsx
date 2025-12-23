import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Video, VideoOff, Mic, MicOff, Camera, FlipHorizontal,
  Users, Send, Heart, X, Sparkles, Gift, MessageCircle,
  Settings, Maximize, Minimize, Radio, UserPlus, Coins
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { useNavigation } from '@/context/NavigationContext';

interface LiveBroadcasterProps {
  streamId: string;
  onClose: () => void;
}

export const LiveBroadcaster = ({ streamId, onClose }: LiveBroadcasterProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [reactions, setReactions] = useState<{ type: string; id: number }[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [totalGiftsReceived, setTotalGiftsReceived] = useState(0);

  // Hide bottom navigation when broadcasting
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Initialize media stream
  const initializeMedia = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      return mediaStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  };

  // Start broadcasting
  const startBroadcast = async () => {
    setIsStarting(true);
    try {
      await initializeMedia();
      
      // Update stream status to live
      const { error } = await supabase
        .from("live_streams")
        .update({ 
          status: "live",
          started_at: new Date().toISOString(),
        })
        .eq("id", streamId);

      if (error) throw error;

      setIsLive(true);
      toast.success("You are now live!");
    } catch (error: any) {
      console.error("Error starting broadcast:", error);
      toast.error(error.message || "Failed to start broadcast");
    } finally {
      setIsStarting(false);
    }
  };

  // Stop broadcasting
  const stopBroadcast = async () => {
    // Stop all tracks
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    // Close all peer connections
    viewersRef.current.forEach(pc => pc.close());
    viewersRef.current.clear();

    // Update stream status
    await supabase
      .from("live_streams")
      .update({ 
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", streamId);

    setIsLive(false);
    onClose();
  };

  // Toggle video
  const toggleVideo = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  // Switch camera
  const switchCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsFrontCamera(!isFrontCamera);
    await initializeMedia();
  };

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .single();

      if (!error && data) {
        setStream(data);
      }
    };

    fetchStream();
  }, [streamId]);

  // Subscribe to signaling channel for viewer connections
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel(`broadcast-${streamId}`)
      .on('broadcast', { event: 'viewer-join' }, async ({ payload }) => {
        console.log("Viewer joining:", payload.viewerId);
        await handleViewerJoin(payload.viewerId);
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        const pc = viewersRef.current.get(payload.viewerId);
        if (pc && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        const pc = viewersRef.current.get(payload.viewerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, streamId]);

  // Handle new viewer connection
  const handleViewerJoin = async (viewerId: string) => {
    if (!streamRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    // Add local stream tracks
    streamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, streamRef.current!);
    });

    // Send ICE candidates to viewer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.channel(`broadcast-${streamId}`).send({
          type: 'broadcast',
          event: 'ice-candidate-from-host',
          payload: { viewerId, candidate: event.candidate },
        });
      }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer to viewer
    supabase.channel(`broadcast-${streamId}`).send({
      type: 'broadcast',
      event: 'offer',
      payload: { viewerId, offer },
    });

    viewersRef.current.set(viewerId, pc);
    setViewerCount(viewersRef.current.size);
  };

  // Subscribe to comments
  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from("live_stream_comments")
        .select("*, profiles:user_id(display_name, username, avatar_url)")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setComments(data.reverse());
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
        const newReaction = { type: payload.new.reaction_type, id: Date.now() };
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

  // Subscribe to viewer count updates and fetch viewer profiles
  useEffect(() => {
    const fetchViewers = async () => {
      const { data, count } = await supabase
        .from("live_stream_viewers")
        .select("user_id", { count: 'exact' })
        .eq("stream_id", streamId)
        .eq("is_active", true);

      setViewerCount(count || 0);

      if (data && data.length > 0) {
        const userIds = data.map(v => v.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);
          setViewers(profiles || []);
        }
      }

      // Update stream viewer count
      await supabase
        .from("live_streams")
        .update({ viewer_count: count || 0 })
        .eq("id", streamId);
    };

    fetchViewers();

    const channel = supabase
      .channel(`viewers-${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchViewers())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to gifts received
  useEffect(() => {
    if (!user) return;

    const fetchGifts = async () => {
      const { data } = await supabase
        .from("live_stream_gifts")
        .select("credit_value")
        .eq("stream_id", streamId)
        .eq("receiver_id", user.id);

      const total = data?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
      setTotalGiftsReceived(total);
    };

    fetchGifts();

    const channel = supabase
      .channel(`gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, (payload: any) => {
        if (payload.new.receiver_id === user.id) {
          setTotalGiftsReceived(prev => prev + (payload.new.credit_value || 0));
          toast.success(`Received ${payload.new.gift_type} gift! +${payload.new.credit_value} credits`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, user]);

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment("");
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

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black",
      isFullscreen ? "" : "flex flex-col"
    )}>
      {/* Video Container */}
      <div className="relative flex-1 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover",
            isFrontCamera && "scale-x-[-1]"
          )}
        />

        {/* Not Live Yet Overlay */}
        {!isLive && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <Radio className="w-20 h-20 mx-auto mb-4 text-primary animate-pulse" />
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Go Live?</h2>
              <p className="text-muted-foreground mb-6">
                {stream?.title || "Your stream"}
              </p>
              <Button
                size="lg"
                onClick={startBroadcast}
                disabled={isStarting}
                className="bg-red-600 hover:bg-red-700 text-white px-8"
              >
                {isStarting ? "Starting..." : "Start Broadcasting"}
              </Button>
            </div>
          </div>
        )}

        {/* Live Badge & Stats */}
        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-3">
            <Badge variant="destructive" className="animate-pulse px-3 py-1 text-sm">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping" />
              LIVE
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <Users className="w-4 h-4 mr-1" />
              {viewerCount}
            </Badge>
          </div>
        )}

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 text-white hover:bg-white/20"
          onClick={isLive ? stopBroadcast : onClose}
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Floating Reactions */}
        <div className="absolute bottom-32 right-4 flex flex-col gap-2">
          {reactions.map((reaction) => (
            <div
              key={reaction.id}
              className="text-3xl animate-bounce"
              style={{
                animation: 'floatUp 3s ease-out forwards',
              }}
            >
              {getReactionEmoji(reaction.type)}
            </div>
          ))}
        </div>

        {/* Gifts Received Badge */}
        {isLive && totalGiftsReceived > 0 && (
          <div className="absolute top-4 right-16 flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1 rounded-full">
            <Coins className="w-4 h-4" />
            <span className="font-bold">{totalGiftsReceived}</span>
          </div>
        )}

        {/* Host Action Buttons */}
        {isLive && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-pink-500/80 hover:bg-pink-600"
              onClick={() => setShowGiftModal(true)}
            >
              <Gift className="w-5 h-5 text-white" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-blue-500/80 hover:bg-blue-600"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="w-5 h-5 text-white" />
            </Button>
          </div>
        )}

        {/* Control Bar */}
        {isLive && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full",
                !isVideoOn && "bg-red-600 hover:bg-red-700"
              )}
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full",
                !isAudioOn && "bg-red-600 hover:bg-red-700"
              )}
              onClick={toggleAudio}
            >
              {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={switchCamera}
            >
              <FlipHorizontal className="w-5 h-5 text-white" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize className="w-5 h-5 text-white" /> : <Maximize className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full ml-2"
              onClick={stopBroadcast}
            >
              End Stream
            </Button>
          </div>
        )}
      </div>

      {/* Chat Section */}
      {!isFullscreen && (
        <Card className="h-72 rounded-none border-t bg-background/95 backdrop-blur">
          <CardContent className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Live Chat
              </h3>
              <Badge variant="outline">{comments.length} messages</Badge>
            </div>

            <ScrollArea className="flex-1 mb-3">
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 items-start">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {comment.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-primary">
                        {comment.profiles?.display_name || 'Anonymous'}
                      </span>
                      <span className="text-sm ml-2">{comment.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Say something..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                className="flex-1"
              />
              <Button size="icon" onClick={sendComment}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-100px); }
        }
      `}</style>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={user?.id || ""}
        viewers={viewers}
        isHost={true}
      />

      {/* Invite Modal */}
      <LiveInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        streamId={streamId}
      />
    </div>
  );
};