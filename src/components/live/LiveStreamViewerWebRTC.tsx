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
  MessageCircle, Home, Coins, Wifi, WifiOff, Crown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiftModal } from "./LiveGiftModal";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useLivePresence } from "@/hooks/useLivePresence";
import { FloatingReactions } from "./FloatingReactions";
import { LiveChatMessage } from "./LiveChatMessage";
import Hls from 'hls.js';

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
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Start muted to allow autoplay
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
  const [playbackMethod, setPlaybackMethod] = useState<'webrtc' | 'hls' | null>(null);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ username?: string; avatar_url?: string } | null>(null);
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Get current user for presence
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUserProfile({ username: profile.display_name || profile.username, avatar_url: profile.avatar_url });
        }
      }
    };
    getUser();
  }, []);

  // Supabase Presence for real-time viewer counts
  const { viewerCount: presenceViewerCount, isConnected: presenceConnected } = useLivePresence({
    streamId,
    userId: currentUserId || undefined,
    username: currentUserProfile?.username,
    avatarUrl: currentUserProfile?.avatar_url,
    isHost: false,
  });

  // Helper to set video source on both elements
  const setVideoSource = useCallback((source: MediaStream | string | null) => {
    const setSource = (video: HTMLVideoElement | null) => {
      if (!video) return;
      if (source instanceof MediaStream) {
        video.srcObject = source;
      } else if (typeof source === 'string') {
        video.src = source;
      } else {
        video.srcObject = null;
        video.src = '';
      }
    };
    setSource(videoRef.current);
    setSource(mobileVideoRef.current);
  }, []);

  // Play both video elements
  const playVideos = useCallback(async () => {
    const playVideo = async (video: HTMLVideoElement | null) => {
      if (!video) return;
      try {
        await video.play();
      } catch (e) {
        console.warn("[Viewer] Autoplay failed, keeping muted:", e);
        video.muted = true;
        await video.play().catch(() => {});
      }
    };
    await Promise.all([playVideo(videoRef.current), playVideo(mobileVideoRef.current)]);
  }, []);

  // Handle unmute - user interaction required
  const handleUnmute = useCallback(() => {
    setIsMuted(false);
    setShowUnmutePrompt(false);
    if (videoRef.current) videoRef.current.muted = false;
    if (mobileVideoRef.current) mobileVideoRef.current.muted = false;
  }, []);

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
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
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

  // Detect if user is on slow network
  const isSlowNetwork = useCallback(() => {
    const connection = (navigator as any).connection;
    if (connection) {
      const type = connection.effectiveType;
      return type === '2g' || type === 'slow-2g' || type === '3g' || (connection.downlink && connection.downlink < 1.5);
    }
    return false;
  }, []);

  // WebRTC Playback - ultra low latency! Try this first
  useEffect(() => {
    if (stream?.status !== 'live') return;
    if (playbackMethod === 'hls') return; // Already using HLS fallback
    
    // Get WebRTC playback URL from stream_url (set by edge function)
    const webrtcPlaybackUrl = stream?.stream_url;
    if (!webrtcPlaybackUrl || !webrtcPlaybackUrl.includes('webRTC/play')) {
      console.log("[Viewer-WebRTC] No WebRTC playback URL, falling back to HLS");
      setPlaybackMethod('hls');
      return;
    }

    let isMounted = true;
    console.log("[Viewer-WebRTC] Setting up WebRTC playback:", webrtcPlaybackUrl);
    setConnectionStatus('connecting');
    setIsConnecting(true);

    const setupWebRTC = async () => {
      if (!videoRef.current || !isMounted) return;

      try {
        // Clean up previous connection
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }

        // Create peer connection for receiving
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
          ],
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        });
        pcRef.current = pc;

        // Set up to receive tracks
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          console.log("[Viewer-WebRTC] Received track:", event.track.kind);
          if (event.streams[0]) {
            // Set on both video elements
            if (videoRef.current) {
              videoRef.current.srcObject = event.streams[0];
              videoRef.current.muted = true; // Start muted for autoplay
              videoRef.current.play().catch(() => {});
            }
            if (mobileVideoRef.current) {
              mobileVideoRef.current.srcObject = event.streams[0];
              mobileVideoRef.current.muted = true;
              mobileVideoRef.current.play().catch(() => {});
            }
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[Viewer-WebRTC] Connection state:", pc.connectionState);
          if (pc.connectionState === 'connected') {
            setHasVideo(true);
            setIsConnecting(false);
            setConnectionStatus('connected');
            setPlaybackMethod('webrtc');
            if (!connectionNotified) {
              toast.success('Connected to stream!');
              setConnectionNotified(true);
            }
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            console.log("[Viewer-WebRTC] Connection failed, falling back to HLS");
            setPlaybackMethod('hls');
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
          }
          const timeout = setTimeout(resolve, 2000);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        });

        // Send offer to Cloudflare WHEP endpoint
        console.log("[Viewer-WebRTC] Sending offer to WHEP endpoint...");
        const response = await fetch(webrtcPlaybackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription?.sdp,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[Viewer-WebRTC] WHEP error:", response.status, errorText);
          throw new Error(`WHEP failed: ${response.status}`);
        }

        const answerSdp = await response.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        console.log("[Viewer-WebRTC] WebRTC connection established!");

      } catch (error) {
        console.error("[Viewer-WebRTC] Setup failed:", error);
        if (isMounted) {
          console.log("[Viewer-WebRTC] Falling back to HLS");
          setPlaybackMethod('hls');
        }
      }
    };

    // Try WebRTC with a short timeout before falling back
    const webrtcTimeout = setTimeout(() => {
      if (connectionStatus !== 'connected' && isMounted) {
        console.log("[Viewer-WebRTC] Timeout, falling back to HLS");
        setPlaybackMethod('hls');
      }
    }, 8000);

    setupWebRTC();

    return () => {
      isMounted = false;
      clearTimeout(webrtcTimeout);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [stream?.status, stream?.stream_url, playbackMethod, connectionNotified]);

  // HLS.js-based video playback - fallback for slower but more reliable playback
  useEffect(() => {
    if (stream?.status !== 'live') return;
    if (playbackMethod !== 'hls') return; // Only use when WebRTC failed
    if (!stream?.cf_hls_url) {
      console.log("[Viewer-HLS] No HLS URL available yet, waiting...");
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 10;
    const hlsUrl = stream.cf_hls_url;
    const slowNetwork = isSlowNetwork();

    console.log("[Viewer-HLS] Setting up HLS connection for stream:", streamId);
    console.log("[Viewer-HLS] HLS URL:", hlsUrl);
    setConnectionStatus('connecting');
    setIsConnecting(true);

    const setupHLS = () => {
      if (!videoRef.current || !isMounted) return;

      // Cleanup previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Check if HLS is natively supported (Safari)
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("[Viewer-HLS] Using native HLS support");
        videoRef.current.src = hlsUrl;
        if (mobileVideoRef.current) mobileVideoRef.current.src = hlsUrl;
        
        const onLoaded = () => {
          setHasVideo(true);
          setIsConnecting(false);
          setConnectionStatus('connected');
          if (!connectionNotified) {
            toast.success('Connected to stream!');
            setConnectionNotified(true);
          }
          // Play both videos muted
          videoRef.current?.play().catch(() => {});
          if (mobileVideoRef.current) {
            mobileVideoRef.current.play().catch(() => {});
          }
        };
        
        const onError = () => {
          console.error("[Viewer-HLS] Native HLS error, retrying...");
          retryCount++;
          if (retryCount < maxRetries && isMounted) {
            setTimeout(setupHLS, slowNetwork ? 2000 : 3000);
          } else {
            setConnectionStatus('failed');
          }
        };
        
        videoRef.current.addEventListener('loadedmetadata', onLoaded);
        videoRef.current.addEventListener('error', onError);
        return;
      }

      // Use HLS.js for browsers that don't support native HLS
      if (Hls.isSupported()) {
        console.log("[Viewer-HLS] Using HLS.js");
        
        // Optimized config for faster initial load
        const hlsConfig = {
          enableWorker: true,
          lowLatencyMode: !slowNetwork,
          backBufferLength: 30,
          maxBufferLength: slowNetwork ? 15 : 30,
          maxMaxBufferLength: 60,
          liveSyncDurationCount: slowNetwork ? 5 : 3,
          liveMaxLatencyDurationCount: slowNetwork ? 15 : 10,
          manifestLoadingMaxRetry: 8,
          manifestLoadingRetryDelay: 500,
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 500,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 500,
          startLevel: slowNetwork ? 0 : -1,
        };
        
        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log("[Viewer-HLS] Media attached, loading source...");
          hls.loadSource(hlsUrl);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log("[Viewer-HLS] Manifest parsed, levels:", data.levels.length);
          setHasVideo(true);
          setIsConnecting(false);
          setConnectionStatus('connected');
          retryCount = 0;
          
          if (!connectionNotified) {
            toast.success('Connected to stream!');
            setConnectionNotified(true);
          }
          
          // Auto-play muted for both video elements
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
          if (mobileVideoRef.current) {
            mobileVideoRef.current.muted = true;
            mobileVideoRef.current.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("[Viewer-HLS] Error:", data.type, data.details);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("[Viewer-HLS] Network error, trying to recover...");
                retryCount++;
                if (retryCount < maxRetries) {
                  setTimeout(() => {
                    hls.startLoad();
                  }, slowNetwork ? 1500 : 1000);
                } else {
                  setConnectionStatus('failed');
                  toast.error("Connection lost - please refresh");
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("[Viewer-HLS] Media error, trying to recover...");
                hls.recoverMediaError();
                break;
              default:
                console.error("[Viewer-HLS] Fatal error, attempting restart...");
                retryCount++;
                if (retryCount < maxRetries && isMounted) {
                  hls.destroy();
                  setTimeout(setupHLS, 2000);
                } else {
                  setConnectionStatus('failed');
                }
                break;
            }
          }
        });

        hls.attachMedia(videoRef.current);
        
        // For mobile, we need to sync the video - copy srcObject when ready
        if (mobileVideoRef.current) {
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (videoRef.current?.src && mobileVideoRef.current) {
              mobileVideoRef.current.src = videoRef.current.src;
              mobileVideoRef.current.muted = true;
              mobileVideoRef.current.play().catch(() => {});
            }
          });
        }
      } else {
        console.error("[Viewer-HLS] HLS is not supported in this browser");
        toast.error("Your browser doesn't support live streaming");
        setConnectionStatus('failed');
      }
    };

    // Try to connect immediately
    setupHLS();

    // Retry for connection issues
    const retryInterval = setInterval(() => {
      if (connectionStatus !== 'connected' && isMounted && stream?.status === 'live' && retryCount < maxRetries) {
        console.log(`[Viewer-HLS] Retrying connection (attempt ${retryCount + 1})...`);
        setupHLS();
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(retryInterval);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream?.status, stream?.cf_hls_url, streamId, isSlowNetwork, connectionNotified, playbackMethod]);

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

          {/* Tap to unmute overlay - Desktop */}
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
                <span className="text-white font-medium text-lg">Click to unmute</span>
              </motion.div>
            </motion.div>
          )}

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
                      {presenceConnected ? presenceViewerCount : (stream.viewer_count || 0)}
                    </span>
                    {presenceConnected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Real-time" />
                    )}
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

          {/* Floating Reactions - Physics-based TikTok style */}
          <FloatingReactions reactions={reactions} className="z-30" />

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
                <LiveChatMessage
                  key={comment.id}
                  id={comment.id}
                  content={comment.content}
                  userId={comment.user_id}
                  hostId={stream.user_id}
                  profile={comment.profiles}
                  isCompact={false}
                />
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
          ref={mobileVideoRef}
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

        {/* Tap to unmute overlay */}
        {hasVideo && isMuted && showUnmutePrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            onClick={handleUnmute}
          >
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="bg-black/70 backdrop-blur-sm px-6 py-4 rounded-2xl flex items-center gap-3 cursor-pointer"
            >
              <VolumeX className="w-8 h-8 text-white" />
              <span className="text-white font-medium text-lg">Tap to unmute</span>
            </motion.div>
          </motion.div>
        )}

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
                    {presenceConnected ? presenceViewerCount : (stream.viewer_count || 0)}
                  </span>
                  {presenceConnected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Real-time" />
                  )}
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

        {/* Floating Reactions - Physics-based TikTok style */}
        <FloatingReactions reactions={reactions} className="z-30" />

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