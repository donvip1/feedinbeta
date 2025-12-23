import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Send, Heart, X, Gift, 
  Volume2, VolumeX, Maximize, Minimize, Flame, 
  PartyPopper, ThumbsUp, Star, Sparkles, 
  MessageCircle, Home
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

interface LiveStreamViewerWebRTCProps {
  streamId: string;
  onClose: () => void;
}

// Sexy emoji reactions - TikTok style
const REACTIONS = [
  { type: 'heart', emoji: '❤️', icon: Heart, color: 'text-red-500' },
  { type: 'fire', emoji: '🔥', icon: Flame, color: 'text-orange-500' },
  { type: 'star', emoji: '⭐', icon: Star, color: 'text-yellow-500' },
  { type: 'clap', emoji: '👏', icon: PartyPopper, color: 'text-purple-500' },
  { type: 'like', emoji: '👍', icon: ThumbsUp, color: 'text-blue-500' },
  { type: 'love', emoji: '😍', icon: Sparkles, color: 'text-pink-500' },
];

export const LiveStreamViewerWebRTC = ({ streamId, onClose }: LiveStreamViewerWebRTCProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef<string>(crypto.randomUUID());
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number; y: number }[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [isChatFocused, setIsChatFocused] = useState(false);
  
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

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

  // Subscribe to stream status changes - kick viewers when stream ends
  useEffect(() => {
    const channel = supabase
      .channel(`stream-status-${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`,
      }, (payload: any) => {
        console.log("[Viewer] Stream status changed:", payload.new.status);
        if (payload.new.status === 'ended') {
          toast.info("Stream has ended");
          // Close connection and exit
          if (pcRef.current) {
            pcRef.current.close();
          }
          setTimeout(() => {
            onClose();
            navigate('/live');
          }, 1500);
        }
        setStream((prev: any) => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, onClose, navigate]);

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

  // Fetch active viewers for gift modal
  useEffect(() => {
    const fetchViewers = async () => {
      const { data } = await supabase
        .from("live_stream_viewers")
        .select("user_id")
        .eq("stream_id", streamId)
        .eq("is_active", true)
        .not("user_id", "is", null);

      if (data && data.length > 0) {
        const userIds = data.map(v => v.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        setViewers(profiles || []);
      }
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 10000);
    return () => clearInterval(interval);
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

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.ontrack = (event) => {
      console.log("[Viewer] Received track:", event.track.kind);
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setHasVideo(true);
        setIsConnecting(false);
        
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
        if (retryCount < maxRetries) {
          retryTimeout = setTimeout(() => {
            console.log(`[Viewer] Retrying connection (attempt ${retryCount + 1}/${maxRetries})`);
            announceViewerJoin();
          }, 2000 * Math.pow(2, retryCount));
          retryCount++;
        }
      }
    };

    const channel = supabase
      .channel(`broadcast-${streamId}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.viewerId !== viewerId) return;

        console.log("[Viewer] Received offer from host");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

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
        console.log("[Viewer] Host signaled ready, announcing join");
        announceViewerJoin();
      })
      .on('broadcast', { event: 'stream-ended' }, () => {
        console.log("[Viewer] Host ended stream via broadcast");
        toast.info("Stream has ended");
        pc.close();
        setTimeout(() => {
          onClose();
          navigate('/live');
        }, 1500);
      });

    const announceViewerJoin = () => {
      console.log("[Viewer] Announcing join with viewerId:", viewerId);
      channel.send({
        type: 'broadcast',
        event: 'viewer-join',
        payload: { viewerId },
      });
    };

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
        announceViewerJoin();
        
        connectionTimeout = setTimeout(() => {
          if (!hasVideo && retryCount < maxRetries) {
            console.log("[Viewer] Connection timeout, retrying...");
            announceViewerJoin();
            retryCount++;
          }
        }, 10000);
        
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
  }, [stream?.status, streamId, hasVideo, onClose, navigate]);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments]);

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
          id: Date.now() + Math.random(),
          x: Math.random() * 40 + 55, // Right side
          y: Math.random() * 30 + 40,
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

  // Subscribe to gifts
  useEffect(() => {
    const channel = supabase
      .channel(`gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", payload.new.sender_id)
          .single();

        const newGift = {
          id: payload.new.id,
          gift_type: payload.new.gift_type,
          sender_name: senderProfile?.display_name || 'Someone',
          credit_value: payload.new.credit_value,
        };
        
        setFlyingGifts(prev => [...prev, newGift]);
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
        }, 4000);
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
    chatInputRef.current?.blur();
  };

  const sendReaction = async (reactionType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to react");
      return;
    }

    // Add immediate local reaction for feedback
    const localReaction = {
      type: reactionType,
      id: Date.now() + Math.random(),
      x: Math.random() * 40 + 55,
      y: Math.random() * 30 + 40,
    };
    setReactions(prev => [...prev, localReaction]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== localReaction.id));
    }, 3000);

    await supabase.from("live_stream_reactions").insert({
      stream_id: streamId,
      user_id: user.id,
      reaction_type: reactionType,
    });
  };

  const getReactionEmoji = (type: string) => {
    return REACTIONS.find(r => r.type === type)?.emoji || '❤️';
  };

  const getGiftEmoji = (type: string) => {
    const giftEmojis: Record<string, string> = {
      heart: '❤️', star: '⭐', fire: '🔥', lightning: '⚡',
      crown: '👑', diamond: '💎', rocket: '🚀', universe: '🌌',
      credits: '💰',
    };
    return giftEmojis[type] || '🎁';
  };

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Full Screen Video - Fills entire viewport, cropping as needed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          // Ensure video fills and centers on all devices
          objectPosition: 'center center',
          minWidth: '100%',
          minHeight: '100%',
        }}
      />

      {/* Loading/Waiting State */}
      {(isConnecting || stream.status !== 'live') && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-center">
            {stream.status === 'live' ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-white">Connecting to stream...</p>
              </>
            ) : stream.status === 'scheduled' ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 text-primary">📡</div>
                <h3 className="text-xl font-bold text-white mb-2">Stream Not Started Yet</h3>
                <p className="text-muted-foreground">
                  {stream.scheduled_start 
                    ? `Starts ${formatDistanceToNow(new Date(stream.scheduled_start), { addSuffix: true })}`
                    : "Waiting for host to start..."}
                </p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">📺</div>
                <h3 className="text-xl font-bold text-white mb-2">Stream Ended</h3>
                <p className="text-muted-foreground">This stream has ended</p>
                <Button className="mt-4" onClick={() => navigate('/live')}>
                  Browse Other Streams
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top Header Gradient */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 z-20 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="border-2 border-primary w-10 h-10">
              <AvatarImage src={stream.profiles?.avatar_url} />
              <AvatarFallback>{stream.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-bold text-white text-sm">{stream.profiles?.display_name}</h2>
              <div className="flex items-center gap-2">
                {stream.status === 'live' && (
                  <Badge variant="destructive" className="animate-pulse text-[10px] h-5">LIVE</Badge>
                )}
                <span className="text-xs text-white/80 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {stream.viewer_count || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={() => navigate('/feed')}
            >
              <Home className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <p className="text-white/80 text-xs mt-2 line-clamp-1">{stream.title}</p>
      </div>

      {/* Floating Chat Overlay - TikTok Style */}
      {showChat && stream.status === 'live' && (
        <div 
          className="absolute left-0 z-20 pointer-events-none"
          style={{
            bottom: isKeyboardOpen ? `${keyboardHeight + 60}px` : '120px',
            maxHeight: '40vh',
            // Wider on desktop/tablet
            right: window.innerWidth >= 768 ? '25%' : '80px',
            width: window.innerWidth >= 768 ? '400px' : 'auto',
          }}
        >
          <div 
            ref={chatScrollRef}
            className="overflow-y-auto px-3 space-y-2 pointer-events-auto"
            style={{ maxHeight: '40vh' }}
          >
            <AnimatePresence>
              {comments.slice(-15).map((comment, index) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-2"
                >
                  <Avatar className="w-7 h-7 md:w-8 md:h-8 shrink-0 border border-white/20">
                    <AvatarImage src={comment.profiles?.avatar_url} />
                    <AvatarFallback className="text-[10px] bg-primary/50">
                      {comment.profiles?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-3 py-1.5 max-w-[85%]">
                    <span className="text-primary text-xs md:text-sm font-semibold">
                      {comment.profiles?.display_name || 'Anonymous'}
                    </span>
                    <p className="text-white text-sm md:text-base break-words">{comment.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Flying Gift Notifications */}
      <AnimatePresence>
        {flyingGifts.map((gift) => (
          <motion.div
            key={gift.id}
            initial={{ opacity: 0, scale: 0, x: '50%', y: '50%' }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
              <span className="text-4xl">{getGiftEmoji(gift.gift_type)}</span>
              <div>
                <p className="text-white font-bold">{gift.sender_name}</p>
                <p className="text-white/80 text-sm">sent {gift.gift_type} ({gift.credit_value} credits)</p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Floating Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ 
              opacity: 0, 
              y: -200, 
              scale: [1, 1.4, 1.2],
              x: [0, Math.random() * 40 - 20, Math.random() * 60 - 30]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute text-4xl pointer-events-none z-30"
            style={{
              right: `${100 - reaction.x}%`,
              bottom: `${reaction.y}%`,
            }}
          >
            {getReactionEmoji(reaction.type)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Right Side Reaction Buttons - Larger on desktop */}
      <div 
        className="absolute right-3 md:right-6 flex flex-col gap-2 md:gap-3 z-20"
        style={{
          bottom: isKeyboardOpen ? `${keyboardHeight + 130}px` : '190px',
        }}
      >
        {REACTIONS.map((reaction) => (
          <motion.button
            key={reaction.type}
            whileTap={{ scale: 0.85 }}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 active:bg-white/20 transition-colors"
            onClick={() => sendReaction(reaction.type)}
          >
            <span className="text-2xl md:text-3xl">{reaction.emoji}</span>
          </motion.button>
        ))}
        
        {/* Gift Button */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg"
          onClick={() => setShowGiftModal(true)}
        >
          <Gift className="w-6 h-6 md:w-7 md:h-7 text-white" />
        </motion.button>
      </div>

      {/* Bottom Controls */}
      <div 
        className="absolute left-0 right-0 bg-gradient-to-t from-black/80 to-transparent z-20"
        style={{
          bottom: isKeyboardOpen ? `${keyboardHeight}px` : '0',
          paddingBottom: isKeyboardOpen ? '8px' : 'max(env(safe-area-inset-bottom), 16px)',
        }}
      >
        {/* Video Controls */}
        <div className="flex items-center justify-center gap-2 mb-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20 h-10 w-10 bg-black/30"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20 h-10 w-10 bg-black/30"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className={cn("w-5 h-5", showChat && "text-primary")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20 h-10 w-10 bg-black/30"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
        </div>

        {/* Chat Input */}
        {showChat && (
          <div className="flex gap-2 px-3 pb-2">
            <Input
              ref={chatInputRef}
              placeholder="Say something..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendComment()}
              onFocus={() => setIsChatFocused(true)}
              onBlur={() => setIsChatFocused(false)}
              className="flex-1 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-full px-4"
            />
            <Button 
              size="icon" 
              onClick={sendComment} 
              className="h-10 w-10 rounded-full bg-primary shrink-0"
              disabled={!newComment.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={stream.user_id}
        viewers={viewers}
        isHost={false}
      />
    </div>
  );
};
