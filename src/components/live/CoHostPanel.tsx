import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mic, MicOff, Video, VideoOff, X, 
  UserPlus, Crown, Loader2, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { createUnifiedSFUClient, UnifiedSFUClient } from '@/lib/unified-sfu-client';

interface CoHost {
  id: string;
  user_id: string;
  role: 'host' | 'cohost';
  is_muted: boolean;
  is_video_on: boolean;
  cloudflare_session_id: string | null;
  cloudflare_track_id: string | null;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

interface CoHostPanelProps {
  streamId: string;
  userId: string;
  isHost: boolean;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  className?: string;
}

export function CoHostPanel({
  streamId,
  userId,
  isHost,
  onLocalStream,
  onRemoteStream,
  className,
}: CoHostPanelProps) {
  const [coHosts, setCoHosts] = useState<CoHost[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const sfuClientRef = useRef<UnifiedSFUClient | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Fetch co-hosts
  useEffect(() => {
    const fetchCoHosts = async () => {
      const { data } = await supabase
        .from('live_stream_viewers')
        .select(`
          id, user_id, is_active,
          profiles:user_id (id, display_name, username, avatar_url)
        `)
        .eq('stream_id', streamId)
        .eq('is_active', true);

      if (data) {
        // For now, we'll track co-hosts from invites
        // Real implementation would use a dedicated co_hosts table
        setCoHosts([]);
      }
    };

    fetchCoHosts();
    
    // Subscribe to co-host changes
    const channel = supabase
      .channel(`cohosts-${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_invites',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        if (payload.new?.status === 'accepted') {
          // New co-host joined, refresh list and subscribe to their stream
          fetchCoHosts();
          
          // Pull their track if they have one
          if (payload.new.cloudflare_session_id && payload.new.cloudflare_track_id) {
            subscribeToCoHost(payload.new);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Initialize SFU client for co-hosting
  const initializeSFU = useCallback(async () => {
    if (sfuClientRef.current) return sfuClientRef.current;

    const client = createUnifiedSFUClient(`cohost-${userId}-${Date.now()}`);
    const result = await client.createSession();
    
    if (!result.success) {
      console.error('[CoHostPanel] Failed to create SFU session:', result.error);
      toast.error('Failed to connect to streaming server');
      return null;
    }

    // Set up track callback for receiving co-host streams
    client.onTrack((track, peerId) => {
      console.log('[CoHostPanel] Received remote track:', track.kind, 'from:', peerId);
      
      const stream = new MediaStream([track]);
      const videoEl = remoteVideoRefs.current.get(peerId);
      
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play().catch(console.warn);
      }
      
      onRemoteStream?.(peerId, stream);
    });

    client.onStateChange((state) => {
      console.log('[CoHostPanel] SFU connection state:', state);
    });

    sfuClientRef.current = client;
    return client;
  }, [userId, onRemoteStream]);

  // Start publishing as co-host
  const startPublishing = useCallback(async (stream: MediaStream) => {
    setIsConnecting(true);
    
    try {
      const client = await initializeSFU();
      if (!client) throw new Error('Failed to initialize SFU');

      const trackName = `cohost-${userId}-${Date.now()}`;
      
      // Publish video track
      const videoResult = await client.publishTrack(stream, `${trackName}-video`, 'video');
      if (!videoResult.success) {
        throw new Error(videoResult.error || 'Failed to publish video');
      }

      // Publish audio track
      const audioResult = await client.publishTrack(stream, `${trackName}-audio`, 'audio');
      if (!audioResult.success) {
        console.warn('[CoHostPanel] Audio publish failed:', audioResult.error);
      }

      // Update database with session info
      await supabase
        .from('live_stream_invites')
        .update({
          status: 'streaming',
        })
        .eq('stream_id', streamId)
        .eq('invited_user_id', userId);

      setLocalStream(stream);
      onLocalStream?.(stream);
      
      // Set local video preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }

      toast.success('You are now co-hosting!');
    } catch (error) {
      console.error('[CoHostPanel] Failed to start publishing:', error);
      toast.error('Failed to start co-hosting');
    } finally {
      setIsConnecting(false);
    }
  }, [userId, streamId, initializeSFU, onLocalStream]);

  // Subscribe to a co-host's stream
  const subscribeToCoHost = useCallback(async (coHost: any) => {
    const client = await initializeSFU();
    if (!client || !coHost.cloudflare_session_id) return;

    try {
      await client.pullTracks([{
        location: 'remote',
        trackName: coHost.cloudflare_track_id,
        sessionId: coHost.cloudflare_session_id,
      }]);
    } catch (error) {
      console.error('[CoHostPanel] Failed to subscribe to co-host:', error);
    }
  }, [initializeSFU]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    // Check if screen sharing is supported (not available on mobile WebViews)
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      toast.error('Screen sharing is not supported on this device. Please use a desktop browser.');
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Handle screen share ending
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // If we're already publishing, replace the video track
      if (sfuClientRef.current && localStream) {
        const client = sfuClientRef.current;
        const trackName = `screen-${userId}-${Date.now()}`;
        
        await client.publishTrack(screenStream, trackName, 'video');
        toast.success('Screen sharing started!');
      } else {
        // Start publishing with screen stream
        await startPublishing(screenStream);
      }
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        console.error('[CoHostPanel] Screen share error:', error);
        toast.error('Failed to share screen');
      }
    }
  }, [userId, localStream, startPublishing]);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    toast.info('Screen sharing stopped');
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [localStream, isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOn(!isVideoOn);
    }
  }, [localStream, isVideoOn]);

  // Join as co-host
  const joinAsCoHost = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      await startPublishing(stream);
    } catch (error) {
      console.error('[CoHostPanel] Failed to join as co-host:', error);
      toast.error('Failed to access camera/microphone');
      setIsConnecting(false);
    }
  }, [startPublishing]);

  // Leave co-hosting
  const leaveCoHosting = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (sfuClientRef.current) {
      sfuClientRef.current.destroy();
      sfuClientRef.current = null;
    }
    
    setLocalStream(null);
    setIsScreenSharing(false);
    
    toast.info('Left co-hosting');
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveCoHosting();
    };
  }, []);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Local preview (if co-hosting) */}
      {localStream && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-24 h-32 rounded-lg overflow-hidden bg-black border-2 border-primary"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 left-1 right-1 flex justify-between">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                'h-6 w-6 rounded-full',
                isMuted ? 'bg-red-500' : 'bg-black/50'
              )}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                'h-6 w-6 rounded-full',
                !isVideoOn ? 'bg-red-500' : 'bg-black/50'
              )}
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
            </Button>
          </div>
          <Badge className="absolute top-1 left-1 text-[10px] px-1 py-0">You</Badge>
        </motion.div>
      )}

      {/* Remote co-hosts */}
      <AnimatePresence>
        {coHosts.map((coHost) => (
          <motion.div
            key={coHost.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative w-24 h-32 rounded-lg overflow-hidden bg-black/80 border border-white/20"
          >
            <video
              ref={(el) => {
                if (el) remoteVideoRefs.current.set(coHost.user_id, el);
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-1">
              <Badge variant="secondary" className="text-[10px] px-1 py-0 flex items-center gap-1">
                {coHost.role === 'host' && <Crown className="w-2 h-2" />}
                {coHost.profile?.display_name || 'Co-host'}
              </Badge>
            </div>
            {coHost.is_muted && (
              <MicOff className="absolute top-1 right-1 w-3 h-3 text-red-500" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Co-host controls */}
      {!localStream && !isHost && (
        <Button
          size="sm"
          onClick={joinAsCoHost}
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <UserPlus className="w-4 h-4 mr-1" />
          )}
          Join as Co-host
        </Button>
      )}

      {/* Screen share button */}
      {(isHost || localStream) && (
        <Button
          size="sm"
          variant={isScreenSharing ? 'destructive' : 'secondary'}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className="w-full"
        >
          <Monitor className="w-4 h-4 mr-1" />
          {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        </Button>
      )}

      {/* Leave button */}
      {localStream && !isHost && (
        <Button
          size="sm"
          variant="destructive"
          onClick={leaveCoHosting}
          className="w-full"
        >
          <X className="w-4 h-4 mr-1" />
          Leave
        </Button>
      )}
    </div>
  );
}