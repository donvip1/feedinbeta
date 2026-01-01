import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Video, VideoOff, Mic, MicOff, FlipHorizontal,
  Users, Send, X, Gift, MessageCircle,
  Maximize, Minimize, Radio, UserPlus, Coins, Share2, Home, Wifi, WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { useNavigation } from '@/context/NavigationContext';
import { useNavigate } from 'react-router-dom';
import { FlyingChat } from './FlyingChat';
import { ViewerListPanel } from './ViewerListPanel';
import { motion, AnimatePresence } from "framer-motion";
// Using Cloudflare Stream HLS for scalable live streaming

interface LiveBroadcasterProps {
  streamId: string;
  onClose: () => void;
}

// Reaction emojis
const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️',
  like: '👍',
  laugh: '😂',
  fire: '🔥',
  clap: '👏',
  love: '😍',
  star: '⭐',
};

export const LiveBroadcaster = ({ streamId, onClose }: LiveBroadcasterProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sfuRef = useRef<{ pc: RTCPeerConnection; liveInputId: string } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number; y: number; senderName?: string }[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [totalGiftsReceived, setTotalGiftsReceived] = useState(0);
  const [flyingGifts, setFlyingGifts] = useState<{ id: string; gift_type: string; sender_name: string; credit_value: number }[]>([]);
  const [coHosts, setCoHosts] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');

  // Helper to set video stream on both desktop and mobile video elements
  const setVideoStream = useCallback((mediaStream: MediaStream | null) => {
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      if (mediaStream) {
        videoRef.current.play().catch(e => console.log('[Host] Desktop video play error:', e));
      }
    }
    if (mobileVideoRef.current) {
      mobileVideoRef.current.srcObject = mediaStream;
      if (mediaStream) {
        mobileVideoRef.current.play().catch(e => console.log('[Host] Mobile video play error:', e));
      }
    }
  }, []);

  // Hide bottom navigation when broadcasting
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Initialize media stream - optimized for low bandwidth
  const initializeMedia = async (lowBandwidth = false) => {
    try {
      // Try high quality first, fall back to lower quality for slow networks
      const constraints = lowBandwidth ? {
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 640, max: 854 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 24 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 22050,
        },
      } : {
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

      console.log(`[Host] Media initialized (${lowBandwidth ? 'low' : 'high'} bandwidth mode)`);
      return mediaStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  };

  // Detect network quality
  const detectNetworkQuality = async (): Promise<'high' | 'low'> => {
    try {
      // Check Network Information API if available
      const connection = (navigator as any).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        console.log('[Host] Network type:', effectiveType);
        if (effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g') {
          return 'low';
        }
        if (connection.downlink && connection.downlink < 1.5) {
          return 'low';
        }
      }
      return 'high';
    } catch {
      return 'high';
    }
  };

  // Helper function to optimize SDP for Cloudflare
  const optimizeSdpForCloudflare = (sdp: string | undefined): string => {
    if (!sdp) return '';
    
    let optimizedSdp = sdp
      // Ensure audio is properly configured for opus
      .replace(/a=fmtp:111 /, 'a=fmtp:111 maxplaybackrate=48000;stereo=1;useinbandfec=1;')
      // Add bandwidth constraints for video
      .replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:2000\r\n');
    
    return optimizedSdp;
  };

  // Helper function to restart connection
  const restartConnection = async (pc: RTCPeerConnection, webrtcUrl: string) => {
    try {
      console.log('[Host] Restarting connection...');
      
      const offer = await pc.createOffer({ iceRestart: true });
      offer.sdp = optimizeSdpForCloudflare(offer.sdp);
      await pc.setLocalDescription(offer);
      
      const response = await fetch(webrtcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        const answerSdp = await response.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        console.log('[Host] Connection restarted successfully');
        toast.success("Connection restored!");
      }
    } catch (error) {
      console.error('[Host] Failed to restart connection:', error);
    }
  };

  // Start broadcasting - using Cloudflare Stream HLS for scalable delivery
  const startBroadcast = async () => {
    setIsStarting(true);
    setConnectionStatus('connecting');
    
    try {
      // Detect network and use appropriate quality
      const networkQuality = await detectNetworkQuality();
      const useLowBandwidth = networkQuality === 'low';
      
      if (useLowBandwidth) {
        toast.info("Slow network detected - using optimized quality");
      }
      
      // Reuse existing media stream from preview, or initialize new one
      let mediaStream = streamRef.current;
      if (!mediaStream || mediaStream.getTracks().length === 0) {
        console.log('[Host] No preview stream, initializing new media...');
        mediaStream = await initializeMedia(useLowBandwidth);
      } else {
        console.log('[Host] Reusing existing preview stream');
      }
      
      // Step 1: Create Cloudflare Stream Live Input
      console.log('[Host] Creating Cloudflare Stream Live Input...');
      
      const createResponse = await supabase.functions.invoke('cloudflare-stream', {
        body: {
          action: 'create-live-input',
          streamId: streamId,
          title: stream?.title || 'Live Stream',
          enableRecording: true,
        },
      });
      
      if (createResponse.error || !createResponse.data?.success) {
        console.error('[Host] Failed to create live input:', createResponse);
        throw new Error(createResponse.data?.error || 'Failed to create live input');
      }
      
      const { webrtcUrl, hlsUrl, liveInputId } = createResponse.data;
      console.log('[Host] Live input created:', liveInputId);
      console.log('[Host] WebRTC URL:', webrtcUrl);
      console.log('[Host] HLS URL:', hlsUrl);
      
      // Step 2: Connect to Cloudflare via WHIP (WebRTC HTTP Ingest Protocol)
      if (webrtcUrl) {
        console.log('[Host] Publishing to Cloudflare Stream via WHIP...');
        
        // Create peer connection with optimized configuration
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
          ],
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceTransportPolicy: 'all',
          iceCandidatePoolSize: 0, // Start with no candidates for faster connection
        });
        
        let connectionEstablished = false;
        const currentWebrtcUrl = webrtcUrl; // Capture for restart function
        
        // Track connection states
        pc.onconnectionstatechange = () => {
          console.log('[Host] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            connectionEstablished = true;
            setConnectionStatus('connected');
            setIsLive(true);
            toast.success("Connected! You are now live.");
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            console.error('[Host] WebRTC connection failed/disconnected');
            if (!connectionEstablished) {
              setConnectionStatus('failed');
              toast.error("Connection failed. Please check your internet.");
            } else {
              // Attempt to reconnect
              setTimeout(() => {
                if (pc.connectionState !== 'connected') {
                  console.log('[Host] Attempting to restore connection...');
                  restartConnection(pc, currentWebrtcUrl);
                }
              }, 2000);
            }
          }
        };
        
        pc.oniceconnectionstatechange = () => {
          console.log('[Host] ICE connection state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setConnectionStatus('connected');
          } else if (pc.iceConnectionState === 'failed') {
            console.error('[Host] ICE connection failed');
            setConnectionStatus('failed');
          }
        };
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('[Host] ICE candidate:', event.candidate.type);
          } else {
            console.log('[Host] ICE gathering complete');
          }
        };
        
        // Add video track with encoding parameters
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const videoSender = pc.addTrack(videoTrack, mediaStream);
          console.log('[Host] Added video track:', videoTrack.id);
          
          // Set video encoding parameters
          try {
            const params = videoSender.getParameters();
            if (!params.encodings) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = useLowBandwidth ? 500000 : 2000000;
            params.encodings[0].priority = 'high';
            if (params.encodings[0].maxFramerate !== undefined || true) {
              (params.encodings[0] as any).maxFramerate = useLowBandwidth ? 15 : 30;
            }
            await videoSender.setParameters(params);
          } catch (e) {
            console.log('[Host] Could not set video encoding params:', e);
          }
        }
        
        // Add audio track with encoding parameters
        const audioTrack = mediaStream.getAudioTracks()[0];
        if (audioTrack) {
          const audioSender = pc.addTrack(audioTrack, mediaStream);
          console.log('[Host] Added audio track:', audioTrack.id);
          
          // Set audio encoding parameters
          try {
            const params = audioSender.getParameters();
            if (!params.encodings) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 128000;
            params.encodings[0].priority = 'high';
            await audioSender.setParameters(params);
          } catch (e) {
            console.log('[Host] Could not set audio encoding params:', e);
          }
        }
        
        // Create offer with proper SDP constraints
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        
        // Optimize SDP for Cloudflare
        offer.sdp = optimizeSdpForCloudflare(offer.sdp);
        await pc.setLocalDescription(offer);
        console.log('[Host] Local SDP offer created');
        
        // Wait for ICE candidates with timeout
        const iceTimeout = useLowBandwidth ? 2000 : 3000;
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[Host] ICE gathering timed out, proceeding...');
            resolve();
          }, iceTimeout);
          
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
        
        console.log('[Host] Sending SDP to WHIP endpoint...');
        
        // Send offer with retry logic
        let whipResponse: Response | null = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            whipResponse = await fetch(webrtcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/sdp' },
              body: pc.localDescription?.sdp,
              signal: AbortSignal.timeout(10000),
            });
            
            if (whipResponse.ok) break;
            
            attempts++;
            if (attempts < maxAttempts) {
              console.log(`[Host] WHIP attempt ${attempts} failed, retrying...`);
              await new Promise(r => setTimeout(r, 1000 * attempts));
            }
          } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) throw error;
            await new Promise(r => setTimeout(r, 1000 * attempts));
          }
        }
        
        if (!whipResponse || !whipResponse.ok) {
          const errorText = whipResponse ? await whipResponse.text() : 'No response';
          console.error('[Host] WHIP response error:', whipResponse?.status, errorText);
          throw new Error(`WHIP connection failed after ${maxAttempts} attempts`);
        }
        
        const answerSdp = await whipResponse.text();
        console.log('[Host] Received WHIP answer SDP');
        
        // Set remote description with error handling
        try {
          await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
          console.log('[Host] Remote description set successfully');
        } catch (error) {
          console.error('[Host] Failed to set remote description:', error);
          await restartConnection(pc, webrtcUrl);
        }
        
        // Store peer connection for cleanup
        sfuRef.current = { pc, liveInputId };
        
        console.log('[Host] Successfully connected to Cloudflare Stream!');
      } else {
        throw new Error('No WebRTC URL returned from Cloudflare');
      }
      
      // Step 3: Update stream status to live
      const { error } = await supabase
        .from("live_streams")
        .update({ 
          status: "live",
          started_at: new Date().toISOString(),
          cf_hls_url: hlsUrl,
        })
        .eq("id", streamId);

      if (error) throw error;

      setIsLive(true);
      setConnectionStatus('connected');
      
    } catch (error: any) {
      console.error("Error starting broadcast:", error);
      setConnectionStatus('failed');
      toast.error(error.message || "Failed to start broadcast");
      
      // Clean up on failure
      if (sfuRef.current?.pc) {
        sfuRef.current.pc.close();
        sfuRef.current = null;
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    } finally {
      setIsStarting(false);
    }
  };

  // Stop broadcasting
  const stopBroadcast = async () => {
    // Notify viewers via Supabase broadcast
    const channel = supabase.channel(`stream-notify-${streamId}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'stream-ended',
      payload: { streamId },
    });
    
    // Give viewers a moment to receive the message
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clean up WebRTC connection
    if (sfuRef.current?.pc) {
      sfuRef.current.pc.close();
    }
    
    // Optionally delete the live input (keeps recording if enabled)
    const liveInputId = sfuRef.current?.liveInputId;
    if (liveInputId) {
      // Don't delete - let Cloudflare keep the recording
      console.log('[Host] Stream ended, recording available at live input:', liveInputId);
    }
    
    sfuRef.current = null;
    
    // Stop all tracks
    streamRef.current?.getTracks().forEach(track => track.stop());

    // Update stream status
    await supabase
      .from("live_streams")
      .update({ 
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", streamId);

    await supabase.removeChannel(channel);
    setIsLive(false);
    setConnectionStatus('idle');
    onClose();
  };

  // Toggle video
  const toggleVideo = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  // Switch camera - reconnect to Cloudflare Stream
  const switchCamera = async () => {
    const oldStream = streamRef.current;
    setIsFrontCamera(!isFrontCamera);
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: !isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = newStream;
      setVideoStream(newStream);

      // Stop old tracks
      oldStream?.getTracks().forEach(track => track.stop());
      
      // For Cloudflare Stream, we need to replace tracks in the existing connection
      if (sfuRef.current?.pc && isLive) {
        const pc = sfuRef.current.pc;
        const senders = pc.getSenders();
        
        // Replace video track
        const videoTrack = newStream.getVideoTracks()[0];
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
        
        // Replace audio track
        const audioTrack = newStream.getAudioTracks()[0];
        const audioSender = senders.find(s => s.track?.kind === 'audio');
        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        }
        
        toast.success("Camera switched!");
      }
      
      console.log("[Host] Camera switched successfully");
    } catch (error) {
      console.error("[Host] Error switching camera:", error);
      toast.error("Could not switch camera");
    }
  };


  // Initialize camera preview on mount - so users can see themselves before going live
  useEffect(() => {
    let isMounted = true;
    
    const initPreview = async () => {
      try {
        console.log('[Host] Initializing camera preview...');
        const constraints = {
          video: {
            facingMode: isFrontCamera ? "user" : "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true, // Request audio too so it's ready when we go live
        };
        
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (isMounted) {
          streamRef.current = mediaStream;
          setVideoStream(mediaStream);
          console.log('[Host] Camera preview started successfully');
        } else {
          // Component unmounted, stop tracks
          mediaStream.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.error('[Host] Error initializing camera preview:', error);
        toast.error("Could not access camera. Please check permissions.");
      }
    };
    
    initPreview();
    
    return () => {
      isMounted = false;
      // Clean up media stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [setVideoStream]); // Run only on mount, camera switching is handled separately

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .single();

      if (!error && data) {
        setStream(data);
      }
    };

    fetchStream();
  }, [streamId]);

  // Clean up WebRTC on unmount
  useEffect(() => {
    return () => {
      if (sfuRef.current?.pc) {
        sfuRef.current.pc.close();
      }
    };
  }, []);

  // Handle network changes for auto-reconnection
  useEffect(() => {
    const handleOnline = () => {
      if (isLive && connectionStatus === 'failed') {
        console.log('[Host] Network restored, attempting to reconnect...');
        toast.info("Network restored. Reconnecting...");
      }
    };
    
    const handleOffline = () => {
      console.log('[Host] Network lost');
      if (isLive) {
        toast.warning("Network connection lost");
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isLive, connectionStatus]);

  // Subscribe to comments - FIXED: properly fetch and display with profiles
  useEffect(() => {
    const fetchComments = async () => {
      const { data: commentsData } = await supabase
        .from("live_stream_comments")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Fetch profiles separately for reliability
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: profileMap.get(comment.user_id) || null,
      }));

      setComments(commentsWithProfiles);
      
      // Auto-scroll chat
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    };

    fetchComments();

    const channel = supabase
      .channel(`host-comments-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload) => {
        // Fetch the new comment's profile immediately
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();

        const newComment = {
          ...payload.new,
          profiles: profile,
        };

        setComments(prev => [...prev, newComment]);

        // Auto-scroll
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to reactions - FIXED: show who sent the reaction
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
        
        // Show toast with sender name
        toast(`${senderName} sent ${REACTION_EMOJIS[payload.new.reaction_type] || '❤️'}`, {
          duration: 2000,
        });

        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to viewer count updates and fetch viewer profiles
  useEffect(() => {
    const fetchViewers = async () => {
      const { data, count } = await supabase
        .from("live_stream_viewers")
        .select("user_id", { count: 'exact' })
        .eq("stream_id", streamId)
        .eq("is_active", true);

      setViewerCount(count || 0);

      if (data && data.length > 0) {
        const userIds = data.map(v => v.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);
          setViewers(profiles || []);
        }
      }

      // Update stream viewer count
      await supabase
        .from("live_streams")
        .update({ viewer_count: count || 0 })
        .eq("id", streamId);
    };

    fetchViewers();

    const channel = supabase
      .channel(`viewers-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        // Show user joined notification
        if (payload.new.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', payload.new.user_id)
            .single();
          
          if (profile) {
            toast(`👋 ${profile.display_name || profile.username} joined the stream`, {
              duration: 3000,
            });
          }
        }
        fetchViewers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchViewers())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to gifts received - FIXED: TikTok style with sender names
  useEffect(() => {
    if (!user) return;

    const fetchGifts = async () => {
      const { data } = await supabase
        .from("live_stream_gifts")
        .select("credit_value")
        .eq("stream_id", streamId)
        .eq("receiver_id", user.id);

      const total = data?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
      setTotalGiftsReceived(total);
    };

    fetchGifts();

    const channel = supabase
      .channel(`gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        if (payload.new.receiver_id === user.id) {
          setTotalGiftsReceived(prev => prev + (payload.new.credit_value || 0));
          
          // Get sender name for flying gift
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', payload.new.sender_id)
            .single();
          
          // Add flying gift with prominent display
          const newGift = {
            id: payload.new.id,
            gift_type: payload.new.gift_type,
            sender_name: senderProfile?.display_name || senderProfile?.username || 'Someone',
            credit_value: payload.new.credit_value || 0,
          };
          setFlyingGifts(prev => [...prev, newGift]);
          
          // Remove after animation
          setTimeout(() => {
            setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
          }, 5000);
          
          toast.success(`🎁 ${newGift.sender_name} sent ${payload.new.gift_type}! +${payload.new.credit_value} credits`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, user]);

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment("");
  };

  const getReactionEmoji = (type: string) => {
    return REACTION_EMOJIS[type] || '❤️';
  };

  const handleInviteToSpeak = async (userId: string) => {
    if (coHosts.length >= 4) {
      toast.error("Maximum 4 co-hosts allowed");
      return;
    }
    
    // For now, just add to coHosts list - in full implementation would send WebRTC invite
    setCoHosts(prev => [...prev, userId]);
    
    const viewer = viewers.find(v => v.id === userId);
    if (viewer) {
      toast.success(`Invited ${viewer.display_name} to speak!`);
      
      // Send notification comment
      await supabase.from("live_stream_comments").insert({
        stream_id: streamId,
        user_id: user?.id,
        content: `🎤 ${viewer.display_name} has been invited to speak!`,
      });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/stream/${streamId}`;
    
    // Try native share first (mobile devices)
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: stream?.title || 'Live Stream',
          text: `Watch my live stream: ${stream?.title}`,
          url: shareUrl,
        });
        return;
      } catch (error: any) {
        // If user cancelled, don't fall through to clipboard
        if (error?.name === 'AbortError') return;
      }
    }
    
    // Fallback to clipboard with multiple methods
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success('Link copied to clipboard!');
        } else {
          toast.error('Could not copy link. Please copy manually: ' + shareUrl);
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Could not copy link. Please copy manually: ' + shareUrl);
    }
  };

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
            muted
            className={cn(
              "w-full h-full object-cover",
              isFrontCamera && "scale-x-[-1]"
            )}
          />

          {/* Not Live Yet Overlay */}
          {!isLive && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center">
                <Radio className="w-20 h-20 mx-auto mb-4 text-primary animate-pulse" />
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Go Live?</h2>
                <p className="text-muted-foreground mb-6">
                  {stream?.title || "Your stream"}
                </p>
                <Button
                  size="lg"
                  onClick={startBroadcast}
                  disabled={isStarting}
                  className="bg-red-600 hover:bg-red-700 text-white px-8"
                >
                  {isStarting ? "Starting..." : "Start Broadcasting"}
                </Button>
              </div>
            </div>
          )}

          {/* Live Badge & Stats */}
          {isLive && (
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse px-3 py-1 text-sm">
                <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping" />
                LIVE
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Users className="w-4 h-4 mr-1" />
                {viewerCount}
              </Badge>
              {totalGiftsReceived > 0 && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1">
                  <Coins className="w-4 h-4 mr-1" />
                  {totalGiftsReceived}
                </Badge>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="absolute top-4 right-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={isLive ? stopBroadcast : onClose}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Flying Chat Overlay */}
          {isLive && (
            <FlyingChat 
              messages={comments} 
              gifts={flyingGifts}
              maxMessages={10}
            />
          )}

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

          {/* Host Action Buttons */}
          {isLive && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-green-500/80 hover:bg-green-600"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5 text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-pink-500/80 hover:bg-pink-600"
                onClick={() => setShowGiftModal(true)}
              >
                <Gift className="w-5 h-5 text-white" />
              </Button>
              
              {/* Viewer List Panel */}
              <ViewerListPanel
                viewers={viewers}
                viewerCount={viewerCount}
                streamId={streamId}
                onInviteToSpeak={handleInviteToSpeak}
                coHosts={coHosts}
                maxCoHosts={4}
              />
              
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-blue-500/80 hover:bg-blue-600"
                onClick={() => setShowInviteModal(true)}
              >
                <UserPlus className="w-5 h-5 text-white" />
              </Button>
            </div>
          )}

          {/* Control Bar */}
          {isLive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  !isVideoOn && "bg-red-600 hover:bg-red-700"
                )}
                onClick={toggleVideo}
              >
                {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  !isAudioOn && "bg-red-600 hover:bg-red-700"
                )}
                onClick={toggleAudio}
              >
                {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={switchCamera}
              >
                <FlipHorizontal className="w-5 h-5 text-white" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full ml-2"
                onClick={stopBroadcast}
              >
                End Stream
              </Button>
            </div>
          )}
        </div>

        {/* Right: Chat Panel for Desktop */}
        {isLive && (
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
                  placeholder="Say something..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                  className="flex-1"
                />
                <Button size="icon" onClick={sendComment}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Right spacer when not live */}
        {!isLive && <div className="flex-1 bg-black/95" />}
      </div>

      {/* Mobile/Tablet: Full screen video */}
      <div className="lg:hidden absolute inset-0 bg-black">
        <video
          ref={mobileVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            isFrontCamera && "scale-x-[-1]"
          )}
          style={{
            objectPosition: 'center center',
            minWidth: '100%',
            minHeight: '100%',
          }}
        />

        {/* Not Live Yet Overlay */}
        {!isLive && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <Radio className="w-20 h-20 mx-auto mb-4 text-primary animate-pulse" />
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Go Live?</h2>
              <p className="text-muted-foreground mb-6">
                {stream?.title || "Your stream"}
              </p>
              <Button
                size="lg"
                onClick={startBroadcast}
                disabled={isStarting}
                className="bg-red-600 hover:bg-red-700 text-white px-8"
              >
                {isStarting ? "Starting..." : "Start Broadcasting"}
              </Button>
            </div>
          </div>
        )}

        {/* Live Badge & Stats */}
        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-3 z-20">
            <Badge variant="destructive" className="animate-pulse px-3 py-1 text-sm">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping" />
              LIVE
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <Users className="w-4 h-4 mr-1" />
              {viewerCount}
            </Badge>
          </div>
        )}

        {/* Close and Home Buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate('/feed')}
            title="Go to Feed"
          >
            <Home className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={isLive ? stopBroadcast : onClose}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Flying Chat Overlay */}
        {isLive && (
          <FlyingChat 
            messages={comments} 
            gifts={flyingGifts}
            maxMessages={8}
          />
        )}

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

        {/* Gifts Received Badge */}
        {isLive && totalGiftsReceived > 0 && (
          <div className="absolute top-4 right-24 flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1 rounded-full z-20">
            <Coins className="w-4 h-4" />
            <span className="font-bold">{totalGiftsReceived}</span>
          </div>
        )}

        {/* Host Action Buttons */}
        {isLive && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-green-500/80 hover:bg-green-600"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5 text-white" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-pink-500/80 hover:bg-pink-600"
              onClick={() => setShowGiftModal(true)}
            >
              <Gift className="w-5 h-5 text-white" />
            </Button>
            
            {/* Viewer List Panel */}
            <ViewerListPanel
              viewers={viewers}
              viewerCount={viewerCount}
              streamId={streamId}
              onInviteToSpeak={handleInviteToSpeak}
              coHosts={coHosts}
              maxCoHosts={4}
            />
            
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-blue-500/80 hover:bg-blue-600"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="w-5 h-5 text-white" />
            </Button>
          </div>
        )}

        {/* Control Bar */}
        {isLive && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 z-20">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full",
                !isVideoOn && "bg-red-600 hover:bg-red-700"
              )}
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full",
                !isAudioOn && "bg-red-600 hover:bg-red-700"
              )}
              onClick={toggleAudio}
            >
              {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={switchCamera}
            >
              <FlipHorizontal className="w-5 h-5 text-white" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize className="w-5 h-5 text-white" /> : <Maximize className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full ml-2"
              onClick={stopBroadcast}
            >
              End Stream
            </Button>
          </div>
        )}
      </div>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={user?.id || ""}
        viewers={viewers}
        isHost={true}
      />

      {/* Invite Modal */}
      <LiveInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        streamId={streamId}
        currentCoHostCount={coHosts.length}
        maxCoHosts={4}
      />
    </div>
  );
};