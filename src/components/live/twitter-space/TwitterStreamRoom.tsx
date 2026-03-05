import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { useNavigation } from '@/context/NavigationContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  MessageSquare,
  Users,
  Share2,
  Settings,
  Heart,
  X,
  Search,
  Link as LinkIcon,
  Send,
  Flag,
  MessageCircle,
  CheckCircle2,
  FileText,
  ArrowLeft,
  Gift,
  Circle,
  Video,
  VideoOff,
  Hand,
  Monitor,
  Swords,
  Camera,
  Minimize2,
  Crown,
  RotateCcw,
  Zap,
  Sparkles,
  Play,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  createLocalScreenTracks,
} from 'livekit-client';

import { LiveGiftModal } from '../LiveGiftModal';
import { ReportContentModal } from '@/components/moderation/ReportContentModal';
import { SpaceRulesModal } from './SpaceRulesModal';
import { SpaceFeedbackModal } from './SpaceFeedbackModal';
import { SpaceAudioSettingsModal } from './SpaceAudioSettingsModal';
import { FloatingReactions } from '../FloatingReactions';
import { MentionText } from '../MentionText';
import { ThreadedRepliesList } from './ThreadedRepliesList';
import { PKBattleChallenge } from '../unified/PKBattleChallenge';
import { shareUrls } from '@/lib/url-utils';

interface TwitterStreamRoomProps {
  streamId: string;
  onClose: () => void;
}

interface GiftAnimation {
  id: string;
  emoji: string;
  senderName: string;
  receiverName: string;
  value: number;
}

interface Viewer {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
    is_verified?: boolean;
  };
}

interface StreamData {
  id: string;
  title: string;
  description: string;
  user_id: string;
  status: string;
  viewer_count: number;
  category?: string;
  started_at?: string;
  cover_image_url?: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
  displayName?: string;
}

interface FloatingGiftReaction {
  id: string | number;
  type: string;
  senderName?: string;
  emoji?: string;
}

interface Reply {
  id: string;
  user_id: string;
  user: string;
  handle: string;
  time: string;
  text: string;
  avatar: string;
  likes: number;
  liked_by_me: boolean;
  isGift?: boolean;
  reply_to_id?: string | null;
}

