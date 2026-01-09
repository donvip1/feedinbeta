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
  Wifi, WifiOff, Share2, Home, Coins, Crown, Loader2, AlertCircle,
  Volume2, VolumeX, MessageCircle, Monitor, MonitorOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { ViewerListPanel } from "./ViewerListPanel";
import { useNavigation } from '@/context/NavigationContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { useLivePresence } from "@/hooks/useLivePresence";
import { FloatingReactions } from "./FloatingReactions";
import { StreamHealthIndicator } from "./StreamHealthIndicator";
import { FlyingChat } from "./FlyingChat";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { ScreenShareButton } from "./ScreenShareButton";
import { CoHostPanel } from "./CoHostPanel";

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
  const [showChat, setShowChat] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [coHosts, setCoHosts] = useState<string[]>([]);

  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

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
      pc.onconnectionstatechange = async () => {
        const state = pc.connectionState;
        console.log('[BroadcasterV2] Connection state:', state);
        
        if (state === 'connected') {
          setBroadcastState('live');
          setConnectionQuality('good');
          reconnectAttemptRef.current = 0;
          
          // IMMEDIATELY set stream_ready = true when WebRTC connects
          // Don't wait for Cloudflare API verification - it has lag
          console.log('[BroadcasterV2] WebRTC connected! Setting stream_ready = true immediately');
          
          const { error: updateError } = await supabase
            .from("live_streams")
            .update({ 
              stream_ready: true, 
              status: "live",
              connection_state: "live",
              started_at: new Date().toISOString(),
            })
            .eq("id", streamId);
          
          if (updateError) {
            console.error('[BroadcasterV2] Failed to update stream_ready:', updateError);
          } else {
            console.log('[BroadcasterV2] ✅ stream_ready set to true');
          }
          
          toast.success("You are now live! Viewers can join.");
          
          // Start health check interval (reduced frequency)
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
          }, 15000); // Less frequent health checks
          
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
      
      // Wait for ICE gathering with extended timeout for slow networks
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000); // Increased from 3000
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
      
      // Update HLS URL (stream_ready is set in onconnectionstatechange)
      await supabase
        .from("live_streams")
        .update({ cf_hls_url: hlsUrl })
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

  // Handle screen share
  const handleScreenShare = useCallback(async (screenStream: MediaStream | null) => {
    if (screenStream) {
      // Start screen sharing
      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);
      
      // Replace video track with screen share in peer connection
      if (pcRef.current && broadcastState === 'live') {
        const senders = pcRef.current.getSenders();
        const videoTrack = screenStream.getVideoTracks()[0];
        const videoSender = senders.find(s => s.track?.kind === 'video');
        
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
          console.log('[BroadcasterV2] Replaced video track with screen share');
        }

        // If screen share has audio, add it
        const audioTrack = screenStream.getAudioTracks()[0];
        if (audioTrack) {
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          if (audioSender) {
            // Mix screen audio with mic audio (for now, just use screen audio)
            await audioSender.replaceTrack(audioTrack);
          }
        }
      }
      
      // Update local preview to show screen
      setVideoStream(screenStream);
      
    } else {
      // Stop screen sharing - revert to camera
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      
      // Re-enable camera
      if (streamRef.current && pcRef.current && broadcastState === 'live') {
        const senders = pcRef.current.getSenders();
        
        const videoTrack = streamRef.current.getVideoTracks()[0];
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
        
        const audioTrack = streamRef.current.getAudioTracks()[0];
        const audioSender = senders.find(s => s.track?.kind === 'audio');
        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        }
        
        setVideoStream(streamRef.current);
      }
    }
  }, [broadcastState, setVideoStream]);

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
        // Skip if already added via optimistic update (own messages)
        if (payload.new.user_id === user?.id) return;
        
        // Add immediately, then fetch profile
        const newComment = { ...payload.new, profiles: null };
        setComments(prev => [...prev, newComment]);
        
        // Fetch profile in background
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();

        if (profile) {
          setComments(prev => prev.map(c => 
            c.id === payload.new.id ? { ...c, profiles: profile } : c
          ));
        }
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

  // Subscribe to gifts and load initial total
  useEffect(() => {
    if (!user) return;

    // Fetch initial total gifts received
    const fetchInitialGifts = async () => {
      const { data: gifts } = await supabase
        .from('live_stream_gifts')
        .select('credit_value')
        .eq('stream_id', streamId)
        .eq('receiver_id', user.id);
      
      const total = gifts?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
      setTotalGiftsReceived(total);
    };
    
    fetchInitialGifts();

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
          
          // Show gift immediately, fetch profile in background
          const gift = {
            id: payload.new.id,
            gift_type: payload.new.gift_type,
            sender_name: 'Loading...',
            credit_value: payload.new.credit_value || 0,
          };
          
          setFlyingGifts(prev => [...prev, gift]);
          
          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', payload.new.sender_id)
            .single();
          
          if (sender) {
            setFlyingGifts(prev => prev.map(g => 
              g.id === gift.id 
                ? { ...g, sender_name: sender.display_name || sender.username || 'Someone' }
                : g
            ));
          }
          
          setTimeout(() => {
            setFlyingGifts(prev => prev.filter(g => g.id !== gift.id));
          }, 5000);
          
          toast.success(`🎁 ${sender?.display_name || 'Someone'} sent ${payload.new.gift_type}!`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId, user]);

  const sendComment = async () => {
    if (!newComment.trim() || !user) return;
    
    const content = newComment.trim();
    
    // Optimistic update - show immediately
    const tempComment = {
      id: `temp-${Date.now()}`,
      content,
      user_id: user.id,
      profiles: { 
        display_name: user.user_metadata?.display_name || 'Me',
        username: user.user_metadata?.username,
        avatar_url: user.user_metadata?.avatar_url,
      },
      created_at: new Date().toISOString(),
    };
    
    setComments(prev => [...prev, tempComment]);
    setNewComment("");
    
    const { error } = await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content,
    });

    if (error) {
      toast.error("Failed to send");
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
    }
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

  // Handle invite to speak (co-host functionality)
  const handleInviteToSpeak = useCallback((userId: string) => {
    // For now just toggle the co-host status locally
    setCoHosts(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
    toast.success("Invited to speak!");
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* FULL SCREEN VIDEO PREVIEW */}
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
        
        {/* Idle state overlay - subtle prompt */}
        {broadcastState === 'idle' && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 flex flex-col items-center justify-center z-10">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center mx-auto mb-3">
                <Radio className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-white font-bold text-lg mb-1">Ready to Go Live</p>
              <p className="text-white/60 text-sm">Tap "Go Live" below</p>
            </motion.div>
          </div>
        )}
        
        {/* Connection overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">
                {broadcastState === 'initializing' ? 'Setting up stream...' : 'Connecting...'}
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
              <p className="text-white/60 text-sm mb-4">{errorMessage}</p>
              <Button onClick={startBroadcast}>Try Again</Button>
            </div>
          </div>
        )}
        
        {/* HEADER - TikTok Style */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 z-20 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="border-2 border-primary w-10 h-10">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{user?.user_metadata?.display_name?.[0] || 'H'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm">{stream?.title || 'Live Stream'}</p>
                  {isLive && (
                    <Badge variant="destructive" className="animate-pulse text-xs px-2 py-0">
                      <Radio className="w-2 h-2 mr-1" /> LIVE
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StreamHealthIndicator 
                    quality={connectionQuality}
                    isConnecting={isConnecting}
                  />
                  <span className="text-white/60 text-xs">
                    {isLive ? 'Broadcasting' : broadcastState}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 bg-black/40 border-white/20">
                <Users className="w-3 h-3" />
                {displayViewerCount}
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-black/40 border-white/20">
                <Coins className="w-3 h-3 text-yellow-400" />
                {totalGiftsReceived}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => {
                  if (isLive || broadcastState === 'reconnecting' || isConnecting) {
                    stopBroadcast();
                  } else {
                    onClose();
                  }
                }}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Floating reactions */}
        <FloatingReactions reactions={reactions.map(r => ({ id: r.id, type: r.type, senderName: r.senderName }))} />
        
        {/* Flying gifts */}
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
                  {REACTION_EMOJIS[gift.gift_type] || '🎁'}
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
        
        {/* FLYING CHAT OVERLAY - TikTok Style */}
        {showChat && (
          <FlyingChat
            messages={comments}
            gifts={flyingGifts}
            hostId={user?.id || ''}
            maxMessages={12}
            bottomOffset={isKeyboardOpen ? keyboardHeight + 80 : 160}
            className="pointer-events-auto"
          />
        )}
        
        {/* RIGHT SIDE ACTION BUTTONS */}
        <div 
          className="absolute right-3 flex flex-col gap-2 z-20"
          style={{
            bottom: isKeyboardOpen ? `${keyboardHeight + 160}px` : '220px',
          }}
        >
          {/* Toggle Video */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleVideo}
            className={cn(
              "w-11 h-11 rounded-full backdrop-blur flex items-center justify-center",
              isVideoOn ? "bg-black/40" : "bg-red-500/80"
            )}
          >
            {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
          </motion.button>
          
          {/* Toggle Audio */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleAudio}
            className={cn(
              "w-11 h-11 rounded-full backdrop-blur flex items-center justify-center",
              isAudioOn ? "bg-black/40" : "bg-red-500/80"
            )}
          >
            {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
          </motion.button>
          
          {/* Switch Camera */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={switchCamera}
            disabled={isScreenSharing}
            className={cn(
              "w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center",
              isScreenSharing && "opacity-50"
            )}
          >
            <FlipHorizontal className="w-5 h-5 text-white" />
          </motion.button>
          
          {/* Screen Share Button */}
          <ScreenShareButton
            onScreenStream={handleScreenShare}
            disabled={broadcastState !== 'live'}
            size="md"
          />
          
          {/* Viewer List Panel */}
          <ViewerListPanel
            viewers={viewers}
            viewerCount={displayViewerCount}
            streamId={streamId}
            onInviteToSpeak={handleInviteToSpeak}
            coHosts={coHosts}
            maxCoHosts={4}
          />
          
          {/* Gift Button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowGiftModal(true)}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-lg"
          >
            <Gift className="w-6 h-6 text-white" />
          </motion.button>
          
          {/* Invite Co-Host */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowInviteModal(true)}
            className="w-11 h-11 rounded-full bg-blue-500/80 backdrop-blur flex items-center justify-center"
          >
            <Users className="w-5 h-5 text-white" />
          </motion.button>
          
          {/* Share */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleShare}
            className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
          >
            <Share2 className="w-5 h-5 text-white" />
          </motion.button>
        </div>
        
        {/* BOTTOM INPUT + CONTROLS - TikTok Style */}
        <div 
          className="absolute left-0 right-0 bottom-0 p-4 z-20"
          style={{ paddingBottom: Math.max(16, isKeyboardOpen ? keyboardHeight + 8 : 24) }}
        >
          {/* Go Live / End Stream Buttons */}
          <div className="flex justify-center mb-3">
            {(broadcastState === 'idle' || broadcastState === 'error') && (
              <Button
                className="rounded-full px-10 py-5 bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg"
                onClick={startBroadcast}
              >
                <Radio className="w-5 h-5 mr-2" />
                Go Live
              </Button>
            )}
            
            {(isLive || broadcastState === 'reconnecting' || isConnecting) && (
              <Button
                variant="destructive"
                className="rounded-full px-8"
                onClick={stopBroadcast}
              >
                <X className="w-5 h-5 mr-2" />
                End Stream
              </Button>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/40 hover:bg-black/60 rounded-full shrink-0"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className={cn("w-5 h-5", showChat ? "text-primary" : "text-white")} />
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
              className="bg-black/40 hover:bg-black/60 rounded-full shrink-0"
              onClick={() => navigate('/live')}
            >
              <Home className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>
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
