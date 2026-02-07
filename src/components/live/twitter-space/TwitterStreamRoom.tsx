import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@/context/NavigationContext';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Room,
  RoomEvent,
  VideoPresets,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
  RemoteTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
  ConnectionState,
} from 'livekit-client';

import { TwitterSpaceHeader } from './TwitterSpaceHeader';
import { TwitterSpaceControls } from './TwitterSpaceControls';
import { TwitterSpaceChat } from './TwitterSpaceChat';
import { TwitterSpaceReactionPicker } from './TwitterSpaceReactionPicker';
import { LiveGiftModal } from '../LiveGiftModal';
import { FloatingReactions } from '../FloatingReactions';
import { Circle, Video, VideoOff, Users, Radio, ArrowLeft, Settings, Share2, Link, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TwitterStreamRoomProps {
  streamId: string;
  onClose: () => void;
}

interface Reaction {
  id: string | number;
  type: string;
  emoji: string;
  senderName?: string;
}

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
};

export const TwitterStreamRoom = ({ streamId, onClose }: TwitterStreamRoomProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const streamContext = useOptionalLiveStreamContext();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Stream state
  const [stream, setStream] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);

  // Reactions
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [viewers, setViewers] = useState<any[]>([]);

  // Hide bottom nav
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Fetch stream data
  useEffect(() => {
    const fetchStream = async () => {
      const { data: streamData, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle();

      if (error || !streamData) {
        console.error('[TwitterStreamRoom] Error fetching stream:', error);
        toast.error('Stream not found');
        onClose();
        return;
      }

      setStream(streamData);
      setIsHost(user?.id === streamData.user_id);
      setViewerCount(streamData.viewer_count || 0);

      // Fetch host profile
      const { data: hostData } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, is_verified')
        .eq('id', streamData.user_id)
        .single();

      if (hostData) {
        setHost(hostData);
      }

      // Fetch viewers
      const { data: viewersData } = await supabase
        .from('live_stream_viewers')
        .select('user_id, profiles(id, display_name, username, avatar_url)')
        .eq('stream_id', streamId);

      if (viewersData) {
        setViewers(viewersData.map(v => ({
          id: v.user_id,
          ...(v.profiles as any),
        })));
      }

      setLoading(false);
    };

    if (streamId && user) {
      fetchStream();
    }
  }, [streamId, user, onClose]);

  // Initialize LiveKit
  const initializeLiveKit = useCallback(async () => {
    if (!user || !stream) return;

    try {
      setConnectionStatus('connecting');

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `stream-${streamId}`,
          participantName: user.user_metadata?.display_name || user.user_metadata?.username || (isHost ? 'Host' : 'Viewer'),
          participantIdentity: user.id,
          isHost,
        },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || 'Failed to get LiveKit token');
      }

      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720,
        },
      });

      roomRef.current = lkRoom;

      // Connection events
      lkRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) {
          setConnectionStatus('connected');
          if (isHost) {
            toast.success("You are now live!");
            supabase
              .from("live_streams")
              .update({
                status: "live",
                stream_ready: true,
                connection_state: "live",
                started_at: new Date().toISOString(),
              })
              .eq("id", streamId);
          }
        } else if (state === ConnectionState.Reconnecting) {
          setConnectionStatus('reconnecting');
        } else if (state === ConnectionState.Disconnected) {
          setConnectionStatus('error');
        }
      });

      // Participant events
      lkRoom.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount(lkRoom.remoteParticipants.size + 1);
      });

      lkRoom.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount(lkRoom.remoteParticipants.size + 1);
      });

      // Track subscription for viewers
      lkRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setHasVideo(true);
        } else if (track.kind === Track.Kind.Audio) {
          const audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          track.attach(audioEl);
          document.body.appendChild(audioEl);
        }
      });

      lkRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
        if (track.kind === Track.Kind.Video) {
          setHasVideo(false);
        }
      });

      // Connect
      await lkRoom.connect(data.url, data.token);

      // Publish tracks if host
      if (isHost) {
        const videoTrack = await createLocalVideoTrack({
          facingMode: "user",
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

        await lkRoom.localParticipant.publishTrack(videoTrack);
        await lkRoom.localParticipant.publishTrack(audioTrack);
        setHasVideo(true);
        setIsMicOn(true);
        setIsCameraOn(true);
      }

    } catch (error: any) {
      console.error('[TwitterStreamRoom] LiveKit error:', error);
      setConnectionStatus('error');
      toast.error(error.message || 'Failed to connect');
    }
  }, [user, stream, streamId, isHost]);

  // Initialize on stream load
  useEffect(() => {
    if (stream && !loading) {
      initializeLiveKit();
    }

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
      document.querySelectorAll('audio').forEach(el => el.remove());
    };
  }, [stream, loading]);

  // Subscribe to reactions
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`stream-reactions-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, (payload: any) => {
        const reactionType = payload.new.reaction_type || 'heart';
        const newReaction: Reaction = {
          id: Date.now() + Math.random(),
          type: reactionType,
          emoji: REACTION_EMOJIS[reactionType] || '❤️',
        };
        setReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Handle mic toggle
  const handleMicToggle = useCallback(() => {
    if (!isHost) return;
    if (audioTrackRef.current) {
      if (isMicOn) {
        audioTrackRef.current.mute();
      } else {
        audioTrackRef.current.unmute();
      }
    }
    setIsMicOn(!isMicOn);
  }, [isHost, isMicOn]);

  // Handle camera toggle
  const handleCameraToggle = useCallback(() => {
    if (!isHost) return;
    if (videoTrackRef.current) {
      if (isCameraOn) {
        videoTrackRef.current.mute();
      } else {
        videoTrackRef.current.unmute();
      }
    }
    setIsCameraOn(!isCameraOn);
  }, [isHost, isCameraOn]);

  // Handle recording toggle
  const handleRecordingToggle = async () => {
    if (!isHost || recordingLoading) return;

    setRecordingLoading(true);
    try {
      const action = isRecording ? 'stop' : 'start';
      const { error } = await supabase.functions.invoke('livekit-recording', {
        body: {
          action,
          roomId: streamId,
          roomType: 'live_streams',
        },
      });

      if (error) throw error;

      setIsRecording(action === 'start');
      toast.success(action === 'start' ? 'Recording started' : 'Recording stopped');
    } catch (error: any) {
      console.error('[TwitterStreamRoom] Recording error:', error);
      toast.error('Failed to toggle recording');
    } finally {
      setRecordingLoading(false);
    }
  };

  // Handle leave/end
  const handleLeave = async () => {
    if (isHost) {
      // Stop recording if active
      if (isRecording) {
        await supabase.functions.invoke('livekit-recording', {
          body: { action: 'stop', roomId: streamId, roomType: 'live_streams' },
        });
      }

      // End the stream
      await supabase.from('live_streams').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      }).eq('id', streamId);

      // Broadcast room ended
      supabase.channel(`stream-events-${streamId}`).send({
        type: 'broadcast',
        event: 'room_ended',
        payload: {},
      });

      toast.success('Stream ended');
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
    }

    onClose();
  };

  // Handle back (minimize)
  const handleBack = () => {
    if (streamContext) {
      streamContext.minimizeStream();
    }
    navigate('/live');
  };

  // Handle reaction
  const handleReaction = async (emoji: string) => {
    setShowReactions(false);
    await supabase.from('live_stream_reactions').insert({
      stream_id: streamId,
      user_id: user?.id,
      reaction_type: Object.keys(REACTION_EMOJIS).find(k => REACTION_EMOJIS[k] === emoji) || 'heart',
    });
  };

  // Handle share
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/stream/${streamId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: stream?.title || 'Live Stream',
          text: `Watch this live stream: ${stream?.title}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      // User cancelled
    }
  };

  // Handle chat open
  const handleChatToggle = () => {
    setShowChat(!showChat);
    if (!showChat) {
      setUnreadCount(0);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-zinc-400">Connecting to stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950">
        <button onClick={handleBack} className="p-2 text-white hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          {/* Record Button for Host */}
          {isHost && (
            <button
              onClick={handleRecordingToggle}
              disabled={recordingLoading}
              className={cn(
                "p-2 rounded-full transition-colors",
                isRecording
                  ? "text-red-500 bg-red-500/20"
                  : "text-zinc-400 hover:bg-zinc-800"
              )}
            >
              <Circle className={cn("w-5 h-5", isRecording && "fill-red-500 animate-pulse")} />
            </button>
          )}

          {/* End/Leave button */}
          <button
            onClick={handleLeave}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-full transition-colors"
          >
            {isHost ? 'End' : 'Leave'}
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area - Video Feed */}
      <div className="flex-1 relative overflow-hidden">
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isHost}
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            !hasVideo && "hidden"
          )}
        />

        {/* No Video Fallback */}
        {!hasVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950">
            <Avatar className="w-24 h-24 mb-4 ring-4 ring-purple-500/30">
              <AvatarImage src={host?.avatar_url} />
              <AvatarFallback className="text-2xl bg-purple-600">
                {host?.display_name?.[0] || 'H'}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold text-white mb-1">{host?.display_name || 'Host'}</h2>
            <p className="text-zinc-400 text-sm mb-4">@{host?.username}</p>
            {connectionStatus === 'connecting' && (
              <p className="text-purple-400 text-sm">Connecting...</p>
            )}
            {connectionStatus === 'reconnecting' && (
              <p className="text-amber-400 text-sm">Reconnecting...</p>
            )}
          </div>
        )}

        {/* Stream Info Overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
            {/* Live Badge */}
            <Badge className="bg-red-500 text-white px-2 py-0.5 text-xs font-bold">
              <Radio className="w-3 h-3 mr-1 animate-pulse" />
              LIVE
            </Badge>
            {/* Viewer Count */}
            <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
              <Users className="w-3 h-3 text-white" />
              <span className="text-white text-xs">{viewerCount}</span>
            </div>
          </div>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-1 bg-red-500/80 px-2 py-1 rounded-full">
              <Circle className="w-2 h-2 fill-white text-white animate-pulse" />
              <span className="text-white text-xs font-medium">REC</span>
            </div>
          )}
        </div>

        {/* Stream Title */}
        <div className="absolute bottom-20 left-4 right-4">
          <h3 className="text-white font-semibold text-lg drop-shadow-lg">
            {stream?.title || 'Live Stream'}
          </h3>
          {stream?.description && (
            <p className="text-zinc-300 text-sm mt-1 line-clamp-2 drop-shadow">
              {stream.description}
            </p>
          )}
        </div>

        {/* Floating Reactions */}
        <FloatingReactions reactions={reactions} />

        {/* Right Side Action Stack */}
        {isHost && (
          <div className="absolute right-4 bottom-24 flex flex-col gap-3">
            {/* Camera Toggle */}
            <button
              onClick={handleCameraToggle}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border transition-all",
                isCameraOn
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
              )}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <TwitterSpaceControls
        isMicOn={isMicOn}
        onMicToggle={handleMicToggle}
        onGuestsClick={() => {}}
        onReactionsClick={() => setShowReactions(true)}
        onShareClick={handleShare}
        onChatClick={handleChatToggle}
        unreadCount={unreadCount}
        canSpeak={isHost}
        hasRaisedHand={false}
        onGiftClick={() => setShowGiftModal(true)}
        isHost={isHost}
      />

      {/* Modals */}
      <TwitterSpaceChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        spaceId={streamId}
        spaceTitle={stream?.title || 'Live Stream'}
        hostName={host?.display_name || 'Host'}
        startedAt={stream?.started_at}
        viewerCount={viewerCount}
      />

      <TwitterSpaceReactionPicker
        isOpen={showReactions}
        onClose={() => setShowReactions(false)}
        onReaction={handleReaction}
      />

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowShare(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl p-6 pb-safe"
            >
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
              <h3 className="text-white font-semibold text-lg mb-4">Share Stream</h3>
              <div className="space-y-3">
                <button
                  onClick={handleShare}
                  className="w-full flex items-center gap-3 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  <Share2 className="w-5 h-5 text-purple-400" />
                  <span className="text-white">Share</span>
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/live/stream/${streamId}`);
                    toast.success('Link copied!');
                    setShowShare(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  <Link className="w-5 h-5 text-zinc-400" />
                  <span className="text-white">Copy Link</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl p-6 pb-safe"
            >
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
              <h3 className="text-white font-semibold text-lg mb-4">Settings</h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    toast.info('View rules feature coming soon');
                    setShowSettings(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  <Settings className="w-5 h-5 text-zinc-400" />
                  <span className="text-white">View Rules</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showGiftModal && (
        <LiveGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          streamId={streamId}
          hostId={stream?.user_id || ''}
          viewers={viewers}
          isHost={isHost}
          isSpace={false}
        />
      )}
    </div>
  );
};

export default TwitterStreamRoom;
