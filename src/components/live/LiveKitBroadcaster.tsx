import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getFriendlyError, isTemporaryError } from "@/lib/error-messages";
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';
import { 
  Video, VideoOff, Mic, MicOff, FlipHorizontal,
  Users, Send, X, Gift, Radio, 
  Wifi, WifiOff, Share2, Home, Coins, Crown, Loader2, AlertCircle,
  Volume2, VolumeX, MessageCircle, Monitor, MonitorOff, Swords
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { ViewerListPanel } from "./ViewerListPanel";
import { useNavigation } from '@/context/NavigationContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { FloatingReactions } from "./FloatingReactions";
import { FlyingChat } from "./FlyingChat";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import {
  Room,
  RoomEvent,
  VideoPresets,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  createLocalScreenTracks,
  ConnectionState,
} from "livekit-client";
import "@livekit/components-styles";

interface LiveKitBroadcasterProps {
  streamId: string;
  onClose: () => void;
}

type BroadcastState = 'idle' | 'initializing' | 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error';

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
};

export const LiveKitBroadcaster = ({ streamId, onClose }: LiveKitBroadcasterProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const navigate = useNavigate();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [broadcastState, setBroadcastState] = useState<BroadcastState>('idle');
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [reactions, setReactions] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [totalGiftsReceived, setTotalGiftsReceived] = useState(0);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef<LocalVideoTrack | null>(null);

  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Hide bottom nav while broadcasting
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Initialize camera preview
  const initializePreview = useCallback(async () => {
    try {
      console.log('[LiveKitBroadcaster] Initializing camera preview...');
      
      const videoTrack = await createLocalVideoTrack({
        facingMode: isFrontCamera ? "user" : "environment",
        resolution: VideoPresets.h720,
      });
      
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      videoTrackRef.current = videoTrack;
      audioTrackRef.current = audioTrack;

      if (videoRef.current) {
        videoTrack.attach(videoRef.current);
      }

      console.log('[LiveKitBroadcaster] Camera preview started');
    } catch (error: any) {
      console.error('[LiveKitBroadcaster] Camera access error:', error);
      const friendly = getFriendlyError(error?.message || error?.name || 'camera');
      toast.error(friendly.title, { description: friendly.description });
      throw error;
    }
  }, [isFrontCamera]);

  // Start broadcasting
  const startBroadcast = useCallback(async () => {
    if (!user) return;
    
    setBroadcastState('initializing');
    setErrorMessage(null);
    
    try {
      // Initialize media if needed
      if (!videoTrackRef.current || !audioTrackRef.current) {
        await initializePreview();
      }
      
      console.log('[LiveKitBroadcaster] Getting LiveKit token...');
      setBroadcastState('connecting');

      // Get LiveKit token from edge function
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `stream-${streamId}`,
          participantName: user.user_metadata?.display_name || user.user_metadata?.username || 'Host',
          participantIdentity: user.id,
          isHost: true,
        },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || 'Failed to get LiveKit token');
      }

      console.log('[LiveKitBroadcaster] Connecting to LiveKit room...');

      // Create and connect to room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720,
        },
      });
      
      roomRef.current = room;

      // Set up room event handlers
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[LiveKitBroadcaster] Connection state:', state);
        
        if (state === ConnectionState.Connected) {
          setBroadcastState('live');
          setConnectionQuality('good');
          toast.success("You are now live!");
          
          // Update database
          supabase
            .from("live_streams")
            .update({ 
              status: "live",
              stream_ready: true,
              connection_state: "live",
              started_at: new Date().toISOString(),
            })
            .eq("id", streamId)
            .then(({ error }) => {
              if (error) console.error('[LiveKitBroadcaster] DB update error:', error);
            });
            
        } else if (state === ConnectionState.Reconnecting) {
          setBroadcastState('reconnecting');
          setConnectionQuality('poor');
          toast.warning("Reconnecting...");
        } else if (state === ConnectionState.Disconnected) {
          // Stay in reconnecting state - auto-reconnect will handle
          setBroadcastState('reconnecting');
          setConnectionQuality('poor');
        }
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount(room.remoteParticipants.size);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount(room.remoteParticipants.size);
      });

      room.on(RoomEvent.ConnectionQualityChanged, (quality) => {
        if (quality === 'excellent' || quality === 'good') {
          setConnectionQuality('good');
        } else if (quality === 'poor') {
          setConnectionQuality('fair');
        } else {
          setConnectionQuality('poor');
        }
      });

      // Connect to room
      await room.connect(data.url, data.token);

      // Publish tracks
      if (videoTrackRef.current) {
        await room.localParticipant.publishTrack(videoTrackRef.current);
      }
      if (audioTrackRef.current) {
        await room.localParticipant.publishTrack(audioTrackRef.current);
      }

      console.log('[LiveKitBroadcaster] Connected and publishing!');
      
    } catch (error: any) {
      console.error('[LiveKitBroadcaster] Broadcast error:', error);
      setBroadcastState('error');
      const friendly = getFriendlyError(error?.message || 'stream');
      setErrorMessage(friendly.description);
      if (isTemporaryError(error?.message || '')) {
        toast(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.description });
      }
    }
  }, [streamId, user, initializePreview]);

  // Stop broadcast
  const stopBroadcast = useCallback(async () => {
    console.log('[LiveKitBroadcaster] Stopping broadcast...');
    setBroadcastState('ended');

    // Disconnect from room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Stop local tracks
    videoTrackRef.current?.stop();
    audioTrackRef.current?.stop();
    screenTrackRef.current?.stop();

    // Update database
    await supabase
      .from("live_streams")
      .update({ 
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", streamId);

    onClose();
  }, [streamId, onClose]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (videoTrackRef.current) {
      if (isVideoOn) {
        videoTrackRef.current.mute();
      } else {
        videoTrackRef.current.unmute();
      }
      setIsVideoOn(!isVideoOn);
    }
  }, [isVideoOn]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (audioTrackRef.current) {
      if (isAudioOn) {
        audioTrackRef.current.mute();
      } else {
        audioTrackRef.current.unmute();
      }
      setIsAudioOn(!isAudioOn);
    }
  }, [isAudioOn]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (!videoTrackRef.current) return;
    
    try {
      const newFacing = !isFrontCamera;
      setIsFrontCamera(newFacing);
      
      await videoTrackRef.current.restartTrack({
        facingMode: newFacing ? "user" : "environment",
      });
      
      toast.success("Camera switched!");
    } catch (error) {
      console.error('[LiveKitBroadcaster] Camera switch error:', error);
      toast.error("Could not switch camera");
    }
  }, [isFrontCamera]);

  // Handle screen share
  const handleScreenShare = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen share
        if (screenTrackRef.current) {
          await roomRef.current.localParticipant.unpublishTrack(screenTrackRef.current);
          screenTrackRef.current.stop();
          screenTrackRef.current = null;
        }
        
        // Re-publish camera
        if (videoTrackRef.current) {
          await roomRef.current.localParticipant.publishTrack(videoTrackRef.current);
          if (videoRef.current) {
            videoTrackRef.current.attach(videoRef.current);
          }
        }
        
        setIsScreenSharing(false);
        toast.success("Screen share stopped");
      } else {
        // Check if screen sharing is supported
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
          toast.error('Screen sharing is not supported on this device. Please use a desktop browser.');
          return;
        }
        // Start screen share
        const tracks = await createLocalScreenTracks({ audio: true });
        const screenTrack = tracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack;
        
        if (screenTrack) {
          // Unpublish camera first
          if (videoTrackRef.current) {
            await roomRef.current.localParticipant.unpublishTrack(videoTrackRef.current);
          }
          
          screenTrackRef.current = screenTrack;
          await roomRef.current.localParticipant.publishTrack(screenTrack);
          
          if (videoRef.current) {
            screenTrack.attach(videoRef.current);
          }
          
          // Handle when user stops sharing via browser UI
          screenTrack.on('ended', () => {
            handleScreenShare();
          });
          
          setIsScreenSharing(true);
          toast.success("Screen sharing started!");
        }
      }
    } catch (error: any) {
      console.error('[LiveKitBroadcaster] Screen share error:', error);
      if (error.name !== 'NotAllowedError') {
        toast.error("Could not share screen");
      }
    }
  }, [isScreenSharing]);

  // Initialize preview on mount
  useEffect(() => {
    initializePreview();
    
    return () => {
      // Cleanup
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
      screenTrackRef.current?.stop();
    };
  }, []);

  // Auto-reconnect on network restoration
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = async () => {
      if (broadcastState === 'error' || broadcastState === 'reconnecting') {
        console.log('[LiveKitBroadcaster] Network restored, auto-reconnecting...');
        // Small delay to ensure network is stable
        reconnectTimer = setTimeout(() => {
          startBroadcast();
        }, 1500);
      }
    };

    const handleOffline = () => {
      console.log('[LiveKitBroadcaster] Network offline');
      if (broadcastState === 'live') {
        setBroadcastState('reconnecting');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [broadcastState, startBroadcast]);

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .single();
      
      if (data) setStream(data);
    };
    fetchStream();
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
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();
        
        setComments(prev => [...prev, { ...payload.new, profiles: profile }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Subscribe to reactions - with sender name
  useEffect(() => {
    const channel = supabase.channel(`reactions-${streamId}`)
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
        
        // Show toast so host sees it
        toast(`${senderName} sent ${REACTION_EMOJIS[payload.new.reaction_type] || '❤️'}`, {
          duration: 2000,
        });

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
        setTotalGiftsReceived(prev => prev + payload.new.credit_value);
        
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
        }, 5000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Send comment
  const sendComment = async () => {
    if (!newComment.trim() || !user) return;

    const { error } = await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });

    if (error) {
      toast.error("Failed to send message");
    } else {
      setNewComment("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* VIDEO PREVIEW */}
      <div className="absolute inset-0">
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
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Floating Reactions */}
      <FloatingReactions reactions={reactions.map(r => ({
        id: r.id,
        type: r.type,
        senderName: r.senderName,
      }))} />

      {/* Flying Chat & Gifts */}
      <FlyingChat 
        messages={comments.map(c => ({
          id: c.id,
          content: c.content,
          user_id: c.user_id,
          created_at: c.created_at,
          profiles: c.profiles,
        }))} 
        gifts={flyingGifts}
        hostId={user?.id}
        bottomOffset={280}
      />

      {/* TOP HEADER */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          {/* Stream Info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>{user?.user_metadata?.display_name?.[0] || 'H'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-semibold text-sm">{stream?.title || 'My Stream'}</p>
              <div className="flex items-center gap-2">
                {broadcastState === 'live' && (
                  <Badge className="bg-red-500 text-white text-xs animate-pulse">
                    <Radio className="w-3 h-3 mr-1" /> LIVE
                  </Badge>
                )}
                {broadcastState === 'reconnecting' && (
                  <Badge className="bg-yellow-500 text-white text-xs">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Reconnecting
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Stats & Close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{viewerCount}</span>
            </div>
            
            {totalGiftsReceived > 0 && (
              <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1.5 rounded-full">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">{totalGiftsReceived}</span>
              </div>
            )}
            
            <Button
              size="icon"
              variant="ghost"
              onClick={stopBroadcast}
              className="h-10 w-10 rounded-full bg-red-500/20 hover:bg-red-500/40"
            >
              <X className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>

        {/* Connection Quality Indicator */}
        <div className="flex justify-center mt-2">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs",
            connectionQuality === 'good' && "bg-green-500/20 text-green-400",
            connectionQuality === 'fair' && "bg-yellow-500/20 text-yellow-400",
            connectionQuality === 'poor' && "bg-red-500/20 text-red-400",
          )}>
            {connectionQuality === 'good' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connectionQuality === 'good' ? 'Excellent' : connectionQuality === 'fair' ? 'Fair' : 'Poor'}
          </div>
        </div>
      </div>

      {/* CHAT OVERLAY - positioned to avoid control buttons */}
      {showChat && (
        <div 
          className="absolute left-0 z-10 px-4"
          style={{ 
            bottom: isKeyboardOpen ? keyboardHeight + 180 : 280,
            maxHeight: '30vh',
            maxWidth: '60%',
          }}
        >
          <div 
            ref={chatScrollRef}
            className="space-y-2 overflow-y-auto max-h-full scrollbar-hide"
          >
            {comments.slice(-20).map((comment) => (
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
                  <span className="text-primary text-xs font-medium flex items-center gap-1">
                    {comment.profiles?.display_name || comment.profiles?.username || 'User'}
                    {comment.user_id && <VerifiedBadge userId={comment.user_id} size="sm" />}
                  </span>
                  <p className="text-white text-sm break-words">{comment.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM CONTROLS */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-20 p-4 space-y-4"
        style={{ paddingBottom: isKeyboardOpen ? keyboardHeight + 16 : 16 }}
      >
        {/* Control Buttons - icons only, no circles */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={toggleAudio}
            className={cn(
              "transition-colors",
              isAudioOn ? "text-white" : "text-red-500"
            )}
          >
            {isAudioOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={cn(
              "transition-colors",
              isVideoOn ? "text-white" : "text-red-500"
            )}
          >
            {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </button>

          <button
            onClick={switchCamera}
            className="text-white hover:text-zinc-300 transition-colors"
            disabled={isScreenSharing}
          >
            <FlipHorizontal className="h-6 w-6" />
          </button>

          <button
            onClick={handleScreenShare}
            className={cn(
              "transition-colors",
              isScreenSharing ? "text-purple-400" : "text-white hover:text-purple-400"
            )}
          >
            {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={cn(
              "transition-colors",
              showChat ? "text-purple-400" : "text-white hover:text-purple-400"
            )}
          >
            <MessageCircle className="h-6 w-6" />
          </button>

          {/* PK Battle */}
          <button
            onClick={() => toast.info('PK Battle coming soon!')}
            className="text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Swords className="h-6 w-6" />
          </button>
        </div>

        {/* Go Live / Chat Input */}
        {broadcastState === 'idle' || broadcastState === 'error' ? (
          <Button
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-red-500 to-pink-500"
            onClick={startBroadcast}
          >
            <Radio className="w-5 h-5 mr-2" />
            Go Live
          </Button>
        ) : broadcastState === 'initializing' || broadcastState === 'connecting' ? (
          <Button className="w-full h-14 text-lg font-bold" disabled>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {broadcastState === 'initializing' ? 'Preparing...' : 'Connecting...'}
          </Button>
        ) : (
          <div className="flex gap-2">
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
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center gap-2 bg-red-500/20 text-red-300 px-4 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Modals */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={user?.id || ''}
        viewers={viewers}
        isHost={true}
      />
      
      <LiveInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        streamId={streamId}
      />
    </div>
  );
};
