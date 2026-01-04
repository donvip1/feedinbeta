import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Video, VideoOff, Mic, MicOff, FlipHorizontal,
  Users, Send, X, Gift, Radio, 
  Wifi, WifiOff, Share2, Home, Coins, Crown, Loader2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { useNavigation } from '@/context/NavigationContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { useLivePresence } from "@/hooks/useLivePresence";
import { FloatingReactions } from "./FloatingReactions";
import { LiveChatMessage } from "./LiveChatMessage";
import { StreamHealthIndicator } from "./StreamHealthIndicator";

interface LiveBroadcasterV2Props {
  streamId: string;
  onClose: () => void;
}

type BroadcastState = 'idle' | 'initializing' | 'publishing' | 'live' | 'reconnecting' | 'ended' | 'error';

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
};

export const LiveBroadcasterV2 = ({ streamId, onClose }: LiveBroadcasterV2Props) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const navigate = useNavigate();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const liveInputIdRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const healthCheckIntervalRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  
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

  // Presence for viewer count
  const { viewerCount: presenceViewerCount, isConnected: presenceConnected } = useLivePresence({
    streamId,
    userId: user?.id,
    username: user?.user_metadata?.display_name || user?.user_metadata?.username,
    avatarUrl: user?.user_metadata?.avatar_url,
    isHost: true,
  });

  // Hide bottom nav while broadcasting
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Set video stream on both elements
  const setVideoStream = useCallback((mediaStream: MediaStream | null) => {
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      if (mediaStream) videoRef.current.play().catch(() => {});
    }
    if (mobileVideoRef.current) {
      mobileVideoRef.current.srcObject = mediaStream;
      if (mediaStream) mobileVideoRef.current.play().catch(() => {});
    }
  }, []);

  // Initialize camera preview
  const initializePreview = useCallback(async () => {
    try {
      console.log('[BroadcasterV2] Initializing camera preview...');
      const constraints = {
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setVideoStream(mediaStream);
      console.log('[BroadcasterV2] Camera preview started');
      return mediaStream;
    } catch (error) {
      console.error('[BroadcasterV2] Camera access error:', error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  }, [isFrontCamera, setVideoStream]);

  // Update connection state in database
  const updateConnectionState = useCallback(async (state: BroadcastState, streamReady?: boolean) => {
    try {
      await supabase.functions.invoke('cloudflare-stream-v2', {
        body: {
          action: 'update-state',
          streamId,
          connectionState: state,
          streamReady,
        },
      });
    } catch (error) {
      console.error('[BroadcasterV2] Failed to update state:', error);
    }
  }, [streamId]);

  // Start broadcasting
  const startBroadcast = useCallback(async () => {
    setBroadcastState('initializing');
    setErrorMessage(null);
    reconnectAttemptRef.current = 0;
    
    try {
      // Initialize media if needed
      let mediaStream = streamRef.current;
      if (!mediaStream || mediaStream.getTracks().length === 0) {
        mediaStream = await initializePreview();
      }
      
      console.log('[BroadcasterV2] Creating Cloudflare live input...');
      
      // Create live input via edge function
      const { data, error } = await supabase.functions.invoke('cloudflare-stream-v2', {
        body: {
          action: 'create-stream',
          streamId,
          title: stream?.title || 'Live Stream',
          enableRecording: true,
        },
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to create stream');
      }
      
      const { webrtcPublishUrl, liveInputId, hlsUrl } = data;
      liveInputIdRef.current = liveInputId;
      
      console.log('[BroadcasterV2] Live input created:', liveInputId);
      console.log('[BroadcasterV2] WHIP URL:', webrtcPublishUrl);
      
      if (!webrtcPublishUrl) {
        throw new Error('No WebRTC publish URL received');
      }
      
      setBroadcastState('publishing');
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      pcRef.current = pc;
      
      // Add tracks
      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];
      
      if (videoTrack) {
        const sender = pc.addTrack(videoTrack, mediaStream);
        // Set encoding params
        try {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = 2000000;
          await sender.setParameters(params);
        } catch (e) {
          console.log('[BroadcasterV2] Could not set video params:', e);
        }
      }
      
      if (audioTrack) {
        const sender = pc.addTrack(audioTrack, mediaStream);
        try {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = 128000;
          await sender.setParameters(params);
        } catch (e) {
          console.log('[BroadcasterV2] Could not set audio params:', e);
        }
      }
      
      // Connection state handling
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('[BroadcasterV2] Connection state:', state);
        
        if (state === 'connected') {
          setBroadcastState('live');
          setConnectionQuality('good');
          reconnectAttemptRef.current = 0;
          toast.success("You are now live!");
          updateConnectionState('live', true);
          
          // Start health check interval
          healthCheckIntervalRef.current = window.setInterval(async () => {
            if (liveInputIdRef.current) {
              try {
                await supabase.functions.invoke('cloudflare-stream-v2', {
                  body: {
                    action: 'check-health',
                    streamId,
                    liveInputId: liveInputIdRef.current,
                  },
                });
              } catch (e) {
                console.log('[BroadcasterV2] Health check failed:', e);
              }
            }
          }, 10000);
        } else if (state === 'disconnected') {
          setConnectionQuality('poor');
          setBroadcastState('reconnecting');
          toast.warning("Connection unstable...");
        } else if (state === 'failed') {
          handleConnectionFailure();
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log('[BroadcasterV2] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setConnectionQuality('good');
        } else if (pc.iceConnectionState === 'disconnected') {
          setConnectionQuality('fair');
        }
      };
      
      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        }
      });
      
      console.log('[BroadcasterV2] Sending SDP to WHIP endpoint...');
      
      // Send offer to WHIP endpoint
      const response = await fetch(webrtcPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp,
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        throw new Error(`WHIP failed: ${response.status}`);
      }
      
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      
      console.log('[BroadcasterV2] Connected to Cloudflare!');
      
      // Update stream status
      await supabase
        .from("live_streams")
        .update({ 
          status: "live",
          started_at: new Date().toISOString(),
          cf_hls_url: hlsUrl,
        })
        .eq("id", streamId);
      
    } catch (error: any) {
      console.error('[BroadcasterV2] Broadcast error:', error);
      setBroadcastState('error');
      setErrorMessage(error.message || 'Failed to start broadcast');
      toast.error(error.message || 'Failed to start broadcast');
      cleanup();
    }
  }, [streamId, stream, initializePreview, updateConnectionState]);

  // Handle connection failure with retry
  const handleConnectionFailure = useCallback(async () => {
    const maxRetries = 3;
    
    if (reconnectAttemptRef.current < maxRetries) {
      reconnectAttemptRef.current++;
      console.log(`[BroadcasterV2] Reconnecting (${reconnectAttemptRef.current}/${maxRetries})...`);
      
      setBroadcastState('reconnecting');
      toast.info(`Reconnecting... (${reconnectAttemptRef.current}/${maxRetries})`);
      
      // Clean up old connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000 * reconnectAttemptRef.current));
      
      if (broadcastState !== 'ended') {
        startBroadcast();
      }
    } else {
      setBroadcastState('error');
      setErrorMessage('Connection lost. Please try again.');
      toast.error('Connection lost after multiple attempts');
    }
  }, [broadcastState, startBroadcast]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[BroadcasterV2] Cleaning up...');
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  // Stop broadcast
  const stopBroadcast = useCallback(async () => {
    console.log('[BroadcasterV2] Stopping broadcast...');
    
    setBroadcastState('ended');
    
    // Notify edge function
    await supabase.functions.invoke('cloudflare-stream-v2', {
      body: {
        action: 'end-stream',
        streamId,
        liveInputId: liveInputIdRef.current,
      },
    });
    
    cleanup();
    onClose();
  }, [streamId, cleanup, onClose]);

  // Toggle video/audio
  const toggleVideo = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoOn(track.enabled);
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsAudioOn(track.enabled);
    }
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    setIsFrontCamera(prev => !prev);
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: !isFrontCamera ? "user" : "environment" },
        audio: true,
      });
      
      const oldStream = streamRef.current;
      streamRef.current = newStream;
      setVideoStream(newStream);
      
      oldStream?.getTracks().forEach(track => track.stop());
      
      // Replace tracks in peer connection
      if (pcRef.current && broadcastState === 'live') {
        const senders = pcRef.current.getSenders();
        
        const videoTrack = newStream.getVideoTracks()[0];
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
        
        const audioTrack = newStream.getAudioTracks()[0];
        const audioSender = senders.find(s => s.track?.kind === 'audio');
        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        }
      }
      
      toast.success("Camera switched!");
    } catch (error) {
      console.error('[BroadcasterV2] Camera switch error:', error);
      toast.error("Could not switch camera");
    }
  }, [isFrontCamera, broadcastState, setVideoStream]);

  // Initialize preview on mount
  useEffect(() => {
    initializePreview();
    
    // Persist broadcast state to sessionStorage
    const savedStreamId = sessionStorage.getItem('active_broadcast_stream');
    if (savedStreamId === streamId) {
      console.log('[BroadcasterV2] Resuming active broadcast session');
      // Could auto-start broadcast here if desired
    }
    
    return () => {
      cleanup();
      sessionStorage.removeItem('active_broadcast_stream');
    };
  }, []);

  // Save active broadcast to session
  useEffect(() => {
    if (broadcastState === 'live') {
      sessionStorage.setItem('active_broadcast_stream', streamId);
    }
  }, [broadcastState, streamId]);

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

    const channel = supabase
      .channel(`host-comments-v2-${streamId}`)
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
        
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-v2-${streamId}`)
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

  // Subscribe to viewer updates and fetch viewer profiles for gift modal
  useEffect(() => {
    const fetchViewers = async () => {
      // Get count
      const { count } = await supabase
        .from("live_stream_viewers")
        .select("*", { count: 'exact', head: true })
        .eq("stream_id", streamId)
        .eq("is_active", true);

      setViewerCount(count || 0);
      
      // Fetch viewer profiles for gift modal
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
      } else {
        setViewers([]);
      }
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 10000); // Refresh every 10s

    const channel = supabase
      .channel(`viewers-v2-${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, fetchViewers)
      .subscribe();

    return () => { 
      clearInterval(interval);
      supabase.removeChannel(channel); 
    };
  }, [streamId]);

  // Subscribe to gifts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`gifts-v2-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        if (payload.new.receiver_id === user.id) {
          setTotalGiftsReceived(prev => prev + (payload.new.credit_value || 0));
          
          const { data: sender } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', payload.new.sender_id)
            .single();
          
          const gift = {
            id: payload.new.id,
            gift_type: payload.new.gift_type,
            sender_name: sender?.display_name || sender?.username || 'Someone',
            credit_value: payload.new.credit_value || 0,
          };
          
          setFlyingGifts(prev => [...prev, gift]);
          setTimeout(() => {
            setFlyingGifts(prev => prev.filter(g => g.id !== gift.id));
          }, 5000);
          
          toast.success(`🎁 ${gift.sender_name} sent ${payload.new.gift_type}!`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, user]);

  const sendComment = async () => {
    if (!newComment.trim() || !user) return;
    
    await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });
    
    setNewComment("");
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/stream/${streamId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: stream?.title || 'Live Stream',
          url: shareUrl,
        });
        return;
      } catch (e) {}
    }
    
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const isLive = broadcastState === 'live';
  const isConnecting = broadcastState === 'initializing' || broadcastState === 'publishing';
  const displayViewerCount = presenceConnected ? presenceViewerCount : viewerCount;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* VIDEO PREVIEW */}
      <div className="relative flex-1">
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
        
        {/* Connection overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">
                {broadcastState === 'initializing' ? 'Setting up stream...' : 'Connecting to Cloudflare...'}
              </p>
            </div>
          </div>
        )}
        
        {broadcastState === 'reconnecting' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="text-center">
              <WifiOff className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-white font-medium">Reconnecting...</p>
            </div>
          </div>
        )}
        
        {broadcastState === 'error' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-white font-medium mb-2">Connection Error</p>
              <p className="text-muted-foreground text-sm mb-4">{errorMessage}</p>
              <Button onClick={startBroadcast}>Try Again</Button>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="border-2 border-white w-10 h-10">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{user?.user_metadata?.display_name?.[0] || 'H'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium text-sm">{stream?.title || 'Live Stream'}</p>
                <div className="flex items-center gap-2">
                  {isLive && (
                    <Badge variant="destructive" className="animate-pulse">
                      <Radio className="w-3 h-3 mr-1" /> LIVE
                    </Badge>
                  )}
                  <StreamHealthIndicator 
                    quality={connectionQuality}
                    isConnecting={isConnecting}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {displayViewerCount}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Coins className="w-3 h-3" />
                {totalGiftsReceived}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Floating reactions */}
        <FloatingReactions reactions={reactions.map(r => ({ id: r.id, type: r.type, senderName: r.senderName }))} />
        
        {/* Flying gifts */}
        <AnimatePresence>
          {flyingGifts.map(gift => (
            <motion.div
              key={gift.id}
              initial={{ x: -100, y: '80%', opacity: 0, scale: 0.5 }}
              animate={{ x: '40%', y: '40%', opacity: 1, scale: 1.2 }}
              exit={{ x: '100%', y: '20%', opacity: 0, scale: 0.5 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="fixed z-50 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full"
            >
              <span className="text-3xl">{REACTION_EMOJIS[gift.gift_type] || '🎁'}</span>
              <div>
                <p className="text-white font-bold text-sm">{gift.sender_name}</p>
                <p className="text-yellow-400 text-xs">+{gift.credit_value} credits</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* CHAT AREA */}
      <div className="h-48 bg-background/95 flex flex-col">
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        >
          {comments.map(comment => (
            <LiveChatMessage 
              key={comment.id} 
              id={comment.id}
              content={comment.content}
              userId={comment.user_id}
              hostId={user?.id || ''}
              profile={comment.profiles}
            />
          ))}
        </div>
        
        <div className="p-3 border-t flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendComment()}
            placeholder="Say something..."
            className="flex-1"
          />
          <Button size="icon" onClick={sendComment}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* CONTROLS */}
      <div className="bg-background border-t p-4 flex justify-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={toggleVideo}
        >
          {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-red-500" />}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={toggleAudio}
        >
          {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-red-500" />}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={switchCamera}
        >
          <FlipHorizontal className="w-5 h-5" />
        </Button>
        
        {/* Gift Button - Host can send to viewers */}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12 border-amber-500/50 hover:bg-amber-500/10"
          onClick={() => setShowGiftModal(true)}
        >
          <Gift className="w-5 h-5 text-amber-500" />
        </Button>
        
        {/* Invite Co-Host Button */}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12 border-blue-500/50 hover:bg-blue-500/10"
          onClick={() => setShowInviteModal(true)}
        >
          <Users className="w-5 h-5 text-blue-500" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={handleShare}
        >
          <Share2 className="w-5 h-5" />
        </Button>
        
        {!isLive && broadcastState === 'idle' && (
          <Button
            className="rounded-full px-8 bg-red-600 hover:bg-red-700"
            onClick={startBroadcast}
          >
            <Radio className="w-5 h-5 mr-2" />
            Go Live
          </Button>
        )}
        
        {isLive && (
          <Button
            variant="destructive"
            className="rounded-full px-8"
            onClick={stopBroadcast}
          >
            <X className="w-5 h-5 mr-2" />
            End Stream
          </Button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={isLive ? stopBroadcast : onClose}
        >
          <Home className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Modals */}
      {showGiftModal && (
        <LiveGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          streamId={streamId}
          hostId={user?.id || ''}
          viewers={viewers}
          isHost={true}
        />
      )}
      
      {showInviteModal && (
        <LiveInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          streamId={streamId}
        />
      )}
    </div>
  );
};
