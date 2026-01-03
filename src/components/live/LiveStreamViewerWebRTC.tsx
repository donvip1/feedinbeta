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
  PartyPopper, ThumbsUp, Star, Sparkles, 
  MessageCircle, Home, Coins, Share2, Crown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useStreamPlayback } from "@/hooks/useStreamPlayback";

interface LiveStreamViewerWebRTCProps {
  streamId: string;
  onClose: () => void;
}

// TikTok style reactions
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
  crown: '👑', diamond: '💎', rocket: '🚀', universe: '🌌', credits: '💰',
};

export const LiveStreamViewerWebRTC = ({ streamId, onClose }: LiveStreamViewerWebRTCProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number; y: number; senderName?: string }[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [realtimeViewerCount, setRealtimeViewerCount] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Use the new stream playback hook
  const {
    status: connectionStatus,
    hasVideo,
    showUnmutePrompt,
    unmute,
    cleanup: cleanupPlayback,
  } = useStreamPlayback({
    cfHlsUrl: stream?.cf_hls_url,
    cfWhepUrl: stream?.cf_webrtc_url,
    videoRef,
  });

  // Check if current user is the host
  const isHost = useMemo(() => {
    return currentUser?.id && stream?.user_id && currentUser.id === stream.user_id;
  }, [currentUser, stream]);

  // 1. Initial Data Fetch & Auth
  useEffect(() => {
    const init = async () => {
      console.log("[Viewer] Initializing stream viewer for:", streamId);
      
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Query from live_streams_public view - accessible to all users
      const { data: streamData, error } = await supabase
        .from("live_streams_public")
        .select(`*, profiles:user_id (id, display_name, username, avatar_url)`)
        .eq("id", streamId)
        .maybeSingle();

      if (error || !streamData) {
        console.error("[Viewer] Failed to load stream:", error);
        toast.error("Failed to load stream");
        onClose();
        return;
      }

      console.log("[Viewer] Stream data loaded:", {
        id: streamData.id,
        title: streamData.title,
        status: streamData.status,
        cf_hls_url: streamData.cf_hls_url,
        cf_webrtc_url: streamData.cf_webrtc_url,
      });

      setStream(streamData);
      setRealtimeViewerCount(streamData.viewer_count || 0);
    };
    init();
  }, [streamId, onClose]);

  // Handle unmute with the hook's unmute function
  const handleUserInteraction = useCallback(async () => {
    await unmute();
    setIsMuted(false);
  }, [unmute]);

  // Real-time Viewer Counting via postgres_changes
  useEffect(() => {
    const channel = supabase.channel(`viewers-${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRealtimeViewerCount(prev => prev + 1);
        } else if (payload.eventType === 'DELETE') {
          setRealtimeViewerCount(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Join Logic
  useEffect(() => {
    if (!currentUser) return;
    
    const joinStream = async () => {
      const { data } = await supabase
        .from("live_stream_viewers")
        .insert({ stream_id: streamId, user_id: currentUser.id, is_active: true })
        .select().single();
      if (data) setViewerSession(data.id);
    };
    joinStream();
    
    return () => {
      if (viewerSession) {
        supabase.from("live_stream_viewers")
          .delete().eq("id", viewerSession).then(() => {});
      }
    };
  }, [streamId, currentUser, viewerSession]);

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

  // Subscribe to stream status changes
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
          cleanupPlayback();
          setTimeout(() => {
            onClose();
            navigate('/live');
          }, 1500);
        }
        setStream((prev: any) => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, onClose, navigate, cleanupPlayback]);

  // Chat Logic with Optimistic UI
  const sendComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      content: newComment.trim(),
      user_id: currentUser.id,
      profiles: { 
        display_name: currentUser.user_metadata?.display_name || 'Me',
        avatar_url: currentUser.user_metadata?.avatar_url,
        username: currentUser.user_metadata?.username
      },
      created_at: new Date().toISOString()
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
      setComments(prev => prev.filter(c => c.id !== tempId));
    }
  };

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

    const channel = supabase.channel(`comments-${streamId}`)
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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase.channel(`reactions-${streamId}`)
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

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Subscribe to gifts
  useEffect(() => {
    const channel = supabase.channel(`gifts-${streamId}`)
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

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  const sendReaction = async (reactionType: string) => {
    if (!currentUser) {
      toast.error("Please log in to react");
      return;
    }

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

  const getGiftEmoji = (type: string) => GIFT_EMOJIS[type] || '🎁';

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* VIDEO CONTAINER */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />

        {/* CONNECTION LOADING STATE */}
        {connectionStatus === 'connecting' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-white">Connecting to Host...</p>
            </div>
          </div>
        )}

        {/* Stream ended/scheduled state */}
        {stream.status !== 'live' && connectionStatus !== 'connecting' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              {stream.status === 'scheduled' ? (
                <>
                  <div className="text-5xl mb-4">📡</div>
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

        {/* TAP TO UNMUTE OVERLAY */}
        {hasVideo && isMuted && showUnmutePrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer"
            onClick={handleUserInteraction}
          >
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="bg-black/70 backdrop-blur-sm px-6 py-4 rounded-2xl flex items-center gap-3"
            >
              <VolumeX className="w-8 h-8 text-white" />
              <span className="text-white font-medium text-lg">Tap to Join Audio</span>
            </motion.div>
          </motion.div>
        )}

        {/* HEADER OVERLAY */}
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
                    {realtimeViewerCount}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="secondary" className="rounded-full text-xs h-7">
                Follow
              </Button>
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

        {/* TIKTOK STYLE FLOATING CHAT */}
        {showChat && stream.status === 'live' && (
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
                {comments.slice(-20).map((comment) => {
                  const isMsgHost = comment.user_id === stream.user_id;
                  return (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2"
                    >
                      <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-3 py-1.5 max-w-full">
                        <span className={cn(
                          "font-semibold text-xs mr-2",
                          isMsgHost ? "text-amber-400" : "text-primary"
                        )}>
                          {isMsgHost && <Crown className="w-3 h-3 inline mr-1" />}
                          {isMsgHost ? "Host" : (comment.profiles?.display_name || "User")}
                        </span>
                        <span className="text-white text-sm">{comment.content}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Right Side Actions */}
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
        </div>

        {/* Bottom Input Area */}
        <div 
          className="absolute left-0 right-0 bg-gradient-to-t from-black/80 to-transparent z-20 p-3"
          style={{
            bottom: isKeyboardOpen ? `${keyboardHeight}px` : '0',
            paddingBottom: isKeyboardOpen ? '8px' : 'max(env(safe-area-inset-bottom), 16px)',
          }}
        >
          {/* Controls */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white hover:bg-white/20 h-10 w-10 bg-black/30"
              onClick={() => {
                setIsMuted(!isMuted);
                if (videoRef.current) videoRef.current.muted = !isMuted;
              }}
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
          </div>

          {/* Chat Input */}
          {showChat && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={chatInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={isHost ? "Reply to your viewers..." : "Say something..."}
                  className="bg-white/10 border-white/10 rounded-full text-white placeholder:text-white/50 pl-4 pr-10 h-11 focus-visible:ring-primary/50"
                  onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                />
                <Button 
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white"
                  onClick={sendComment}
                  disabled={!newComment.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-white hover:bg-white/20 h-11 w-11 bg-black/30"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Flying Gift Animations */}
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
                  {getGiftEmoji(gift.gift_type)}
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

        {/* Floating Reactions */}
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 1, scale: 0, y: 0 }}
              animate={{ 
                opacity: [1, 1, 0],
                scale: [0.5, 1.5, 1],
                y: -200,
                x: Math.random() * 40 - 20,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="fixed z-40 text-4xl pointer-events-none"
              style={{ 
                right: `${reaction.x}px`,
                bottom: '30%',
              }}
            >
              {REACTIONS.find(r => r.type === reaction.type)?.emoji || '❤️'}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={stream.user_id}
        viewers={viewers}
        isHost={isHost}
      />
    </div>
  );
};
