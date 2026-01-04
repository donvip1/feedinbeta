import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Send, Heart, X, Gift, 
  Volume2, VolumeX, Flame, 
  ThumbsUp, Star, Sparkles, 
  MessageCircle, Home, Share2, Crown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useCloudflarePlayback } from "@/hooks/useCloudflarePlayback";
import { StreamReadyGate } from "./StreamReadyGate";
import { StreamHealthIndicator } from "./StreamHealthIndicator";

interface LiveStreamPlayerV2Props {
  streamId: string;
  onClose: () => void;
}

import { PartyPopper, Coins } from "lucide-react";
import { LiveChatMessage } from "./LiveChatMessage";

const REACTIONS = [
  { type: 'heart', emoji: '❤️', icon: Heart, color: 'text-red-500' },
  { type: 'fire', emoji: '🔥', icon: Flame, color: 'text-orange-500' },
  { type: 'star', emoji: '⭐', icon: Star, color: 'text-yellow-500' },
  { type: 'clap', emoji: '👏', icon: PartyPopper, color: 'text-purple-500' },
  { type: 'like', emoji: '👍', icon: ThumbsUp, color: 'text-blue-500' },
  { type: 'love', emoji: '😍', icon: Sparkles, color: 'text-pink-500' },
];

const GIFT_EMOJIS: Record<string, string> = {
  heart: '❤️', star: '⭐', fire: '🔥', lightning: '⚡', 
  crown: '👑', diamond: '💎', rocket: '🚀', credits: '💰',
};

