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
  Share2, Home, Coins, Crown, Loader2,
  MessageCircle
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
import { FlyingChat } from "./FlyingChat";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

interface SimpleBroadcasterProps {
  streamId: string;
  onClose: () => void;
}

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
};

export const SimpleBroadcaster = ({ streamId, onClose }: SimpleBroadcasterProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const navigate = useNavigate();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [reactions, setReactions] = useState<any[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [totalGiftsReceived, setTotalGiftsReceived] = useState(0);
  const [flyingGifts, setFlyingGifts] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [liveInputId, setLiveInputId] = useState<string | null>(null);

  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  // Presence for viewer count
  const { viewerCount: presenceViewerCount } = useLivePresence({
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
      console.log('[Broadcaster] Initializing camera preview...');
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
      console.log('[Broadcaster] Camera preview started');
      return mediaStream;
    } catch (error) {
      console.error('[Broadcaster] Camera access error:', error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  }, [isFrontCamera, setVideoStream]);

  // Start broadcasting with Cloudflare WebRTC WHIP
  const startBroadcast = useCallback(async () => {
    if (!user) return;
    
    setConnectionStatus('connecting');
    toast.info("Setting up broadcast...");
    
    try {
      // Initialize media if needed
      let mediaStream = streamRef.current;
      if (!mediaStream || mediaStream.getTracks().length === 0) {
        mediaStream = await initializePreview();
      }
      
      console.log('[Broadcaster] Creating Cloudflare live input...');
      
      // 1. Create Cloudflare Live Input via edge function
      const { data: cfData, error: cfError } = await supabase.functions.invoke('cloudflare-stream-v2', {
        body: {
          action: 'create-stream',
          streamId,
          title: stream?.title || 'Live Stream',
          enableRecording: true,
        }
      });

      if (cfError || !cfData?.success) {
        console.error('[Broadcaster] Edge function error:', cfError, cfData);
        throw new Error(cfData?.error || 'Failed to create Cloudflare stream');
      }

      const { webrtcPublishUrl, liveInputId: inputId, hlsUrl, webrtcPlaybackUrl } = cfData;
      console.log('[Broadcaster] Got WHIP URL:', webrtcPublishUrl);
      console.log('[Broadcaster] Got WHEP URL:', webrtcPlaybackUrl);
      console.log('[Broadcaster] HLS URL for viewers:', hlsUrl);
      
      if (!webrtcPublishUrl) {
        throw new Error('No WHIP publish URL received from Cloudflare');
      }
      
      setWhipUrl(webrtcPublishUrl);
      setLiveInputId(inputId);

      // 2. CRITICAL: Ensure HLS URL is saved to database as backup
      // (edge function should have done this, but let's verify)
      if (hlsUrl) {
        console.log('[Broadcaster] Verifying HLS URL is in database...');
        const { error: dbError } = await supabase
          .from('live_streams')
          .update({ 
            cf_hls_url: hlsUrl,
            cf_webrtc_url: webrtcPlaybackUrl || null,
            cf_live_input_id: inputId,
          })
          .eq('id', streamId);
        
        if (dbError) {
          console.error('[Broadcaster] Warning: Could not save HLS URL to DB:', dbError);
        } else {
          console.log('[Broadcaster] HLS URL saved to database');
        }
      }

      // 3. Create RTCPeerConnection and push to Cloudflare WHIP
      toast.info("Connecting to streaming server...");
      
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
        bundlePolicy: 'max-bundle',
      });
      peerConnectionRef.current = pc;

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('[Broadcaster] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          toast.error("Connection lost. Please try again.");
          setConnectionStatus('failed');
        }
      };

      // Add tracks to peer connection
      mediaStream.getTracks().forEach(track => {
        console.log('[Broadcaster] Adding track:', track.kind, track.label);
        pc.addTrack(track, mediaStream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const onComplete = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', onComplete);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', onComplete);
          setTimeout(resolve, 5000);
        }
      });

      const localDescription = pc.localDescription;
      if (!localDescription || !localDescription.sdp) {
        throw new Error('Failed to create local description');
      }

      console.log('[Broadcaster] Sending WHIP offer to Cloudflare...');

      // 4. Send offer to Cloudflare WHIP endpoint
      const whipResponse = await fetch(webrtcPublishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: localDescription.sdp,
      });

      if (!whipResponse.ok) {
        const errorText = await whipResponse.text();
        console.error('[Broadcaster] WHIP error:', whipResponse.status, errorText);
        throw new Error(`WHIP connection failed: ${whipResponse.status}`);
      }

      const answerSdp = await whipResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      console.log('[Broadcaster] WebRTC connected to Cloudflare!');

      // 5. Update stream status to LIVE immediately
      const { error: statusError } = await supabase
        .from('live_streams')
        .update({ 
          status: 'live',
          stream_ready: true,
          connection_state: 'live',
          started_at: new Date().toISOString(),
        })
        .eq('id', streamId);

      if (statusError) {
        console.error('[Broadcaster] Warning: Could not update stream status:', statusError);
      }

      // 6. Start background verification for HLS manifest
      console.log('[Broadcaster] Starting background HLS verification...');
      supabase.functions.invoke('cloudflare-stream-v2', {
        body: {
          action: 'verify-stream-playable',
          streamId,
          liveInputId: inputId,
          maxWaitSeconds: 45,
        }
      }).then(result => {
        console.log('[Broadcaster] Stream verification result:', result.data);
        if (result.data?.success) {
          toast.success("Stream is fully live - viewers can now join!");
        }
      }).catch(err => {
        console.log('[Broadcaster] Background verification error:', err);
      });

      setConnectionStatus('connected');
      toast.success("You are now live!");
      
    } catch (error: any) {
      console.error('[Broadcaster] Broadcast error:', error);
      setConnectionStatus('failed');
      toast.error(error.message || 'Failed to start broadcast');
      
      // Cleanup on failure
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  }, [streamId, user, initializePreview, stream?.title]);

  // Stop broadcast
  const stopBroadcast = useCallback(async () => {
    console.log('[Broadcaster] Stopping broadcast...');
    
    // Cleanup WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop media
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    
    // End stream via edge function
    if (liveInputId) {
      await supabase.functions.invoke('cloudflare-stream-v2', {
        body: { action: 'end-stream', streamId, liveInputId }
      });
    } else {
      await supabase
        .from("live_streams")
        .update({ 
          status: 'ended', 
          stream_ready: false,
          ended_at: new Date().toISOString(),
          connection_state: 'ended'
        })
        .eq("id", streamId);
    }
    
    onClose();
  }, [streamId, onClose, liveInputId]);

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
      
      // Replace tracks in WebRTC connection
      if (peerConnectionRef.current && connectionStatus === 'connected') {
        const senders = peerConnectionRef.current.getSenders();
        const videoTrack = newStream.getVideoTracks()[0];
        const audioTrack = newStream.getAudioTracks()[0];
        
        for (const sender of senders) {
          if (sender.track?.kind === 'video' && videoTrack) {
            await sender.replaceTrack(videoTrack);
          } else if (sender.track?.kind === 'audio' && audioTrack) {
            await sender.replaceTrack(audioTrack);
          }
        }
      }
      
      toast.success("Camera switched!");
    } catch (error) {
      console.error('[Broadcaster] Camera switch error:', error);
      toast.error("Could not switch camera");
    }
  }, [isFrontCamera, connectionStatus, setVideoStream]);

  // Initialize preview on mount
  useEffect(() => {
    initializePreview();
    
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

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
        .limit(50);

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
        
        setComments(prev => [...prev.slice(-49), { ...payload.new, profiles: profile }]);
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

  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase.channel(`reactions-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, (payload: any) => {
        const reaction = {
          type: payload.new.reaction_type,
          id: Date.now() + Math.random(),
          x: Math.random() * 40 + 55,
          y: Math.random() * 30 + 40,
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
    const channel = supabase.channel(`gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        setTotalGiftsReceived(prev => prev + payload.new.credit_value);
        
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

  const sendComment = async () => {
    if (!newComment.trim() || !user) return;
    
    const { error } = await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });
    
    if (!error) setNewComment("");
  };

  const totalViewers = presenceViewerCount;
  const isLive = connectionStatus === 'connected';

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* VIDEO */}
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
        
        {/* Status Overlay */}
        {connectionStatus === 'connecting' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-white text-lg">Starting broadcast...</p>
            </div>
          </div>
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
            <span className="text-2xl">{gift.gift_type === 'credits' ? '💰' : '🎁'}</span>
            <span className="text-white font-medium">{gift.sender_name} sent {gift.credit_value} credits!</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-20 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="border-2 border-primary w-10 h-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>{user?.user_metadata?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-medium text-sm">{stream?.title || 'Live Stream'}</p>
              <div className="flex items-center gap-2">
                <Badge variant={isLive ? "destructive" : "secondary"} className="text-xs">
                  <Radio className="w-3 h-3 mr-1" />
                  {isLive ? 'LIVE' : connectionStatus.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-black/50">
                  <Users className="w-3 h-3 mr-1" />
                  {totalViewers}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {totalGiftsReceived > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                <Coins className="w-3 h-3 mr-1" />
                {totalGiftsReceived}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => navigate('/')}
            >
              <Home className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={stopBroadcast}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Section - Flying chat style */}
      {showChat && (
        <div className="absolute left-0 right-0 bottom-32 px-4 z-10 pointer-events-none">
          <FlyingChat 
            messages={comments.slice(-10)}
            hostId={user?.id}
          />
        </div>
      )}

      {/* Bottom Controls */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20 safe-area-bottom"
        style={{ paddingBottom: isKeyboardOpen ? keyboardHeight + 16 : undefined }}
      >
        {/* Chat Input */}
        <div className="flex items-center gap-2 mb-4">
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
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "rounded-full w-12 h-12",
              !isAudioOn ? "bg-red-500/80 text-white" : "bg-white/10 text-white"
            )}
            onClick={toggleAudio}
          >
            {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "rounded-full w-12 h-12",
              !isVideoOn ? "bg-red-500/80 text-white" : "bg-white/10 text-white"
            )}
            onClick={toggleVideo}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full w-12 h-12 bg-white/10 text-white"
            onClick={switchCamera}
          >
            <FlipHorizontal className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full w-12 h-12 bg-white/10 text-white"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full w-12 h-12 bg-white/10 text-white"
            onClick={() => setShowInviteModal(true)}
          >
            <Share2 className="w-5 h-5" />
          </Button>

          {/* Go Live / End Button */}
          {!isLive ? (
            <Button
              className="rounded-full bg-red-500 hover:bg-red-600 text-white px-6"
              onClick={startBroadcast}
              disabled={connectionStatus === 'connecting'}
            >
              {connectionStatus === 'connecting' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Radio className="w-4 h-4 mr-2" />
              )}
              Go Live
            </Button>
          ) : (
            <Button
              className="rounded-full bg-red-500 hover:bg-red-600 text-white px-6"
              onClick={stopBroadcast}
            >
              End
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={user?.id || ''}
        viewers={[]}
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
