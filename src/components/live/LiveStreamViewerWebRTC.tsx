import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Send, Heart, X, Gift, 
  Volume2, VolumeX, Maximize, Minimize, Flame, 
  PartyPopper, ThumbsUp, Star, Sparkles, 
  MessageCircle, Home, Coins, Wifi, WifiOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { CloudflareStreamSFU } from "@/lib/cloudflare-stream-sfu";

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

const GIFT_EMOJIS: Record<string, string> = {
  heart: '❤️',
  star: '⭐',
  fire: '🔥',
  lightning: '⚡',
  crown: '👑',
  diamond: '💎',
  rocket: '🚀',
  universe: '🌌',
  credits: '💰',
};

export const LiveStreamViewerWebRTC = ({ streamId, onClose }: LiveStreamViewerWebRTCProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sfuRef = useRef<CloudflareStreamSFU | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number; y: number; senderName?: string }[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [connectionNotified, setConnectionNotified] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  
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
          if (sfuRef.current) {
            sfuRef.current.destroy();
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

  // SFU-based WebRTC connection
  useEffect(() => {
    if (stream?.status !== 'live') return;

    let isMounted = true;
    let hasNotifiedConnection = false;
    let retryInterval: NodeJS.Timeout | null = null;

    const setupSFUConnection = async () => {
      console.log("[Viewer-SFU] Setting up SFU connection for stream:", streamId);
      setConnectionStatus('connecting');
      setIsConnecting(true);

      try {
        // Cleanup previous connection
        if (sfuRef.current) {
          sfuRef.current.destroy();
          sfuRef.current = null;
        }

        const sfu = new CloudflareStreamSFU(streamId, 'viewer');
        sfuRef.current = sfu;

        // Initialize viewer - the SFU class handles fetching host session internally
        await sfu.initializeViewer((track, stream) => {
          console.log("[Viewer-SFU] Received track via callback:", track.kind);
          if (videoRef.current) {
            if (videoRef.current.srcObject !== stream) {
              videoRef.current.srcObject = stream;
            }
            setHasVideo(true);
            setIsConnecting(false);
            setConnectionStatus('connected');

            if (!hasNotifiedConnection) {
              hasNotifiedConnection = true;
              toast.success('Connected to stream!');
            }

            track.onended = () => {
              console.log("[Viewer-SFU] Track ended:", track.kind);
              setHasVideo(false);
            };
          }
        });

        // Check connection state
        if (sfu.isConnected()) {
          setIsConnecting(false);
          setConnectionStatus('connected');
        }

      } catch (err) {
        console.error("[Viewer-SFU] Error setting up connection:", err);
        setConnectionStatus('failed');
      }
    };

    setupSFUConnection();

    // Retry connection every 5 seconds if not connected
    retryInterval = setInterval(() => {
      if (connectionStatus !== 'connected' && isMounted && stream?.status === 'live') {
        console.log("[Viewer-SFU] Retrying connection...");
        setupSFUConnection();
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (retryInterval) clearInterval(retryInterval);
      if (sfuRef.current) {
        sfuRef.current.destroy();
        sfuRef.current = null;
      }
    };
  }, [stream?.status, streamId]);

  // Subscribe to comments
  useEffect(() => {
    const fetchComments = async () => {
      const { data: commentsData } = await supabase
        .from("live_stream_comments")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);

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
      })));
    };

    fetchComments();

    const channel = supabase
      .channel(`comments-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();

        setComments(prev => [...prev, { ...payload.new, profiles: profile }]);
      })
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

  // Subscribe to reactions - show who sent them
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        // Fetch sender profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", payload.new.user_id)
          .single();

        const senderName = profile?.display_name || profile?.username || 'Someone';

        const newReaction = { 
          type: payload.new.reaction_type, 
          id: Date.now() + Math.random(),
          x: Math.random() * 40 + 55,
          y: Math.random() * 30 + 40,
          senderName,
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

  // Subscribe to gifts - TikTok style with sender names
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
          .select("display_name, username")
          .eq("id", payload.new.sender_id)
          .single();

        const newGift = {
          id: payload.new.id,
          gift_type: payload.new.gift_type,
          sender_name: senderProfile?.display_name || senderProfile?.username || 'Someone',
          credit_value: payload.new.credit_value,
        };
        
        setFlyingGifts(prev => [...prev, newGift]);
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
        }, 5000);
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
    return GIFT_EMOJIS[type] || '🎁';
  };

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex">
      {/* Desktop: 9:16 centered video with side chat */}
      <div className="hidden lg:flex w-full h-full">
        {/* Left spacer */}
        <div className="flex-1 bg-black/95" />
        
        {/* Center: 9:16 Video Container */}
        <div className="relative h-full" style={{ aspectRatio: '9/16', maxWidth: '100vh' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className="w-full h-full object-cover"
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

          {/* Top Header */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 z-20">
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
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-white/80 text-xs mt-2 line-clamp-1">{stream.title}</p>
          </div>

          {/* Flying Gift Notifications - TikTok style */}
          <AnimatePresence>
            {flyingGifts.map((gift, index) => (
              <motion.div
                key={gift.id}
                initial={{ 
                  opacity: 0, 
                  scale: 0,
                  x: '-50%',
                  y: 100
                }}
                animate={{ 
                  opacity: [0, 1, 1, 1, 0],
                  scale: [0.5, 1.2, 1, 1, 0.8],
                  y: [100, 0, 0, -50, -150],
                }}
                exit={{ 
                  opacity: 0,
                  scale: 0.5,
                  y: -200
                }}
                transition={{ 
                  duration: 4,
                  ease: "easeOut",
                  times: [0, 0.15, 0.3, 0.7, 1]
                }}
                className="absolute left-1/2 top-1/3 z-50 pointer-events-none"
                style={{ marginTop: index * 80 }}
              >
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white px-6 py-3 rounded-full shadow-2xl">
                  <motion.span 
                    className="text-4xl"
                    animate={{ 
                      scale: [1, 1.3, 1],
                      rotate: [0, 10, -10, 0]
                    }}
                    transition={{ 
                      duration: 0.5, 
                      repeat: 3,
                      repeatType: "reverse"
                    }}
                  >
                    {getGiftEmoji(gift.gift_type)}
                  </motion.span>
                  <div className="text-left">
                    <p className="font-bold text-lg whitespace-nowrap">
                      {gift.sender_name}
                    </p>
                    <p className="text-sm text-white/90">
                      sent <span className="font-bold">{gift.gift_type}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                    <Coins className="w-4 h-4" />
                    <span className="font-bold">+{gift.credit_value}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Floating Reactions with sender names */}
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
                className="absolute text-4xl pointer-events-none z-30 flex flex-col items-center"
                style={{
                  right: `${100 - reaction.x}%`,
                  bottom: `${reaction.y}%`,
                }}
              >
                <span>{getReactionEmoji(reaction.type)}</span>
                {reaction.senderName && (
                  <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
                    {reaction.senderName}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Reaction Buttons */}
          <div className="absolute right-3 flex flex-col gap-3 z-20" style={{ bottom: '120px' }}>
            {REACTIONS.map((reaction) => (
              <motion.button
                key={reaction.type}
                whileTap={{ scale: 0.85 }}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10"
                onClick={() => sendReaction(reaction.type)}
              >
                <span className="text-2xl">{reaction.emoji}</span>
              </motion.button>
            ))}
            
            <motion.button
              whileTap={{ scale: 0.85 }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg"
              onClick={() => setShowGiftModal(true)}
            >
              <Gift className="w-6 h-6 text-white" />
            </motion.button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20">
            <div className="flex items-center justify-center gap-2 mb-3">
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
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Chat Panel for Desktop */}
        <div className="w-96 bg-background/95 border-l border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Live Chat
            </h3>
            <p className="text-sm text-muted-foreground">{comments.length} messages</p>
          </div>

          <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 items-start">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={comment.profiles?.avatar_url} />
                    <AvatarFallback className="text-xs bg-primary/20">
                      {comment.profiles?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-primary">
                      {comment.profiles?.display_name || 'Anonymous'}
                    </span>
                    <p className="text-sm break-words">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={chatInputRef}
                placeholder="Say something..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                className="flex-1"
              />
              <Button size="icon" onClick={sendComment} disabled={!newComment.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Full screen video */}
      <div className="lg:hidden absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
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
              right: '80px',
            }}
          >
            <div 
              ref={chatScrollRef}
              className="overflow-y-auto px-3 space-y-2 pointer-events-auto"
              style={{ maxHeight: '40vh' }}
            >
              <AnimatePresence>
                {comments.slice(-15).map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-2"
                  >
                    <Avatar className="w-7 h-7 shrink-0 border border-white/20">
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-primary/50">
                        {comment.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-3 py-1.5 max-w-[85%]">
                      <span className="text-primary text-xs font-semibold">
                        {comment.profiles?.display_name || 'Anonymous'}
                      </span>
                      <p className="text-white text-sm break-words">{comment.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Flying Gift Notifications - TikTok style */}
        <AnimatePresence>
          {flyingGifts.map((gift, index) => (
            <motion.div
              key={gift.id}
              initial={{ 
                opacity: 0, 
                scale: 0,
                x: '-50%',
                y: 100
              }}
              animate={{ 
                opacity: [0, 1, 1, 1, 0],
                scale: [0.5, 1.2, 1, 1, 0.8],
                y: [100, 0, 0, -50, -150],
              }}
              exit={{ 
                opacity: 0,
                scale: 0.5,
                y: -200
              }}
              transition={{ 
                duration: 4,
                ease: "easeOut",
                times: [0, 0.15, 0.3, 0.7, 1]
              }}
              className="fixed left-1/2 top-1/3 z-50 pointer-events-none"
              style={{ marginTop: index * 80 }}
            >
              <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white px-5 py-2.5 rounded-full shadow-2xl">
                <motion.span 
                  className="text-3xl"
                  animate={{ 
                    scale: [1, 1.3, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 0.5, 
                    repeat: 3,
                    repeatType: "reverse"
                  }}
                >
                  {getGiftEmoji(gift.gift_type)}
                </motion.span>
                <div className="text-left">
                  <p className="font-bold text-base whitespace-nowrap">
                    {gift.sender_name}
                  </p>
                  <p className="text-xs text-white/90">
                    sent <span className="font-bold">{gift.gift_type}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  <Coins className="w-3 h-3" />
                  <span className="font-bold">+{gift.credit_value}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Floating Reactions with sender names */}
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
              className="absolute text-4xl pointer-events-none z-30 flex flex-col items-center"
              style={{
                right: `${100 - reaction.x}%`,
                bottom: `${reaction.y}%`,
              }}
            >
              <span>{getReactionEmoji(reaction.type)}</span>
              {reaction.senderName && (
                <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
                  {reaction.senderName}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Right Side Reaction Buttons */}
        <div 
          className="absolute right-3 flex flex-col gap-2 z-20"
          style={{
            bottom: isKeyboardOpen ? `${keyboardHeight + 130}px` : '190px',
          }}
        >
          {REACTIONS.map((reaction) => (
            <motion.button
              key={reaction.type}
              whileTap={{ scale: 0.85 }}
              className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 active:bg-white/20 transition-colors"
              onClick={() => sendReaction(reaction.type)}
            >
              <span className="text-2xl">{reaction.emoji}</span>
            </motion.button>
          ))}
          
          {/* Gift Button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg"
            onClick={() => setShowGiftModal(true)}
          >
            <Gift className="w-6 h-6 text-white" />
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