export const LiveStreamPlayerV2 = ({ streamId, onClose }: LiveStreamPlayerV2Props) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [reactions, setReactions] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Use the new Cloudflare playback hook
  const {
    status,
    method,
    hasVideo,
    isBuffering,
    showUnmutePrompt,
    errorMessage,
    connectionQuality,
    unmute,
    retry,
    cleanup,
  } = useCloudflarePlayback({
    hlsUrl: stream?.cf_hls_url,
    whepUrl: stream?.cf_webrtc_url,
    videoRef,
    streamReady: stream?.stream_ready || stream?.status === 'live',
  });

  // Check if current user is the host
  const isHost = useMemo(() => {
    return currentUser?.id && stream?.user_id && currentUser.id === stream.user_id;
  }, [currentUser, stream]);

  // Fetch initial data
  useEffect(() => {
    const init = async () => {
      console.log("[PlayerV2] Initializing for stream:", streamId);
      
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: streamData, error } = await supabase
        .from("live_streams_public")
        .select("*")
        .eq("id", streamId)
        .maybeSingle();

      if (error || !streamData) {
        console.error("[PlayerV2] Failed to load stream:", error);
        toast.error("Stream not found");
        onClose();
        return;
      }

      console.log("[PlayerV2] Stream data:", {
        id: streamData.id,
        status: streamData.status,
        stream_ready: streamData.stream_ready,
        cf_hls_url: streamData.cf_hls_url,
      });

      // Fetch host profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", streamData.user_id)
        .single();

      setStream({ ...streamData, profiles: profile });
      setViewerCount(streamData.viewer_count || 0);
    };

    init();
  }, [streamId, onClose]);

  // Handle unmute
  const handleUnmute = useCallback(async () => {
    await unmute();
    setIsMuted(false);
  }, [unmute]);

  // Join as viewer
  useEffect(() => {
    if (!currentUser || isHost) return;
    
    const joinStream = async () => {
      const { data } = await supabase
        .from("live_stream_viewers")
        .insert({ stream_id: streamId, user_id: currentUser.id, is_active: true })
        .select()
        .single();
      
      if (data) setViewerSession(data.id);
    };
    
    joinStream();
    
    return () => {
      if (viewerSession) {
        supabase.from("live_stream_viewers")
          .delete()
          .eq("id", viewerSession)
          .then(() => {});
      }
    };
  }, [streamId, currentUser, isHost, viewerSession]);

  // Subscribe to stream status
  useEffect(() => {
    const channel = supabase
      .channel(`stream-status-v2-${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`,
      }, (payload: any) => {
        console.log("[PlayerV2] Stream status changed:", payload.new.status);
        
        if (payload.new.status === 'ended') {
          toast.info("Stream has ended");
          cleanup();
          setTimeout(() => {
            onClose();
            navigate('/live');
          }, 1500);
        }
        
        setStream((prev: any) => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, onClose, navigate, cleanup]);

  // Subscribe to viewer count
  useEffect(() => {
    const channel = supabase.channel(`viewers-v2-${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, async () => {
        const { count } = await supabase
          .from("live_stream_viewers")
          .select("*", { count: 'exact', head: true })
          .eq("stream_id", streamId)
          .eq("is_active", true);
        
        setViewerCount(count || 0);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Subscribe to comments
  useEffect(() => {
    const fetchComments = async () => {
      const { data: commentsData } = await supabase
        .from("live_stream_comments")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (commentsData) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setComments(commentsData.map(c => ({
          ...c,
          profiles: profileMap.get(c.user_id),
        })));
      }
    };

    fetchComments();

    const channel = supabase.channel(`comments-v2-${streamId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'live_stream_comments', 
        filter: `stream_id=eq.${streamId}` 
      }, async (payload) => {
        if (payload.new.user_id === currentUser?.id) return;
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();
        
        setComments(prev => [...prev, { ...payload.new, profiles: profile }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, currentUser]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase.channel(`reactions-v2-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", payload.new.user_id)
          .single();

        const reaction = {
          type: payload.new.reaction_type,
          id: Date.now() + Math.random(),
          x: Math.random() * 40 + 55,
          y: Math.random() * 30 + 40,
          senderName: profile?.display_name || profile?.username,
        };
        
        setReactions(prev => [...prev, reaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Subscribe to gifts
  useEffect(() => {
    const channel = supabase.channel(`gifts-v2-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        const { data: sender } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", payload.new.sender_id)
          .single();

        const gift = {
          id: payload.new.id,
          gift_type: payload.new.gift_type,
          sender_name: sender?.display_name || sender?.username || 'Someone',
          credit_value: payload.new.credit_value,
        };
        
        setFlyingGifts(prev => [...prev, gift]);
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g.id !== gift.id));
        }, 5000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Fetch viewers for gift modal
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

  // Send comment
  const sendComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const tempComment = {
      id: `temp-${Date.now()}`,
      content: newComment.trim(),
      user_id: currentUser.id,
      profiles: { 
        display_name: currentUser.user_metadata?.display_name || 'Me',
        avatar_url: currentUser.user_metadata?.avatar_url,
      },
      created_at: new Date().toISOString(),
    };
    
    setComments(prev => [...prev, tempComment]);
    setNewComment("");

    const { error } = await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: currentUser.id,
      content: tempComment.content,
    });

    if (error) {
      toast.error("Failed to send");
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
    }
  };

  // Send reaction
  const sendReaction = async (reactionType: string) => {
    if (!currentUser) {
      toast.error("Please log in to react");
      return;
    }

    // Optimistic local reaction
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
      user_id: currentUser.id,
      reaction_type: reactionType,
    });
  };

  // Share stream
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/stream/${streamId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: stream?.title, url: shareUrl });
        return;
      } catch (e) {}
    }
    
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  // Loading state
  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Determine gate status
  const getGateStatus = () => {
    if (stream.status === 'scheduled') return 'scheduled';
    if (status === 'error') return 'error';
    if (status === 'waiting') return 'waiting';
    if (status === 'connecting') return 'connecting';
    if (status === 'buffering') return 'buffering';
    return null;
  };

  const gateStatus = getGateStatus();

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* VIDEO */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />

        {/* Stream ready gate */}
        {gateStatus && (
          <StreamReadyGate
            status={gateStatus}
            message={errorMessage || undefined}
            scheduledTime={stream.scheduled_start ? new Date(stream.scheduled_start) : undefined}
            onRetry={retry}
            onGoBack={onClose}
          />
        )}

        {/* Tap to unmute */}
        {hasVideo && isMuted && showUnmutePrompt && !gateStatus && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer"
            onClick={handleUnmute}
          >
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="bg-black/70 backdrop-blur-sm px-6 py-4 rounded-2xl flex items-center gap-3"
            >
              <VolumeX className="w-8 h-8 text-white" />
              <span className="text-white font-medium text-lg">Tap to Unmute</span>
            </motion.div>
          </motion.div>
        )}

        {/* Stream ended state */}
        {stream.status === 'ended' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-5xl mb-4">📺</div>
              <h3 className="text-xl font-bold text-white mb-2">Stream Ended</h3>
              <p className="text-muted-foreground">This stream has ended</p>
              <Button className="mt-4" onClick={() => navigate('/live')}>
                Browse Other Streams
              </Button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 z-20 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="border-2 border-primary w-10 h-10">
                <AvatarImage src={stream.profiles?.avatar_url} />
                <AvatarFallback>{stream.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm">{stream.profiles?.display_name}</p>
                  {stream.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                </div>
                <p className="text-white/70 text-xs">{stream.title}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <StreamHealthIndicator 
                quality={connectionQuality}
                isBuffering={isBuffering}
                isConnecting={status === 'connecting'}
              />
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {viewerCount}
              </Badge>
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
        </div>

        {/* FLOATING REACTIONS */}
        <AnimatePresence>
          {reactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 100, x: `${reaction.x}%` }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -100 }}
              transition={{ duration: 2 }}
              className="fixed z-30"
              style={{ left: `${reaction.x}%`, top: `${reaction.y}%` }}
            >
              <span className="text-3xl">{REACTIONS.find(r => r.type === reaction.type)?.emoji || '❤️'}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* FLYING GIFTS - Enhanced Animation */}
        <AnimatePresence>
          {flyingGifts.map((gift, index) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, scale: 0, x: '-50%', y: 100 }}
              animate={{ 
                opacity: [0, 1, 1, 1, 0],
                scale: [0.5, 1.2, 1, 1, 0.8],
                y: [100, 0, 0, -50, -150],
              }}
              exit={{ opacity: 0, scale: 0.5, y: -200 }}
              transition={{ duration: 4, ease: "easeOut", times: [0, 0.15, 0.3, 0.7, 1] }}
              className="fixed left-1/2 top-1/3 z-50 pointer-events-none"
              style={{ marginTop: index * 80 }}
            >
              <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white px-5 py-2.5 rounded-full shadow-2xl">
                <motion.span 
                  className="text-3xl"
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 3, repeatType: "reverse" }}
                >
                  {GIFT_EMOJIS[gift.gift_type] || '🎁'}
                </motion.span>
                <div className="text-left">
                  <p className="font-bold text-base whitespace-nowrap">{gift.sender_name}</p>
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

        {/* CHAT OVERLAY - TikTok Style */}
        {showChat && (
          <div 
            className="absolute left-0 z-20 pointer-events-none"
            style={{
              bottom: isKeyboardOpen ? `${keyboardHeight + 60}px` : '140px',
              maxHeight: '35vh',
              right: '70px',
            }}
          >
            <div 
              ref={chatScrollRef}
              className="overflow-y-auto px-3 space-y-1.5 pointer-events-auto"
              style={{ maxHeight: '35vh' }}
            >
              <AnimatePresence>
                {comments.slice(-20).map(comment => (
                  <LiveChatMessage
                    key={comment.id}
                    id={comment.id}
                    content={comment.content}
                    userId={comment.user_id}
                    hostId={stream.user_id}
                    profile={comment.profiles}
                    isCompact={true}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* RIGHT SIDE ACTIONS - All Reactions */}
        <div 
          className="absolute right-3 flex flex-col gap-2 z-20"
          style={{
            bottom: isKeyboardOpen ? `${keyboardHeight + 130}px` : '200px',
          }}
        >
          {REACTIONS.map((r) => (
            <motion.button
              key={r.type}
              whileTap={{ scale: 0.85 }}
              onClick={() => sendReaction(r.type)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-2xl hover:scale-110 transition-transform active:scale-90"
            >
              {r.emoji}
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowGiftModal(true)}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <Gift className="w-6 h-6 text-white" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Share2 className="w-5 h-5 text-white" />
          </motion.button>
        </div>

        {/* BOTTOM INPUT */}
        <div 
          className="absolute left-0 right-0 bottom-0 p-4 z-20"
          style={{ paddingBottom: Math.max(16, isKeyboardOpen ? keyboardHeight + 8 : 16) }}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/40 hover:bg-black/60 rounded-full"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </Button>
            
            <div className="flex-1 relative">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                placeholder="Say something..."
                className="bg-black/40 border-white/20 text-white placeholder:text-white/50 rounded-full pr-12"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-white/20"
                onClick={sendComment}
              >
                <Send className="w-4 h-4 text-white" />
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/40 hover:bg-black/60 rounded-full"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className={cn("w-5 h-5", showChat ? "text-primary" : "text-white")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Gift Modal */}
      {showGiftModal && (
        <LiveGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          streamId={streamId}
          hostId={stream.user_id}
          viewers={viewers}
          isHost={isHost}
        />
      )}
    </div>
  );
};