const REACTION_EMOJIS = [
  '😂', '😮', '😢', '💜', '💯',
  '👏', '✊', '👍', '👎', '👋'
];

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
  const screenTrackRef = useRef<LocalVideoTrack | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // View states
  const [view, setView] = useState<'main' | 'guests'>('main');
  const [showChat, setShowChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState(false);

  // Gift animations state
  const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);
  const [floatingGiftReactions, setFloatingGiftReactions] = useState<FloatingGiftReaction[]>([]);

  // Data states
  const [stream, setStream] = useState<StreamData | null>(null);
  const [host, setHost] = useState<any>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeGuestTab, setActiveGuestTab] = useState('All');
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; user: string; handle: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);

  // User states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showPKBattle, setShowPKBattle] = useState(false);

  const isHost = stream?.user_id === user?.id;

  // Hide bottom nav
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Initialize stream
  useEffect(() => {
    const initStream = async () => {
      await fetchStreamData();
    };
    initStream();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
    };
  }, [streamId]);

  // Fetch stream data
  const fetchStreamData = async () => {
    const { data: streamData, error } = await supabase
      .from('live_streams')
      .select('*')
      .eq('id', streamId)
      .maybeSingle();

    if (error || !streamData) {
      toast.error('Stream not found');
      onClose();
      return;
    }

    setStream(streamData);

    // Fetch host profile
    const { data: hostData } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, is_verified')
      .eq('id', streamData.user_id)
      .single();

    if (hostData) {
      setHost(hostData);
    }

    await fetchViewers();
    setLoading(false);

    // Initialize LiveKit after data is ready
    setTimeout(() => initializeLiveKit(streamData), 100);
  };

  // Fetch viewers
  const fetchViewers = async () => {
    const { data: viewersData } = await supabase
      .from('live_stream_viewers')
      .select('user_id, profiles(id, display_name, username, avatar_url, is_verified)')
      .eq('stream_id', streamId);

    if (viewersData) {
      setViewers(viewersData.map(v => ({
        id: v.user_id,
        user_id: v.user_id,
        role: 'listener',
        is_muted: true,
        has_raised_hand: false,
        profile: v.profiles as any,
      })));
    }
  };

  // Initialize LiveKit
  const initializeLiveKit = async (streamData: StreamData) => {
    if (!user) return;

    try {
      setConnectionStatus('connecting');

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `stream-${streamId}`,
          participantName: user.user_metadata?.display_name || user.user_metadata?.username || 'Viewer',
          participantIdentity: user.id,
          isHost: user.id === streamData.user_id,
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
          if (user.id === streamData.user_id) {
            toast.success("You are now live!");
            supabase.from("live_streams").update({
              status: "live",
              stream_ready: true,
              connection_state: "live",
              started_at: new Date().toISOString(),
            }).eq("id", streamId);
          }
        } else if (state === ConnectionState.Reconnecting) {
          setConnectionStatus('reconnecting');
        } else if (state === ConnectionState.Disconnected) {
          setConnectionStatus('error');
        }
      });

      // Participant events
      lkRoom.on(RoomEvent.ParticipantConnected, () => {
        fetchViewers();
      });

      lkRoom.on(RoomEvent.ParticipantDisconnected, () => {
        fetchViewers();
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
      if (user.id === streamData.user_id) {
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
  };

  // Realtime subscriptions
  useEffect(() => {
    if (!streamId) return;

    // Reactions broadcast channel
    const reactionsChannel = supabase
      .channel(`stream-reactions-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, (payload: any) => {
        if (payload.new?.user_id !== user?.id) {
          const reactionEmojis: Record<string, string> = {
            heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
          };
          handleFloatingReaction(reactionEmojis[payload.new.reaction_type] || '❤️');
        }
      })
      .subscribe();

    // Gift channel
    const giftChannel = supabase
      .channel(`stream-gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        const giftData = payload.new;

        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', giftData.sender_id)
          .single();

        const { data: receiverProfile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', giftData.receiver_id)
          .single();

        const giftEmojis: Record<string, string> = {
          rose: '🌹', coffee: '☕', heart: '❤️', diamond: '💎',
          rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌',
          credits: '💰',
        };

        const emoji = giftEmojis[giftData.gift_type] || '🎁';

        const floatingGift: FloatingGiftReaction = {
          id: giftData.id,
          type: giftData.gift_type,
          senderName: senderProfile?.display_name || 'Someone',
          emoji,
        };
        setFloatingGiftReactions(prev => [...prev, floatingGift]);

        const newGiftAnim: GiftAnimation = {
          id: giftData.id,
          emoji,
          senderName: senderProfile?.display_name || 'Someone',
          receiverName: receiverProfile?.display_name || 'Host',
          value: giftData.credit_value || 1,
        };
        setGiftAnimations(prev => [...prev, newGiftAnim]);

        const giftChatMessage: Reply = {
          id: `gift-${giftData.id}`,
          user_id: giftData.sender_id,
          user: senderProfile?.display_name || 'Someone',
          handle: '@' + (senderProfile?.username || 'user'),
          time: 'Just now',
          text: `🎁 Sent ${emoji} ${giftData.gift_type} (${giftData.credit_value} credits)`,
          avatar: senderProfile?.avatar_url || '',
          likes: 0,
          liked_by_me: false,
          isGift: true,
        };
        setReplies(prev => [...prev, giftChatMessage]);

        setTimeout(() => {
          setGiftAnimations(prev => prev.filter(g => g.id !== newGiftAnim.id));
        }, 5000);
      })
      .subscribe();

    // Stream ended event
    const streamChannel = supabase
      .channel(`stream-events-${streamId}`)
      .on('broadcast', { event: 'room_ended' }, () => {
        toast.info('Stream has ended');
        onClose();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(giftChannel);
      supabase.removeChannel(streamChannel);
    };
  }, [streamId, user?.id]);

  // Fetch replies - using type assertion for table not in generated types
  useEffect(() => {
    if (!streamId) return;

    const fetchReplies = async () => {
      // Use type assertion to bypass strict type checking for tables not yet in generated types
      const supabaseAny = supabase as any;
      const { data, error } = await supabaseAny
        .from('live_stream_messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data) return;

      const messagesData = data as Array<{
        id: string;
        user_id: string;
        content: string;
        created_at: string;
      }>;

      if (messagesData.length > 0) {
        const userIds = messagesData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setReplies(
          messagesData.reverse().map((msg) => ({
            id: msg.id,
            user_id: msg.user_id,
            user: profileMap.get(msg.user_id)?.display_name || 'User',
            handle: '@' + (profileMap.get(msg.user_id)?.username || 'user'),
            time: getRelativeTime(msg.created_at),
            text: msg.content,
            avatar: profileMap.get(msg.user_id)?.avatar_url || '',
            likes: 0,
            liked_by_me: false,
          }))
        );
      }
    };

    fetchReplies();

    // Subscribe to broadcast channel for new messages
    const channel = supabase
      .channel(`stream-chat-${streamId}`)
      .on('broadcast', { event: 'new_message' }, () => {
        fetchReplies();
        if (!showChat) {
          setUnreadMessages(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, showChat]);

  // Helper to get relative time
  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const handleFloatingReaction = (emoji: string, displayName?: string) => {
    const newReaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      left: 35 + Math.random() * 30,
      displayName,
    };
    setFloatingReactions(prev => [...prev, newReaction]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  };

  // Handle mic toggle
  const handleMicToggle = () => {
    if (!isHost) return;
    if (audioTrackRef.current) {
      if (isMicOn) {
        audioTrackRef.current.mute();
      } else {
        audioTrackRef.current.unmute();
      }
    }
    setIsMicOn(!isMicOn);
  };

  // Handle camera toggle
  const handleCameraToggle = () => {
    if (!isHost) return;
    if (videoTrackRef.current) {
      if (isCameraOn) {
        videoTrackRef.current.mute();
      } else {
        videoTrackRef.current.unmute();
      }
    }
    setIsCameraOn(!isCameraOn);
  };

  // Handle recording toggle - client-side MediaRecorder
  const handleRecordingToggle = async () => {
    if (!isHost || recordingLoading) return;

    setRecordingLoading(true);
    try {
      if (isRecording) {
        // Stop recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        toast.success('⏹️ Recording stopped');
      } else {
        // Start client-side recording
        const room = roomRef.current;
        if (!room) throw new Error('No active room');

        const audioContext = new AudioContext({ sampleRate: 48000 });
        const destination = audioContext.createMediaStreamDestination();

        // Add local audio
        if (audioTrackRef.current?.mediaStreamTrack) {
          const localStream = new MediaStream([audioTrackRef.current.mediaStreamTrack]);
          audioContext.createMediaStreamSource(localStream).connect(destination);
        }

        // Add remote audio
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((pub) => {
            if (pub.track?.mediaStreamTrack) {
              const stream = new MediaStream([pub.track.mediaStreamTrack]);
              audioContext.createMediaStreamSource(stream).connect(destination);
            }
          });
        });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';
        
        recordingChunksRef.current = [];
        const recorder = new MediaRecorder(destination.stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordingChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(recordingChunksRef.current, { type: mimeType });
          audioContext.close();
          if (blob.size > 0) {
            const fileName = `stream-${streamId}-${Date.now()}.webm`;
            const { error: uploadError } = await supabase.storage
              .from('recordings')
              .upload(fileName, blob, { contentType: mimeType });
            
            if (!uploadError) {
              toast.success('Recording saved!');
            }
          }
        };

        recorder.start(1000);
        setIsRecording(true);
        toast.success('🔴 Recording started');
      }
    } catch (error: any) {
      toast.error('Failed to toggle recording');
    } finally {
      setRecordingLoading(false);
    }
  };

  // Handle screen share toggle - publish to LiveKit
  const handleScreenShare = async () => {
    if (!isHost) return;
    
    if (isScreenSharing) {
      // Stop and unpublish screen share track
      if (screenTrackRef.current) {
        await roomRef.current?.localParticipant.unpublishTrack(screenTrackRef.current);
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      setIsScreenSharing(false);
      toast.success('Screen sharing stopped');
    } else {
      try {
        const tracks = await createLocalScreenTracks({ audio: false });
        const screenTrack = tracks[0] as LocalVideoTrack;
        screenTrackRef.current = screenTrack;

        await roomRef.current?.localParticipant.publishTrack(screenTrack, {
          source: Track.Source.ScreenShare,
        });

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
        
        // Listen for browser stop
        screenTrack.mediaStreamTrack.onended = async () => {
          await roomRef.current?.localParticipant.unpublishTrack(screenTrack);
          screenTrack.stop();
          screenTrackRef.current = null;
          setIsScreenSharing(false);
          toast.info('Screen sharing ended');
        };
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          toast.error('Failed to start screen share');
        }
      }
    }
  };

  // Handle camera flip
  const handleCameraFlip = async () => {
    if (!isHost || !videoTrackRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      await videoTrackRef.current.restartTrack({ facingMode: newFacing });
      setFacingMode(newFacing);
    } catch (e) {
      toast.error('Failed to flip camera');
    }
  };

  // Handle PK Battle
  const handlePKBattle = () => {
    setShowPKBattle(true);
  };

  // Handle leave/end
  const handleLeave = async () => {
    if (isHost) {
      // Stop client-side recording if active
      if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      // Stop screen share if active
      if (screenTrackRef.current) {
        await roomRef.current?.localParticipant.unpublishTrack(screenTrackRef.current);
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      await supabase.from('live_streams').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      }).eq('id', streamId);

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
  const handleMinimize = () => {
    if (streamContext) {
      streamContext.minimizeStream();
    }
    navigate('/live');
  };

  // Handle reaction
  const handleReaction = async (emoji: string) => {
    setShowReactions(false);
    const myName = viewers.find((v: any) => v.user_id === user?.id)?.profile?.display_name || host?.display_name || 'Someone';
    handleFloatingReaction(emoji, myName);

    const reactionTypes: Record<string, string> = {
      '❤️': 'heart', '👍': 'like', '😂': 'laugh', '🔥': 'fire', '👏': 'clap', '😍': 'love', '⭐': 'star',
    };

    await supabase.from('live_stream_reactions').insert({
      stream_id: streamId,
      user_id: user?.id,
      reaction_type: reactionTypes[emoji] || 'heart',
    });
  };

  const handleReplySubmit = async () => {
    if (!user || !replyText.trim()) return;

    const content = replyingTo
      ? `@${replyingTo.handle.replace('@', '')} ${replyText}`
      : replyText;

    // Insert into messages table (using any to bypass type checking for table not in generated types)
    const { error } = await (supabase as any).from('live_stream_messages').insert({
      stream_id: streamId,
      user_id: user.id,
      content,
    });

    if (!error) {
      // Broadcast to notify others
      supabase.channel(`stream-chat-${streamId}`).send({
        type: 'broadcast',
        event: 'new_message',
        payload: { user_id: user.id },
      });
    }

    setReplyText('');
    setReplyingTo(null);
  };

  const handleLikeMessage = (messageId: string) => {
    setReplies(prev => prev.map(reply => {
      if (reply.id === messageId) {
        return {
          ...reply,
          liked_by_me: !reply.liked_by_me,
          likes: reply.liked_by_me ? reply.likes - 1 : reply.likes + 1,
        };
      }
      return reply;
    }));
  };

  const handleReplyToMessage = (reply: Reply) => {
    setReplyingTo({ id: reply.id, user: reply.user, handle: reply.handle });
  };

  const navigateToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };
  // Auto-scroll flying chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Create sorted list with host first, then viewers
  const sortedParticipants = [
    // Host as speaker
    ...(host ? [{
      id: host.id,
      user_id: host.id,
      role: 'host',
      is_muted: !isMicOn,
      has_raised_hand: false,
      profile: host,
    }] : []),
    // All other viewers as listeners
    ...viewers.filter(v => v.user_id !== host?.id),
  ];

  const speakersCount = sortedParticipants.filter(s => s.role !== 'listener').length;
  const listenersCount = sortedParticipants.filter(s => s.role === 'listener').length;

  // Guests overlay
  if (view === 'guests') {
    const filteredParticipants = sortedParticipants.filter(s => {
      if (activeGuestTab === 'All') return true;
      if (activeGuestTab === 'Co-hosts') return s.role === 'co_host';
      if (activeGuestTab === 'Speakers') return s.role === 'host' || s.role === 'speaker';
      if (activeGuestTab === 'Listening') return s.role === 'listener';
      return true;
    });

    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
          <button onClick={() => setView('main')} className="p-2">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-white font-bold text-lg">Guests</h2>
          <div className="w-9" />
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center bg-zinc-800 rounded-full px-3 py-2">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search guests"
              className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none ml-2"
            />
          </div>
        </div>

        <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Co-hosts', 'Speakers', 'Listening'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveGuestTab(tab)}
              className={`px-5 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-colors ${
                activeGuestTab === tab
                  ? 'bg-purple-600 border-transparent'
                  : 'border-zinc-700 text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Host Section */}
          {host && (activeGuestTab === 'All' || activeGuestTab === 'Speakers') && (
            <div className="px-4 py-3">
              <h3 className="text-zinc-400 text-sm font-semibold mb-3">Host</h3>
              <button
                onClick={() => navigateToProfile(host.id)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
              >
                <img
                  src={host.avatar_url || ''}
                  alt="host"
                  className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">{host.display_name}</p>
                  <p className="text-zinc-500 text-sm">@{host.username}</p>
                </div>
              </button>
            </div>
          )}

          {/* Listeners Section */}
          {filteredParticipants.filter(s => s.role === 'listener').length > 0 && (
            <div className="px-4 py-3">
              <h3 className="text-zinc-400 text-sm font-semibold mb-3">
                Listeners ({filteredParticipants.filter(s => s.role === 'listener').length})
              </h3>
              <div className="space-y-2">
                {filteredParticipants
                  .filter(s => s.role === 'listener')
                  .map(viewer => (
                    <button
                      key={viewer.id}
                      onClick={() => navigateToProfile(viewer.user_id)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
                    >
                      <img
                        src={viewer.profile?.avatar_url || ''}
                        alt={viewer.profile?.display_name}
                        className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{viewer.profile?.display_name}</p>
                        <p className="text-zinc-500 text-sm">@{viewer.profile?.username}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* FULLSCREEN VIDEO BACKGROUND */}
      <div className="absolute inset-0 bg-[#0a0b12]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isHost}
          className={cn(
            "w-full h-full object-cover",
            !hasVideo && "hidden"
          )}
        />
        {!hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0b12]">
            {host?.avatar_url ? (
              <img src={host.avatar_url} alt={host?.display_name} className="w-32 h-32 rounded-full border-4 border-rose-500" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-5xl font-bold border-4 border-rose-500">
                {host?.display_name?.[0] || 'H'}
              </div>
            )}
          </div>
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* HEADER OVERLAY CONTROLS */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 pt-safe">
        <div className="flex gap-2">
          <button onClick={handleMinimize} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all">
            <Minimize2 className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex gap-2">
          <div className="bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase text-white">HD Live</span>
          </div>
          <div className="bg-black/20 backdrop-blur-md px-2 py-1.5 rounded-full flex items-center gap-1 border border-white/10">
            <Users className="w-3 h-3 text-white/70" />
            <span className="text-[10px] font-black text-white">{viewers.length + 1}</span>
          </div>
          <button onClick={handleLeave} className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* HOST TAG - Tango Style */}
      <div className="absolute top-16 left-4 z-30 pt-safe">
        <button
          onClick={() => host && navigateToProfile(host.id)}
          className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1 rounded-full border border-white/10 pr-4"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-rose-500">
            {host?.avatar_url ? (
              <img src={host.avatar_url} alt={host?.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm">
                {host?.display_name?.[0] || 'H'}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-black leading-tight flex items-center gap-1 text-white">
              {host?.display_name} <Crown className="w-3 h-3 text-amber-400 fill-current" />
              {host?.is_verified && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
            </p>
            <p className="text-[10px] text-white/70 font-bold">{(viewers.length + 1).toLocaleString()} viewers</p>
          </div>
        </button>
      </div>

      {/* UI INTERACTION LAYER */}
      <div className="relative flex-1 flex flex-col justify-end p-4 pb-28 z-30 pointer-events-none h-full">
        {/* Flying Chat - TikTok Style */}
        <div className="w-full max-w-[280px] space-y-2 pointer-events-auto overflow-hidden h-[200px] flex flex-col justify-end" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)' }}>
          {replies.slice(-15).map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/5">
                <span className={cn(
                  "text-[11px] font-black mr-2",
                  msg.isGift ? 'text-amber-400' : 'text-rose-400'
                )}>{msg.user}:</span>
                <span className="text-[11px] font-medium text-white/90">{msg.text}</span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* RIGHT-SIDE ACTION STACK - TikTok style */}
        <div className="absolute right-4 bottom-36 flex flex-col gap-5 pointer-events-auto">
          {/* Heart / Reactions */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowReactions(true)}
              className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
            >
              <Heart className="w-6 h-6 text-rose-500" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-tighter text-white drop-shadow-md">React</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowShare(true)}
              className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
            >
              <Share2 className="w-6 h-6 text-white" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-tighter text-white drop-shadow-md">Share</span>
          </div>

          {/* Camera Flip - Host only */}
          {isHost && (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleCameraFlip}
                className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </button>
              <span className="text-[10px] font-black uppercase tracking-tighter text-white drop-shadow-md">Flip</span>
            </div>
          )}

          {/* Guests */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setView('guests')}
              className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
            >
              <Users className="w-6 h-6 text-white" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-tighter text-white drop-shadow-md">{viewers.length + 1}</span>
          </div>

          {/* PK Battle */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handlePKBattle}
              className="w-12 h-12 bg-gradient-to-tr from-rose-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/40 active:scale-90 transition-all animate-bounce"
            >
              <Zap className="w-6 h-6 text-white" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-tighter text-white drop-shadow-md">PK</span>
          </div>
        </div>
      </div>

      {/* Floating Reactions */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
        <AnimatePresence>
          {floatingReactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 40, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -200, scale: 0.6 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute flex flex-col items-center gap-1"
              style={{ left: `${r.left}%`, top: '40%' }}
            >
              <span className="text-5xl drop-shadow-lg">{r.emoji}</span>
              {r.displayName && (
                <span className="text-xs font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
                  {r.displayName}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Gift Reactions */}
      <FloatingReactions reactions={floatingGiftReactions} className="z-40" />

      {/* Gift Animations - Banner notifications */}
      <AnimatePresence mode="popLayout">
        {giftAnimations.map((gift) => (
          <motion.div
            key={gift.id}
            layout
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.4 }}
            className="fixed left-4 top-1/3 z-50 max-w-[280px]"
            style={{ willChange: 'transform, opacity' }}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-pink-500/90 backdrop-blur-sm shadow-lg">
              <motion.span
                className="text-3xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.6, repeat: 1 }}
              >
                {gift.emoji}
              </motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{gift.senderName}</p>
                <p className="text-white/80 text-xs truncate">sent {gift.emoji} to {gift.receiverName}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
                <span className="text-white text-xs font-bold">+{gift.value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* BOTTOM BROADCAST BAR */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black/80 to-transparent z-40">
        <div className="flex items-center gap-3">
          {/* Mic toggle - host only */}
          {isHost && (
            <button
              onClick={handleMicToggle}
              className={cn(
                "w-12 h-12 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90",
                isMicOn ? "bg-emerald-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
          )}

          {/* Chat input */}
          <form onSubmit={(e) => { e.preventDefault(); handleReplySubmit(); }} className="flex-1 relative">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Say something..."
              className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-5 py-3 text-sm font-medium text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className={cn(
                "absolute right-2 top-1.5 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90",
                replyText.trim() ? "bg-rose-500 text-white" : "bg-white/10 text-white/40"
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Gift button */}
          <button
            onClick={() => setShowGiftModal(true)}
            className="w-12 h-12 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-90 transition-all"
          >
            <Gift className="w-6 h-6 text-white" />
          </button>

          {/* Screen share - host only */}
          {isHost && (
            <button
              onClick={handleScreenShare}
              className={cn(
                "w-12 h-12 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90",
                isScreenSharing ? "bg-blue-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Monitor className="w-6 h-6" />
            </button>
          )}

          {/* Camera toggle - host only */}
          {isHost && (
            <button
              onClick={handleCameraToggle}
              className={cn(
                "w-12 h-12 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90",
                isCameraOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-rose-500 text-white"
              )}
            >
              {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          )}
        </div>

        {/* Recording indicator for host */}
        {isHost && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={handleRecordingToggle}
              disabled={recordingLoading}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all",
                isRecording
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-white/5 text-white/50 border border-white/10 hover:text-white"
              )}
            >
              <Circle className={cn("w-3 h-3", isRecording && "fill-rose-500 animate-pulse text-rose-500")} />
              {isRecording ? 'Recording' : 'Record'}
            </button>
          </div>
        )}
      </div>

      {/* REACTION PICKER */}
      {showReactions && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowReactions(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-[#11131E] rounded-t-3xl p-6 pb-safe border-t border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
            <div className="grid grid-cols-5 gap-4">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="text-4xl aspect-square flex items-center justify-center hover:scale-125 transition-transform active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHARE MENU */}
      {showShare && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowShare(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-[#11131E] rounded-t-3xl p-6 pb-safe border-t border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

            {/* Cover Image Preview */}
            <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/40">
              {stream?.cover_image_url ? (
                <img src={stream.cover_image_url} alt={stream?.title} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-20 bg-gradient-to-r from-rose-600/30 to-pink-600/30 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-rose-400" />
                </div>
              )}
              <div className="px-3 py-2">
                <p className="text-white text-sm font-semibold truncate">{stream?.title || 'Live Stream'}</p>
                <p className="text-zinc-500 text-xs truncate">feedinbeta.lovable.app</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const shareUrl = shareUrls.liveStream(streamId);
                  toast.success('Stream link copied!');
                  navigator.clipboard.writeText(shareUrl);
                  setShowShare(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Copy Link</span>
                <LinkIcon className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  const shareUrl = shareUrls.liveStream(streamId);
                  if (navigator.share) {
                    navigator.share({
                      title: stream?.title,
                      text: `Watch this live stream: ${stream?.title}`,
                      url: shareUrl,
                    });
                  }
                  setShowShare(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Share via...</span>
                <Share2 className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MENU */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowSettings(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-[#11131E] rounded-t-3xl p-6 border-t border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
            <div className="space-y-1">
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowAudioSettingsModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Adjust settings</span>
                <Settings className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowFeedbackModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Share feedback</span>
                <MessageSquare className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowRulesModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">View rules</span>
                <FileText className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowReportModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="text-rose-500 font-medium">Report this Stream</span>
                <Flag className="w-5 h-5 text-rose-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT SIDEBAR */}
      {showChat && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          className="fixed inset-0 z-50 bg-black/60 flex justify-end"
          onClick={() => setShowChat(false)}
        >
          <motion.div
            className="w-full max-w-md bg-[#11131E] flex flex-col h-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold">Stream</h2>
              <button onClick={() => setShowChat(false)} className="p-2">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="px-4 py-4 border-b border-white/10">
              <div className="space-y-2">
                <p className="text-sm text-white font-medium">{host?.display_name} • LIVE</p>
                <p className="text-lg text-white font-bold">{stream?.title}</p>
                <div className="flex gap-2 text-xs text-zinc-400">
                  <span>🔴 Live</span>
                  <span>👥 {viewers.length + 1} watching</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
              <h3 className="text-zinc-400 text-sm font-semibold mb-4">
                {replies.length > 0 ? `${replies.length} replies` : 'No replies yet'}
              </h3>
              <ThreadedRepliesList
                replies={replies}
                onReplyToMessage={handleReplyToMessage}
                onLikeMessage={handleLikeMessage}
                onNavigateToProfile={navigateToProfile}
              />
            </div>
            <div className="px-4 py-4 border-t border-white/10 pb-safe">
              {replyingTo && (
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs text-zinc-400">
                    Replying to <span className="text-rose-400">{replyingTo.handle}</span>
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReplySubmit();
                    }
                  }}
                  placeholder={replyingTo ? `Reply to ${replyingTo.user}...` : "Say something..."}
                  className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-rose-500/50"
                />
                <button
                  onClick={handleReplySubmit}
                  disabled={!replyText.trim()}
                  className="p-2 text-rose-500 hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showGiftModal && (
        <LiveGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          streamId={streamId}
          hostId={stream?.user_id || ''}
          viewers={viewers.map(v => ({
            id: v.user_id,
            display_name: v.profile?.display_name || 'User',
            username: v.profile?.username || 'user',
            avatar_url: v.profile?.avatar_url || '',
          }))}
          isHost={isHost}
          isSpace={false}
        />
      )}

      <ReportContentModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        contentType="live_stream"
        contentId={streamId}
        reportedUserId={stream?.user_id}
      />

      <SpaceRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      <SpaceFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        spaceId={streamId}
        spaceTitle={stream?.title || 'Stream'}
      />

      <SpaceAudioSettingsModal
        isOpen={showAudioSettingsModal}
        onClose={() => setShowAudioSettingsModal(false)}
      />

      <PKBattleChallenge
        isOpen={showPKBattle}
        onClose={() => setShowPKBattle(false)}
        mode="select"
        onAccept={() => {
          setShowPKBattle(false);
          toast.success('PK Battle started!');
        }}
        onDecline={() => setShowPKBattle(false)}
        availableUsers={viewers.map(v => ({
          id: v.user_id,
          name: v.profile?.display_name || 'User',
          avatar: v.profile?.avatar_url,
          isLive: true,
        }))}
        onSelectChallenger={(userId) => {
          setShowPKBattle(false);
          toast.success(`Challenge sent to user!`);
        }}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .pb-safe {
          padding-bottom: max(1rem, env(safe-area-inset-bottom));
        }
        .pt-safe {
          padding-top: max(1rem, env(safe-area-inset-top));
        }
      `}</style>
    </div>
  );
};

export default TwitterStreamRoom;
