import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { useNavigation } from '@/context/NavigationContext';
import { usePKBattle } from '@/hooks/usePKBattle';
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
  FileText,
  ArrowLeft,
  Gift,
  Video,
  VideoOff,
  Swords,
  Camera,
  Minimize2,
  Crown,
  RotateCcw,
  Zap,
  CheckCircle2,
  MoreHorizontal,
  Coins,
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
} from 'livekit-client';

import { LiveGiftModal } from '../LiveGiftModal';
import { ReportContentModal } from '@/components/moderation/ReportContentModal';
import { SpaceRulesModal } from './SpaceRulesModal';
import { SpaceFeedbackModal } from './SpaceFeedbackModal';
import { SpaceAudioSettingsModal } from './SpaceAudioSettingsModal';
import { FloatingReactions } from '../FloatingReactions';
import { QuickGiftBar } from '../shared/QuickGiftBar';
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
  const { createBattle, sendChallenge, battle, loading: pkLoading } = usePKBattle(streamId);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const reactionsChannelRef = useRef<any>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // View states
  const [view, setView] = useState<'main' | 'guests'>('main');
  const [showChat, setShowChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showQuickGift, setShowQuickGift] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState(false);

  // Gift animations state
  const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);
  const [floatingGiftReactions, setFloatingGiftReactions] = useState<FloatingGiftReaction[]>([]);
  const [hostGiftTotal, setHostGiftTotal] = useState(0);

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

  // PK Battle
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

    // Fetch initial host gift total
    const { data: giftData } = await supabase
      .from('live_stream_gifts')
      .select('credit_value')
      .eq('stream_id', streamId)
      .eq('receiver_id', streamData.user_id);

    if (giftData) {
      setHostGiftTotal(giftData.reduce((sum, g) => sum + (g.credit_value || 0), 0));
    }

    await fetchViewers();
    setLoading(false);

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

      lkRoom.on(RoomEvent.ParticipantConnected, () => fetchViewers());
      lkRoom.on(RoomEvent.ParticipantDisconnected, () => fetchViewers());

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

      await lkRoom.connect(data.url, data.token);

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

  // Realtime subscriptions — broadcast-based reactions (matching space pattern)
  useEffect(() => {
    if (!streamId) return;

    // Reactions via BROADCAST (not postgres_changes) — faster, matches space
    const reactionsChannel = supabase
      .channel(`stream-reactions-${streamId}`)
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        const data = payload.payload;
        if (data?.user_id !== user?.id) {
          handleFloatingReaction(data?.emoji || '❤️', data?.display_name);
        }
      })
      .subscribe();

    reactionsChannelRef.current = reactionsChannel;

    // Gift channel — also update hostGiftTotal
    const giftChannel = supabase
      .channel(`stream-gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        const giftData = payload.new;

        // Update host gift total
        if (giftData.receiver_id === stream?.user_id) {
          setHostGiftTotal(prev => prev + (giftData.credit_value || 0));
        }

        // Show toast to host
        if (isHost && giftData.sender_id !== user?.id) {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', giftData.sender_id)
            .single();
          toast.success(`🎁 ${senderProfile?.display_name || 'Someone'} sent you ${giftData.credit_value} credits!`);
        }

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
          rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌', credits: '💰',
        };

        const emoji = giftEmojis[giftData.gift_type] || '🎁';

        setFloatingGiftReactions(prev => [...prev, {
          id: giftData.id,
          type: giftData.gift_type,
          senderName: senderProfile?.display_name || 'Someone',
          emoji,
        }]);

        const newGiftAnim: GiftAnimation = {
          id: giftData.id,
          emoji,
          senderName: senderProfile?.display_name || 'Someone',
          receiverName: receiverProfile?.display_name || 'Host',
          value: giftData.credit_value || 1,
        };
        setGiftAnimations(prev => [...prev, newGiftAnim]);

        // Add gift message to chat
        setReplies(prev => [...prev, {
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
        }]);

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
      reactionsChannelRef.current = null;
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(giftChannel);
      supabase.removeChannel(streamChannel);
    };
  }, [streamId, user?.id, stream?.user_id]);

  // Fetch replies + broadcast chat subscription with optimistic updates
  useEffect(() => {
    if (!streamId) return;

    const fetchReplies = async () => {
      const supabaseAny = supabase as any;
      const { data, error } = await supabaseAny
        .from('live_stream_messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(30);

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

    const channel = supabase
      .channel(`stream-chat-${streamId}`)
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const msgData = payload.payload;
        // Only add if not from current user (we already added optimistically)
        if (msgData?.user_id && msgData.user_id !== user?.id) {
          setReplies(prev => [...prev, {
            id: msgData.id || `msg-${Date.now()}`,
            user_id: msgData.user_id,
            user: msgData.display_name || 'User',
            handle: '@' + (msgData.username || 'user'),
            time: 'Just now',
            text: msgData.content || '',
            avatar: msgData.avatar_url || '',
            likes: 0,
            liked_by_me: false,
          }]);
          setUnreadMessages(prev => prev + 1);
        }
      })
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      chatChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [streamId]);

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

  // Camera flip with fallback
  const handleCameraFlip = async () => {
    if (!isHost || !videoTrackRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      await videoTrackRef.current.restartTrack({ facingMode: newFacing });
      setFacingMode(newFacing);
    } catch (e) {
      // Fallback: stop current track, create new one
      try {
        const room = roomRef.current;
        if (!room) return;
        const oldTrack = videoTrackRef.current;
        await room.localParticipant.unpublishTrack(oldTrack);
        oldTrack.stop();

        const newTrack = await createLocalVideoTrack({
          facingMode: newFacing,
          resolution: VideoPresets.h720,
        });
        videoTrackRef.current = newTrack;
        if (videoRef.current) {
          newTrack.attach(videoRef.current);
        }
        await room.localParticipant.publishTrack(newTrack);
        setFacingMode(newFacing);
      } catch (e2) {
        toast.error('Failed to flip camera');
      }
    }
  };

  // Handle leave/end
  const handleLeave = async () => {
    if (isHost) {
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

  const handleMinimize = () => {
    if (streamContext) {
      streamContext.minimizeStream();
    }
    navigate('/live');
  };

  // Reaction via broadcast channel (matching space pattern)
  const handleReaction = async (emoji: string) => {
    setShowReactions(false);
    const myName = host?.display_name || user?.user_metadata?.display_name || 'Someone';
    handleFloatingReaction(emoji, myName);

    // Broadcast for instant UI — use stored channel ref
    if (reactionsChannelRef.current) {
      reactionsChannelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji, user_id: user?.id, display_name: myName },
      });
    }

    // Persist to DB (fire-and-forget)
    const reactionTypes: Record<string, string> = {
      '❤️': 'heart', '👍': 'like', '😂': 'laugh', '🔥': 'fire', '👏': 'clap', '😍': 'love', '⭐': 'star',
    };
    supabase.from('live_stream_reactions').insert({
      stream_id: streamId,
      user_id: user?.id,
      reaction_type: reactionTypes[emoji] || 'heart',
    });
  };

  // Chat with optimistic update
  const handleReplySubmit = async () => {
    if (!user || !replyText.trim()) return;

    const content = replyingTo
      ? `@${replyingTo.handle.replace('@', '')} ${replyText}`
      : replyText;

    const myProfile = host?.id === user.id ? host : viewers.find(v => v.user_id === user.id)?.profile;
    const displayName = myProfile?.display_name || user.user_metadata?.display_name || 'You';
    const username = myProfile?.username || user.user_metadata?.username || 'user';
    const avatarUrl = myProfile?.avatar_url || '';

    // Optimistic update — add immediately
    const optimisticMsg: Reply = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      user: displayName,
      handle: '@' + username,
      time: 'Just now',
      text: content,
      avatar: avatarUrl,
      likes: 0,
      liked_by_me: false,
    };
    setReplies(prev => [...prev, optimisticMsg]);

    const { error } = await (supabase as any).from('live_stream_messages').insert({
      stream_id: streamId,
      user_id: user.id,
      content,
    });

    if (!error) {
      // Broadcast with message data so others get it instantly — use stored channel ref
      if (chatChannelRef.current) {
        chatChannelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            user_id: user.id,
            content,
            display_name: displayName,
            username,
            avatar_url: avatarUrl,
          },
        });
      }
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

  // PK Battle — actually wire up
  const handlePKSelectChallenger = async (userId: string) => {
    setShowPKBattle(false);
    const newBattle = await createBattle(300);
    if (newBattle) {
      await sendChallenge(userId);
    }
  };

  // Auto-scroll flying chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <p className="text-white/60 text-sm font-medium">Joining stream...</p>
        </div>
      </div>
    );
  }

  // Guests view
  const sortedParticipants = [
    ...(host ? [{
      id: host.id,
      user_id: host.id,
      role: 'host',
      is_muted: !isMicOn,
      has_raised_hand: false,
      profile: host,
    }] : []),
    ...viewers.filter(v => v.user_id !== host?.id),
  ];

  if (view === 'guests') {
    const filteredParticipants = sortedParticipants.filter(s => {
      if (activeGuestTab === 'All') return true;
      if (activeGuestTab === 'Co-hosts') return s.role === 'co_host';
      if (activeGuestTab === 'Speakers') return s.role === 'host' || s.role === 'speaker';
      if (activeGuestTab === 'Listening') return s.role === 'listener';
      return true;
    });

    return (
      <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col min-h-[100dvh]">
        <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between pt-safe">
          <button onClick={() => setView('main')} className="p-2 rounded-full hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-white font-black text-lg">Guests</h2>
          <div className="w-9" />
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/5">
            <Search className="w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search guests"
              className="flex-1 bg-transparent text-white placeholder-white/30 outline-none ml-3 text-sm"
            />
          </div>
        </div>

        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Co-hosts', 'Speakers', 'Listening'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveGuestTab(tab)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                activeGuestTab === tab
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/5 text-white/50 border border-white/5'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-safe">
          {host && (activeGuestTab === 'All' || activeGuestTab === 'Speakers') && (
            <div className="px-4 py-3">
              <h3 className="text-white/30 text-xs font-black uppercase tracking-wider mb-3">Host</h3>
              <button
                onClick={() => navigateToProfile(host.id)}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer w-full text-left transition-colors"
              >
                <img
                  src={host.avatar_url || ''}
                  alt="host"
                  className="w-12 h-12 rounded-full ring-2 ring-rose-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate flex items-center gap-1.5">
                    {host.display_name}
                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-current" />
                  </p>
                  <p className="text-white/30 text-sm">@{host.username}</p>
                </div>
              </button>
            </div>
          )}

          {filteredParticipants.filter(s => s.role === 'listener').length > 0 && (
            <div className="px-4 py-3">
              <h3 className="text-white/30 text-xs font-black uppercase tracking-wider mb-3">
                Listeners ({filteredParticipants.filter(s => s.role === 'listener').length})
              </h3>
              <div className="space-y-1">
                {filteredParticipants
                  .filter(s => s.role === 'listener')
                  .map(viewer => (
                    <button
                      key={viewer.id}
                      onClick={() => navigateToProfile(viewer.user_id)}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer w-full text-left transition-colors"
                    >
                      <img
                        src={viewer.profile?.avatar_url || ''}
                        alt={viewer.profile?.display_name}
                        className="w-11 h-11 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{viewer.profile?.display_name}</p>
                        <p className="text-white/30 text-sm">@{viewer.profile?.username}</p>
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
    <div className="fixed inset-0 z-50 bg-[#050505] overflow-hidden min-h-[100dvh]">
      {/* FULLSCREEN VIDEO BACKGROUND */}
      <div className="absolute inset-0">
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
          <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
            <div className="flex flex-col items-center gap-4">
              {host?.avatar_url ? (
                <img src={host.avatar_url} alt={host?.display_name} className="w-28 h-28 rounded-full ring-4 ring-rose-500/50" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-4xl font-black ring-4 ring-rose-500/50">
                  {host?.display_name?.[0] || 'H'}
                </div>
              )}
              <p className="text-white/40 text-sm font-medium">Waiting for video...</p>
            </div>
          </div>
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
      </div>

      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 px-4 py-3 flex justify-between items-start z-40 pt-safe">
        <button onClick={handleMinimize} className="w-10 h-10 bg-black/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all">
          <Minimize2 className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-2">
          <div className="bg-black/30 backdrop-blur-xl px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase text-white">HD Live</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 bg-black/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <MoreHorizontal className="w-5 h-5 text-white" />
          </button>
          <button onClick={handleLeave} className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 active:scale-90 transition-all">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* HOST TAG */}
      <div className="absolute top-16 left-4 z-30 pt-safe">
        <button
          onClick={() => host && navigateToProfile(host.id)}
          className="flex items-center gap-2.5 bg-black/40 backdrop-blur-xl p-1.5 rounded-full border border-white/10 pr-4"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-rose-500">
            {host?.avatar_url ? (
              <img src={host.avatar_url} alt={host?.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 font-bold text-sm">
                {host?.display_name?.[0] || 'H'}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-black leading-tight flex items-center gap-1 text-white">
              {host?.display_name}
              <Crown className="w-3 h-3 text-amber-400 fill-current" />
              {host?.is_verified && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 font-bold">{(viewers.length + 1).toLocaleString()} viewers</span>
            </div>
          </div>
        </button>

        {/* Gift count box — always visible to all */}
        <div className="mt-2 ml-1 flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-xl px-3 py-1.5 rounded-full border border-amber-500/20">
          <Gift className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-black text-amber-400">{hostGiftTotal.toLocaleString()}</span>
          <Coins className="w-3 h-3 text-amber-400/60" />
        </div>
      </div>

      {/* MAIN CONTENT LAYER */}
      <div className="relative flex-1 flex flex-col justify-end p-4 pb-32 z-30 pointer-events-none h-full">
        {/* Flying Chat */}
        <div
          className="w-full max-w-[75%] space-y-1.5 pointer-events-auto overflow-hidden flex flex-col justify-end"
          style={{
            height: '220px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%)',
          }}
        >
          <AnimatePresence initial={false}>
            {replies.slice(-20).map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2"
              >
                <div className={cn(
                  "px-3 py-2 rounded-2xl max-w-full",
                  msg.isGift
                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/20"
                    : "bg-black/40 backdrop-blur-md border border-white/5"
                )}>
                  <span className={cn(
                    "text-[11px] font-black mr-1.5",
                    msg.isGift ? 'text-amber-400' : 'text-rose-400'
                  )}>{msg.user}</span>
                  <span className="text-[11px] font-medium text-white/90">{msg.text}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* RIGHT-SIDE ACTION STACK */}
      <div className="absolute right-3 bottom-40 flex flex-col gap-4 z-40">
        {/* React */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowReactions(true)}
            className="w-11 h-11 bg-black/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <Heart className="w-5 h-5 text-rose-500" />
          </button>
          <span className="text-[9px] font-black uppercase tracking-tight text-white/70">React</span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowShare(true)}
            className="w-11 h-11 bg-black/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <span className="text-[9px] font-black uppercase tracking-tight text-white/70">Share</span>
        </div>

        {/* Camera Flip - Host only */}
        {isHost && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleCameraFlip}
              className="w-11 h-11 bg-black/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
            >
              <RotateCcw className="w-5 h-5 text-white" />
            </button>
            <span className="text-[9px] font-black uppercase tracking-tight text-white/70">Flip</span>
          </div>
        )}

        {/* Guests */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setView('guests')}
            className="w-11 h-11 bg-black/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <Users className="w-5 h-5 text-white" />
          </button>
          <span className="text-[9px] font-black uppercase tracking-tight text-white/70">{viewers.length + 1}</span>
        </div>

        {/* PK Battle - Host only */}
        {isHost && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowPKBattle(true)}
              className="w-11 h-11 bg-gradient-to-tr from-rose-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 active:scale-90 transition-all"
            >
              <Zap className="w-5 h-5 text-white" />
            </button>
            <span className="text-[9px] font-black uppercase tracking-tight text-white/70">PK</span>
          </div>
        )}
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
                <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
                  {r.displayName}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Gift Reactions */}
      <FloatingReactions reactions={floatingGiftReactions} className="z-40" />

      {/* Gift Animations */}
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
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-pink-500/90 backdrop-blur-sm shadow-lg">
              <motion.span
                className="text-3xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: 1 }}
              >
                {gift.emoji}
              </motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{gift.senderName}</p>
                <p className="text-white/80 text-xs truncate">sent {gift.emoji} to {gift.receiverName}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
                <span className="text-white text-xs font-black">+{gift.value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* QuickGiftBar */}
      <QuickGiftBar
        isOpen={showQuickGift}
        onClose={() => setShowQuickGift(false)}
        recipientId={stream?.user_id || ''}
        roomId={streamId}
        isSpace={false}
        hostId={stream?.user_id}
        onGiftSent={(gift) => {
          handleFloatingReaction(gift.emoji, 'You');
        }}
      />

      {/* BOTTOM BROADCAST BAR */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black/80 via-black/40 to-transparent z-40">
        <div className="flex items-center gap-2.5 max-w-lg mx-auto">
          {/* Mic toggle - host only */}
          {isHost && (
            <button
              onClick={handleMicToggle}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0",
                isMicOn ? "bg-white/15 text-white" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              )}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          )}

          {/* Chat input */}
          <form onSubmit={(e) => { e.preventDefault(); handleReplySubmit(); }} className="flex-1 relative min-w-0">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Say something..."
              className="w-full bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5 text-sm font-medium text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all"
            />
            {replyText.trim() && (
              <button
                type="submit"
                className="absolute right-1.5 top-1 w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center active:scale-90 transition-all"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </form>

          {/* Gift button */}
          <button
            onClick={() => setShowQuickGift(!showQuickGift)}
            className="w-11 h-11 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-90 transition-all shrink-0"
          >
            <Gift className="w-5 h-5 text-white" />
          </button>

          {/* Camera toggle - host only */}
          {isHost && (
            <button
              onClick={handleCameraToggle}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0",
                isCameraOn ? "bg-white/15 text-white" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              )}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* REACTION PICKER */}
      <AnimatePresence>
        {showReactions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowReactions(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="grid grid-cols-5 gap-4">
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="text-4xl aspect-square flex items-center justify-center hover:scale-125 transition-transform active:scale-90 rounded-2xl hover:bg-white/5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHARE MENU */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowShare(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4" />

              {stream?.cover_image_url && (
                <div className="mb-4 rounded-2xl overflow-hidden border border-white/5">
                  <img src={stream.cover_image_url} alt={stream?.title} className="w-full h-28 object-cover" />
                </div>
              )}
              <p className="text-white font-bold mb-4">{stream?.title || 'Live Stream'}</p>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    const shareUrl = shareUrls.liveStream(streamId);
                    navigator.clipboard.writeText(shareUrl);
                    toast.success('Link copied!');
                    setShowShare(false);
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-white font-medium">Copy Link</span>
                  <LinkIcon className="w-5 h-5 text-white/30" />
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
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-white font-medium">Share via...</span>
                  <Share2 className="w-5 h-5 text-white/30" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETTINGS MENU */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="space-y-1">
                <button
                  onClick={() => { setShowSettings(false); setShowAudioSettingsModal(true); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-white font-medium">Adjust settings</span>
                  <Settings className="w-5 h-5 text-white/30" />
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowFeedbackModal(true); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-white font-medium">Share feedback</span>
                  <MessageSquare className="w-5 h-5 text-white/30" />
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowRulesModal(true); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-white font-medium">View rules</span>
                  <FileText className="w-5 h-5 text-white/30" />
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowGiftModal(true); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-white font-medium">Full Gift Store</span>
                  <Gift className="w-5 h-5 text-white/30" />
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowReportModal(true); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <span className="text-rose-400 font-medium">Report this Stream</span>
                  <Flag className="w-5 h-5 text-rose-400/50" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHAT SIDEBAR */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed inset-0 z-50 bg-black/60 flex justify-end"
            onClick={() => setShowChat(false)}
          >
            <motion.div
              className="w-full max-w-md bg-[#0F1119] flex flex-col h-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between pt-safe">
                <h2 className="text-white font-black">Stream Chat</h2>
                <button onClick={() => setShowChat(false)} className="p-2 rounded-full hover:bg-white/5">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
                <ThreadedRepliesList
                  replies={replies}
                  onReplyToMessage={handleReplyToMessage}
                  onLikeMessage={handleLikeMessage}
                  onNavigateToProfile={navigateToProfile}
                />
              </div>
              <div className="px-4 py-4 border-t border-white/5 pb-safe">
                {replyingTo && (
                  <div className="flex items-center justify-between mb-2 px-2">
                    <span className="text-xs text-white/40">
                      Replying to <span className="text-rose-400">{replyingTo.handle}</span>
                    </span>
                    <button onClick={() => setReplyingTo(null)} className="text-white/30 hover:text-white">
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
                    className="flex-1 bg-white/5 text-white placeholder-white/30 rounded-full px-4 py-2.5 outline-none focus:ring-1 focus:ring-rose-500/50 text-sm border border-white/5"
                  />
                  <button
                    onClick={handleReplySubmit}
                    disabled={!replyText.trim()}
                    className="p-2 text-rose-500 hover:text-rose-400 disabled:opacity-30"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
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
        }}
        onDecline={() => setShowPKBattle(false)}
        availableUsers={viewers.map(v => ({
          id: v.user_id,
          name: v.profile?.display_name || 'User',
          avatar: v.profile?.avatar_url,
          isLive: true,
        }))}
        onSelectChallenger={handlePKSelectChallenger}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
        .pt-safe { padding-top: max(1rem, env(safe-area-inset-top)); }
      `}</style>
    </div>
  );
};

export default TwitterStreamRoom;
