import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Send, Heart, Gift, 
  Volume2, VolumeX, Flame, 
  PartyPopper, ThumbsUp, Star, Sparkles, 
  MessageCircle, Home, Loader2, RefreshCw, ArrowLeft
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { FloatingReactions } from "./FloatingReactions";
import { FlyingChat } from "./FlyingChat";
import { useCloudflarePlayback } from "@/hooks/useCloudflarePlayback";

interface SimpleViewerProps {
  streamId: string;
  onClose: () => void;
}

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

export const SimpleViewer = ({ streamId, onClose }: SimpleViewerProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number; y: number }[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [realtimeViewerCount, setRealtimeViewerCount] = useState(0);
  
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Use Cloudflare HLS playback
  const { 
    status: playbackStatus, 
    hasVideo, 
    showUnmutePrompt,
    errorMessage,
    unmute: playbackUnmute,
    retry: playbackRetry,
    cleanup: playbackCleanup,
  } = useCloudflarePlayback({
    hlsUrl: stream?.cf_hls_url,
    videoRef,
    streamReady: stream?.stream_ready,
    onStatusChange: (status) => {
      console.log('[Viewer] Playback status:', status);
    },
  });

  // Check if current user is the host
  const isHost = useMemo(() => {
    return currentUser?.id && stream?.user_id && currentUser.id === stream.user_id;
  }, [currentUser, stream]);

  // Initial Data Fetch & Auth
  useEffect(() => {
    const init = async () => {
      console.log("[Viewer] Initializing for stream:", streamId);
      
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Fetch stream data from live_streams table
      const { data: streamData, error: streamError } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .maybeSingle();

      if (streamError) {
        console.error("[Viewer] Failed to load stream:", streamError);
        toast.error("Failed to load stream");
        onClose();
        return;
      }

      if (!streamData) {
        console.error("[Viewer] Stream not found");
        toast.error("Stream not found");
        onClose();
        return;
      }

      // Fetch profile data separately
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", streamData.user_id)
        .maybeSingle();

      const fullStreamData = {
        ...streamData,
        profiles: profileData
      };

      console.log("[Viewer] Stream data loaded:", fullStreamData);
      console.log("[Viewer] HLS URL:", fullStreamData.cf_hls_url);
      console.log("[Viewer] Stream ready:", fullStreamData.stream_ready);
      
      setStream(fullStreamData);
      setRealtimeViewerCount(streamData.viewer_count || 0);
    };
    init();
    
    return () => {
      playbackCleanup();
    };
  }, [streamId, onClose]);

  // Handle unmute
  const handleUnmute = useCallback(async () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      try {
        await videoRef.current.play();
        setIsMuted(false);
        playbackUnmute();
      } catch (e) {
        console.log('[Viewer] Unmute failed:', e);
      }
    }
  }, [playbackUnmute]);

  // Real-time Viewer Counting
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

  // Join Logic - only once when currentUser is available
  useEffect(() => {
    if (!currentUser || viewerSession) return;
    
    let sessionId: string | null = null;
    
    const joinStream = async () => {
      const { data } = await supabase
        .from("live_stream_viewers")
        .insert({ stream_id: streamId, user_id: currentUser.id, is_active: true })
        .select().single();
      if (data) {
        sessionId = data.id;
        setViewerSession(data.id);
      }
    };
    joinStream();
    
    return () => {
      const idToDelete = sessionId || viewerSession;
      if (idToDelete) {
        supabase.from("live_stream_viewers")
          .delete().eq("id", idToDelete).then(() => {});
      }
    };
  }, [streamId, currentUser?.id]); // Remove viewerSession from deps to prevent infinite loop

  // Subscribe to stream status changes (for HLS URL updates)
  useEffect(() => {
    const channel = supabase
      .channel(`stream-status-${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`,
      }, (payload: any) => {
        console.log("[Viewer] Stream update:", payload.new.status, 'ready:', payload.new.stream_ready);
        
        if (payload.new.status === 'ended') {
          toast.info("Stream has ended");
          playbackCleanup();
          setTimeout(() => {
            onClose();
            navigate('/live');
          }, 1500);
        }
        
        // Update stream data including HLS URL and stream_ready
        setStream((prev: any) => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, onClose, navigate, playbackCleanup]);

  // Chat Logic
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

  // Auto-scroll chat
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
      }, (payload: any) => {
        const newReaction = { 
          type: payload.new.reaction_type, 
          id: Date.now() + Math.random(),
          x: Math.random() * 40 + 55,
          y: Math.random() * 30 + 40,
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

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const REACTION_EMOJIS: Record<string, string> = {
    heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
  };

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
        {(playbackStatus === 'connecting' || playbackStatus === 'waiting') && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-white">
                {playbackStatus === 'waiting' ? 'Waiting for stream...' : 'Connecting to stream...'}
              </p>
              {stream?.cf_hls_url && (
                <p className="text-muted-foreground text-sm mt-2">Using HLS playback</p>
              )}
            </div>
          </div>
        )}

        {/* BUFFERING STATE */}
        {playbackStatus === 'buffering' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-2" />
              <p className="text-white/80 text-sm">Buffering...</p>
            </div>
          </div>
        )}

        {/* CONNECTION FAILED STATE */}
        {playbackStatus === 'error' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-5xl mb-4">📡</div>
              <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
              <p className="text-muted-foreground mb-4">{errorMessage || 'Unable to connect to stream'}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={onClose}>
                  Go Back
                </Button>
                <Button onClick={playbackRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stream ended/scheduled state */}
        {stream.status !== 'live' && playbackStatus !== 'connecting' && playbackStatus !== 'waiting' && (
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
      </div>

      {/* Floating Reactions */}
      <FloatingReactions reactions={reactions.map(r => ({
        id: r.id,
        type: r.type,
      }))} />

      {/* Flying Gifts */}
      <AnimatePresence>
        {flyingGifts.map(gift => (
          <motion.div
            key={gift.id}
            initial={{ opacity: 0, x: -100, y: '50%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed left-4 top-1/2 z-50 bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2"
          >
            <span className="text-2xl">{GIFT_EMOJIS[gift.gift_type] || '🎁'}</span>
            <span className="text-white font-medium">{gift.sender_name} sent {gift.credit_value} credits!</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* HEADER OVERLAY */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 z-20 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="border-2 border-primary w-10 h-10">
              <AvatarImage src={stream.profiles?.avatar_url} />
              <AvatarFallback>{stream.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-medium text-sm">{stream.profiles?.display_name || stream.profiles?.username}</p>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">LIVE</Badge>
                <Badge variant="secondary" className="text-xs bg-black/50">
                  <Users className="w-3 h-3 mr-1" />
                  {realtimeViewerCount}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => navigate('/live')}
              title="Go back to streams"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      {showChat && (
        <div className="absolute left-0 right-0 bottom-40 px-4 z-10 pointer-events-none">
          <FlyingChat 
            messages={comments.slice(-10)}
            hostId={stream?.user_id}
          />
        </div>
      )}

      {/* BOTTOM CONTROLS */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20 safe-area-bottom"
        style={{ paddingBottom: isKeyboardOpen ? keyboardHeight + 16 : undefined }}
      >
        {/* REACTION BAR */}
        <div className="flex items-center justify-center gap-2 mb-4 overflow-x-auto">
          {REACTIONS.map((reaction) => (
            <Button
              key={reaction.type}
              variant="ghost"
              size="sm"
              className="rounded-full bg-white/10 hover:bg-white/20 min-w-10 h-10"
              onClick={() => sendReaction(reaction.type)}
            >
              <span className="text-xl">{reaction.emoji}</span>
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 min-w-10 h-10"
            onClick={() => setShowGiftModal(true)}
          >
            <Gift className="w-5 h-5 text-yellow-400" />
          </Button>
        </div>

        {/* CHAT INPUT */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Say something..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            onKeyPress={(e) => e.key === 'Enter' && sendComment()}
          />
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={sendComment}
          >
            <Send className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "text-white hover:bg-white/20",
              !isMuted && "bg-white/20"
            )}
            onClick={handleUnmute}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={stream.user_id}
        viewers={[]}
        isHost={false}
      />
    </div>
  );
};
