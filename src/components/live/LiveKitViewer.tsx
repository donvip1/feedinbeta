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
  MessageCircle, Loader2, RefreshCw, ArrowLeft, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { FloatingReactions } from "./FloatingReactions";
import { FlyingChat } from "./FlyingChat";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  ConnectionState,
} from "livekit-client";
import "@livekit/components-styles";

interface LiveKitViewerProps {
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

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
};

export const LiveKitViewer = ({ streamId, onClose }: LiveKitViewerProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  
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
  const [viewerCount, setViewerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Check if current user is the host
  const isHost = useMemo(() => {
    return currentUser?.id && stream?.user_id && currentUser.id === stream.user_id;
  }, [currentUser, stream]);

  // Connect to LiveKit room
  const connectToRoom = useCallback(async () => {
    if (!currentUser || !stream) return;

    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);

      console.log('[LiveKitViewer] Getting token...');

      // Get viewer token
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `stream-${streamId}`,
          participantName: currentUser.user_metadata?.display_name || currentUser.user_metadata?.username || 'Viewer',
          participantIdentity: currentUser.id,
          isHost: false,
        },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || 'Failed to get token');
      }

      console.log('[LiveKitViewer] Connecting to room...');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Handle connection state changes
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[LiveKitViewer] Connection state:', state);
        if (state === ConnectionState.Connected) {
          setConnectionStatus('connected');
          setViewerCount(room.remoteParticipants.size + 1);
        } else if (state === ConnectionState.Reconnecting) {
          setConnectionStatus('reconnecting');
        } else if (state === ConnectionState.Disconnected) {
          setConnectionStatus('error');
        }
      });

      // Handle track subscriptions
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log('[LiveKitViewer] Track subscribed:', track.kind);
        
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setHasVideo(true);
        } else if (track.kind === Track.Kind.Audio) {
          // Create audio element for audio track
          const audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.muted = isMuted;
          track.attach(audioEl);
          document.body.appendChild(audioEl);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        console.log('[LiveKitViewer] Track unsubscribed:', track.kind);
        track.detach();
        if (track.kind === Track.Kind.Video) {
          setHasVideo(false);
        }
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount(room.remoteParticipants.size + 1);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount(room.remoteParticipants.size + 1);
      });

      // Connect
      await room.connect(data.url, data.token);
      console.log('[LiveKitViewer] Connected!');

      // Subscribe to existing tracks
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.isSubscribed && publication.track) {
            const track = publication.track;
            if (track.kind === Track.Kind.Video && videoRef.current) {
              track.attach(videoRef.current);
              setHasVideo(true);
            } else if (track.kind === Track.Kind.Audio) {
              const audioEl = document.createElement('audio');
              audioEl.autoplay = true;
              audioEl.muted = isMuted;
              track.attach(audioEl);
              document.body.appendChild(audioEl);
            }
          }
        });
      });

    } catch (error: any) {
      console.error('[LiveKitViewer] Connection error:', error);
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Failed to connect');
    }
  }, [currentUser, stream, streamId, isMuted]);

  // Handle unmute
  const handleUnmute = useCallback(() => {
    setIsMuted(false);
    
    // Unmute all audio elements
    document.querySelectorAll('audio').forEach((audio) => {
      audio.muted = false;
    });
    
    if (videoRef.current) {
      videoRef.current.muted = false;
    }
    
    toast.success("Sound enabled!");
  }, []);

  // Initial data fetch
  useEffect(() => {
    const init = async () => {
      console.log("[LiveKitViewer] Initializing for stream:", streamId);
      
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: streamData, error: streamError } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .maybeSingle();

      if (streamError || !streamData) {
        console.error("[LiveKitViewer] Failed to load stream");
        toast.error("Stream not found");
        onClose();
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", streamData.user_id)
        .maybeSingle();

      setStream({ ...streamData, profiles: profileData });
      setViewerCount(streamData.viewer_count || 0);
    };
    
    init();
    
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      // Clean up audio elements
      document.querySelectorAll('audio').forEach((audio) => {
        audio.remove();
      });
    };
  }, [streamId, onClose]);

  // Connect when we have user and stream
  useEffect(() => {
    if (currentUser && stream && stream.status === 'live') {
      connectToRoom();
    }
  }, [currentUser, stream, connectToRoom]);

  // Join as viewer in database
  useEffect(() => {
    if (!currentUser || viewerSession) return;
    
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
        supabase.from("live_stream_viewers").delete().eq("id", viewerSession).then(() => {});
      }
    };
  }, [streamId, currentUser?.id]);

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
        if (payload.new.status === 'ended') {
          toast.info("Stream has ended");
          if (roomRef.current) {
            roomRef.current.disconnect();
          }
          setTimeout(() => {
            onClose();
            navigate('/live');
          }, 1500);
        }
        setStream((prev: any) => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, onClose, navigate]);

  // Chat logic
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
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
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

        {/* Connection states */}
        {connectionStatus === 'connecting' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-white">Connecting to stream...</p>
            </div>
          </div>
        )}

        {connectionStatus === 'reconnecting' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-yellow-400 mx-auto mb-2" />
              <p className="text-yellow-400">Reconnecting...</p>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-5xl mb-4">📡</div>
              <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
              <p className="text-muted-foreground mb-4">{errorMessage || 'Unable to connect'}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={onClose}>
                  Go Back
                </Button>
                <Button onClick={connectToRoom}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {connectionStatus === 'connected' && !hasVideo && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-2" />
              <p className="text-white">Waiting for video...</p>
            </div>
          </div>
        )}

        {/* Unmute prompt */}
        {connectionStatus === 'connected' && isMuted && hasVideo && (
          <Button
            onClick={handleUnmute}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-primary/90"
          >
            <Volume2 className="w-5 h-5 mr-2" />
            Tap to unmute
          </Button>
        )}

        {/* Stream ended */}
        {stream.status !== 'live' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-5xl mb-4">📺</div>
              <h3 className="text-xl font-bold text-white mb-2">Stream Ended</h3>
              <p className="text-muted-foreground mb-4">This stream has ended</p>
              <Button onClick={() => navigate('/live')}>
                Browse Other Streams
              </Button>
            </div>
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Floating Reactions */}
      <FloatingReactions reactions={reactions.map(r => ({ ...r, emoji: REACTION_EMOJIS[r.type] || '❤️' }))} />

      {/* Flying Gifts */}
      <FlyingChat messages={[]} gifts={flyingGifts} hostId={stream?.user_id} />

      {/* TOP HEADER */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-black/50"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </Button>
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarImage src={stream.profiles?.avatar_url} />
              <AvatarFallback>{stream.profiles?.display_name?.[0] || 'H'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-semibold text-sm">{stream.profiles?.display_name || stream.profiles?.username || 'Host'}</p>
              <p className="text-white/60 text-xs">{stream.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-red-500 text-white">
              LIVE
            </Badge>
            <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
              <Users className="w-4 h-4 text-white" />
              <span className="text-white text-sm">{viewerCount}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMuted(!isMuted)}
              className="h-10 w-10 rounded-full bg-black/50"
            >
              {isMuted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
            </Button>
          </div>
        </div>
      </div>

      {/* REACTIONS BAR */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 flex flex-col gap-3">
        {REACTIONS.map((reaction) => (
          <Button
            key={reaction.type}
            size="icon"
            variant="ghost"
            onClick={() => sendReaction(reaction.type)}
            className="h-12 w-12 rounded-full bg-black/30 backdrop-blur-sm hover:scale-110 transition-transform"
          >
            <span className="text-2xl">{reaction.emoji}</span>
          </Button>
        ))}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowGiftModal(true)}
          className="h-12 w-12 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-110 transition-transform"
        >
          <Gift className="h-6 w-6 text-white" />
        </Button>
      </div>

      {/* CHAT */}
      {showChat && (
        <div 
          className="absolute left-0 right-16 z-10 px-4"
          style={{ 
            bottom: isKeyboardOpen ? keyboardHeight + 80 : 100,
            maxHeight: '40%',
          }}
        >
          <div 
            ref={chatScrollRef}
            className="space-y-2 overflow-y-auto max-h-full scrollbar-hide"
          >
            {comments.slice(-30).map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2"
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={comment.profiles?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {comment.profiles?.display_name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <span className="text-primary text-xs font-medium">
                    {comment.profiles?.display_name || 'User'}
                  </span>
                  <p className="text-white text-sm break-words">{comment.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM INPUT */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-20 p-4"
        style={{ paddingBottom: isKeyboardOpen ? keyboardHeight + 16 : 16 }}
      >
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowChat(!showChat)}
            className="h-10 w-10 rounded-full bg-white/10"
          >
            <MessageCircle className={cn("h-5 w-5", showChat ? "text-primary" : "text-white")} />
          </Button>
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Say something..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            onKeyDown={(e) => e.key === 'Enter' && sendComment()}
          />
          <Button size="icon" onClick={sendComment} className="h-10 w-10">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={stream?.user_id || ''}
        viewers={[]}
        isHost={isHost}
      />
    </div>
  );
};
