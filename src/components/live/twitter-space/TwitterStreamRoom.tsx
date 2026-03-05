import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  UserPlus,
  Flame,
  LogOut,
  Plus,
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
import type { PKParticipant } from '../unified/PKBattleBar';

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
  is_co_broadcaster?: boolean;
  is_mic_on?: boolean;
  host_muted?: boolean;
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
  room_type?: string;
  pk_max_slots?: number;
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

// PK Battle participant colors
const PK_COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

// Quick gift items matching existing system
const STREAM_GIFTS = [
  { id: 'rose', name: 'Rose', icon: '🌹', cost: 10 },
  { id: 'coffee', name: 'Coffee', icon: '☕', cost: 50 },
  { id: 'heart', name: 'Heart', icon: '💖', cost: 100 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', cost: 1000 },
];

const REACTION_EMOJIS = [
  '😂', '😮', '😢', '💜', '💯',
  '👏', '✊', '👍', '👎', '👋'
];

const formatNumber = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString();

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
  const [showStreamGiftModal, setShowStreamGiftModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRequestJoin, setShowRequestJoin] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [showRefill, setShowRefill] = useState(false);

  // Gift animations state
  const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);
  const [floatingGiftReactions, setFloatingGiftReactions] = useState<FloatingGiftReaction[]>([]);
  const [hostGiftTotal, setHostGiftTotal] = useState(0);
  const [giftOverlay, setGiftOverlay] = useState<{ icon: string; sender: string; name: string; receiver: string } | null>(null);

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
  const [viewerPresenceCount, setViewerPresenceCount] = useState(1);
  const [userCredits, setUserCredits] = useState(0);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);

  // PK Battle states
  const [showPKBattle, setShowPKBattle] = useState(false);
  const [battleParticipants, setBattleParticipants] = useState<PKParticipant[]>([]);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const [interactionTargetId, setInteractionTargetId] = useState<'all' | string>('all');
  const [battleTimeLeft, setBattleTimeLeft] = useState(300);
  const [battleActive, setBattleActive] = useState(false);

  const isHost = stream?.user_id === user?.id;
  const isPKMode = stream?.room_type === 'pk_battle';
  const pkMaxSlots = (stream as any)?.pk_max_slots || 2;

  // Hide bottom nav
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Fetch user credits
  useEffect(() => {
    if (!user?.id) return;
    const fetchCredits = async () => {
      const { data } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setUserCredits(data.balance || 0);
    };
    fetchCredits();
  }, [user?.id]);

  // Initialize stream + register as viewer via Presence
  useEffect(() => {
    const initStream = async () => {
      await fetchStreamData();

      // Register current user as active viewer in DB
      if (user?.id) {
        await supabase.from('live_stream_viewers').upsert({
          stream_id: streamId,
          user_id: user.id,
          is_active: true,
          joined_at: new Date().toISOString(),
        } as any, { onConflict: 'stream_id,user_id' });
      }
    };
    initStream();

    // Presence channel for accurate viewer count
    const presenceChannel = supabase.channel(`stream-presence-${streamId}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setViewerPresenceCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user?.id) {
          await presenceChannel.track({
            user_id: user.id,
            display_name: user.user_metadata?.display_name || 'User',
          });
        }
      });

    return () => {
      // Mark viewer as inactive on leave
      if (user?.id) {
        supabase.from('live_stream_viewers').update({
          is_active: false,
          left_at: new Date().toISOString(),
        } as any).eq('stream_id', streamId).eq('user_id', user.id);
      }
      supabase.removeChannel(presenceChannel);
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
    };
  }, [streamId, user?.id]);

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

    setStream(streamData as any);

    // If PK mode, initialize host as first participant
    if (streamData.room_type === 'pk_battle') {
      setBattleActive(true);
      setBattleTimeLeft(300);
    }

    // Fetch host profile
    const { data: hostData } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('id', streamData.user_id)
      .single() as any;

    if (hostData) {
      setHost(hostData);
      // Add host as first PK participant
      if (streamData.room_type === 'pk_battle') {
        setBattleParticipants([{
          id: hostData.id,
          name: hostData.display_name || 'Host',
          avatar: hostData.avatar_url || undefined,
          score: 0,
          color: PK_COLORS[0],
        }]);
      }
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

    setTimeout(() => initializeLiveKit(streamData as any), 100);
  };

  // Fetch viewers - separate queries to avoid FK join issues
  const fetchViewers = async () => {
    const { data: viewersData } = await supabase
      .from('live_stream_viewers')
      .select('*')
      .eq('stream_id', streamId)
      .eq('is_active', true);

    if (viewersData && viewersData.length > 0) {
      const userIds = viewersData.map((v: any) => v.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setViewers(viewersData.map((v: any) => ({
        id: v.user_id,
        user_id: v.user_id,
        role: v.role || (v.is_co_broadcaster ? 'co_broadcaster' : 'listener'),
        is_muted: !v.is_mic_on,
        has_raised_hand: v.has_raised_hand || false,
        is_co_broadcaster: v.is_co_broadcaster || false,
        is_mic_on: v.is_mic_on || false,
        host_muted: v.host_muted || false,
        profile: profileMap.get(v.user_id) as any,
      })));
    } else {
      setViewers([]);
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
            } as any).eq("id", streamId);
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

    // Gift channel — also update hostGiftTotal + PK scores
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

        // Update PK participant score
        if (isPKMode) {
          setBattleParticipants(prev => prev.map(p =>
            p.id === giftData.receiver_id
              ? { ...p, score: p.score + (giftData.credit_value || 0) }
              : p
          ));
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

        // Show fullscreen gift overlay
        setGiftOverlay({
          icon: emoji,
          sender: senderProfile?.display_name || 'Someone',
          name: giftData.gift_type,
          receiver: receiverProfile?.display_name || 'Host',
        });
        setTimeout(() => setGiftOverlay(null), 3000);

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

    // Stream events channel (ended, join requests, mute, co-broadcast)
    const streamChannel = supabase
      .channel(`stream-events-${streamId}`)
      .on('broadcast', { event: 'room_ended' }, () => {
        toast.info('Stream has ended');
        onClose();
      })
      .on('broadcast', { event: 'join_request' }, (payload: any) => {
        if (isHost) {
          const data = payload.payload;
          toast(`🙋 ${data.display_name || 'Someone'} wants to join`, {
            action: {
              label: 'Accept',
              onClick: () => handleInviteCreator(data.user_id),
            },
          });
        }
      })
      .on('broadcast', { event: 'host_mute' }, (payload: any) => {
        const data = payload.payload;
        if (data.user_id === user?.id) {
          toast.info(data.muted ? 'Host muted your mic' : 'Host unmuted your mic');
        }
        fetchViewers();
      })
      .on('broadcast', { event: 'co_broadcast_invite' }, (payload: any) => {
        if (payload.payload?.user_id === user?.id) {
          toast.success('You have been invited to co-broadcast!');
          fetchViewers();
        }
      })
      .subscribe();

    // Realtime viewer changes for co-broadcaster updates
    const viewerChangesChannel = supabase
      .channel(`stream-viewer-changes-${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, () => {
        fetchViewers();
      })
      .subscribe();

    return () => {
      reactionsChannelRef.current = null;
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(giftChannel);
      supabase.removeChannel(streamChannel);
      supabase.removeChannel(viewerChangesChannel);
    };
  }, [streamId, user?.id, stream?.user_id]);

  // PK Battle timer
  useEffect(() => {
    if (!battleActive || battleTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setBattleTimeLeft(prev => {
        if (prev <= 1) {
          setBattleActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [battleActive, battleTimeLeft]);

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
  // End stream (host only) or leave (viewer)
  const handleEndStream = async () => {
    if (isHost) {
      await supabase.from('live_streams').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      } as any).eq('id', streamId);

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

  // Leave as viewer (disconnect without ending stream)
  const handleViewerLeave = () => {
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

  // Reaction via broadcast channel
  const handleReaction = async (emoji: string) => {
    setShowReactions(false);
    const myName = host?.display_name || user?.user_metadata?.display_name || 'Someone';
    handleFloatingReaction(emoji, myName);

    if (reactionsChannelRef.current) {
      reactionsChannelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji, user_id: user?.id, display_name: myName },
      });
    }

    const reactionTypes: Record<string, string> = {
      '❤️': 'heart', '👍': 'like', '😂': 'laugh', '🔥': 'fire', '👏': 'clap', '😍': 'love', '⭐': 'star',
    };
    supabase.from('live_stream_reactions').insert({
      stream_id: streamId,
      user_id: user?.id,
      reaction_type: reactionTypes[emoji] || 'heart',
    } as any);
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

    // Broadcast immediately for real-time chat (don't wait for DB)
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: optimisticMsg.id,
          user_id: user.id,
          content,
          display_name: displayName,
          username,
          avatar_url: avatarUrl,
        },
      });
    }

    // Persist to DB (fire-and-forget for chat speed)
    supabase.from('live_stream_messages').insert({
      stream_id: streamId,
      user_id: user.id,
      content,
    } as any);

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

  // PK Battle — wire up
  const handlePKSelectChallenger = async (userId: string) => {
    setShowPKBattle(false);
    const newBattle = await createBattle(300);
    if (newBattle) {
      await sendChallenge(userId);
    }
  };

  // Invite user to co-broadcast or PK battle
  const handleInviteCreator = async (creatorId: string) => {
    const coBroadcasters = viewers.filter(v => v.is_co_broadcaster);

    if (isPKMode) {
      // PK mode: add to battle participants
      if (battleParticipants.length >= pkMaxSlots) return;
      if (battleParticipants.some(p => p.id === creatorId)) return;

      const viewer = viewers.find(v => v.user_id === creatorId);
      if (!viewer?.profile) return;

      setBattleParticipants(prev => [...prev, {
        id: creatorId,
        name: viewer.profile!.display_name || 'User',
        avatar: viewer.profile!.avatar_url || undefined,
        score: 0,
        color: PK_COLORS[prev.length % PK_COLORS.length],
      }]);

      setReplies(prev => [...prev, {
        id: `sys-${Date.now()}`,
        user_id: 'system', user: 'System', handle: '@system', time: 'Just now',
        text: `⚔️ ${viewer.profile!.display_name} joined the battle!`,
        avatar: '', likes: 0, liked_by_me: false,
      }]);

      const newBattle = await createBattle(300);
      if (newBattle) await sendChallenge(creatorId);
    } else {
      // Solo broadcast: add as co-broadcaster (max 10)
      if (coBroadcasters.length >= 10) {
        toast.error('Maximum 10 co-broadcasters allowed');
        return;
      }

      // Update viewer to co-broadcaster in DB
      await supabase.from('live_stream_viewers').update({
        is_co_broadcaster: true,
        role: 'co_broadcaster',
        is_mic_on: false,
      } as any).eq('stream_id', streamId).eq('user_id', creatorId);

      // Broadcast invite event
      supabase.channel(`stream-events-${streamId}`).send({
        type: 'broadcast',
        event: 'co_broadcast_invite',
        payload: { user_id: creatorId },
      });

      // Fetch profile for system message
      const { data: profile } = await supabase.from('profiles')
        .select('display_name').eq('id', creatorId).single();

      setReplies(prev => [...prev, {
        id: `sys-${Date.now()}`,
        user_id: 'system', user: 'System', handle: '@system', time: 'Just now',
        text: `🎙️ ${profile?.display_name || 'User'} joined the broadcast!`,
        avatar: '', likes: 0, liked_by_me: false,
      }]);

      toast.success(`Invited to co-broadcast!`);
      await fetchViewers();
    }

    setShowInviteModal(false);
  };

  // Send gift with target awareness (uses send_live_gift RPC)
  const handleSendStreamGift = async (gift: typeof STREAM_GIFTS[0]) => {
    if (!user) return;

    // Determine target
    const targetId = interactionTargetId === 'all'
      ? stream?.user_id || ''
      : interactionTargetId;

    const targetParticipant = battleParticipants.find(p => p.id === targetId);
    const targetName = targetParticipant?.name || host?.display_name || 'Host';

    if (userCredits < gift.cost) {
      toast.error('Not enough credits');
      return;
    }

    try {
      const { error } = await supabase.rpc('send_live_gift', {
        p_stream_id: streamId,
        p_gift_type: gift.id,
        p_credit_value: gift.cost,
      });

      if (error) throw error;

      // Optimistic local updates
      setUserCredits(prev => prev - gift.cost);

      // Show overlay
      setGiftOverlay({
        icon: gift.icon,
        sender: user.user_metadata?.display_name || 'You',
        name: gift.name,
        receiver: targetName,
      });
      setTimeout(() => setGiftOverlay(null), 3000);

      // Update PK score locally
      if (isPKMode) {
        setBattleParticipants(prev => prev.map(p =>
          p.id === targetId ? { ...p, score: p.score + gift.cost } : p
        ));
      }

      setShowStreamGiftModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send gift');
    }
  };

  // Focus/unfocus PK participant
  const handleParticipantTap = (participantId: string) => {
    if (focusedParticipantId === participantId) {
      setFocusedParticipantId(null);
      setInteractionTargetId('all');
    } else {
      setFocusedParticipantId(participantId);
      setInteractionTargetId(participantId);
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
      <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col min-h-[100dvh]" style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', overscrollBehavior: 'none', transform: 'translateZ(0)' }}>
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

  // --- RENDER PK PARTICIPANT VIDEO FEED ---
  const renderPKFeed = (p: PKParticipant, isFocused: boolean, isMini: boolean) => {
    const isHostParticipant = p.id === host?.id;

    return (
      <div
        key={p.id}
        onClick={() => handleParticipantTap(p.id)}
        className={cn(
          "relative overflow-hidden cursor-pointer transition-all duration-300",
          isFocused ? "absolute inset-0 z-0" : "",
          isMini
            ? "w-24 h-32 rounded-xl border-2 shadow-xl z-30 shrink-0"
            : "w-full h-full"
        )}
        style={{
          borderColor: isMini ? p.color : undefined,
          backgroundColor: !isHostParticipant ? p.color + '33' : undefined,
        }}
      >
        {isHostParticipant && isCameraOn ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: p.color + '22' }}>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black text-white/80"
              style={{ backgroundColor: p.color + '44' }}
            >
              {p.name[0]}
            </div>
            <span className="text-white/60 text-sm font-bold mt-2">{p.name}</span>
          </div>
        )}

        {/* SCORE badge */}
        <div className="absolute bottom-2 right-2 z-10">
          <span className="text-[10px] font-black text-white bg-black/60 px-2 py-1 rounded-full">
            SCORE: {p.score.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050505] overflow-hidden min-h-[100dvh]"
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation',
        overscrollBehavior: 'none',
        contain: 'layout style paint',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {/* VIDEO ENGINE */}
      <div className="absolute inset-0" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
        {isPKMode && battleParticipants.length > 0 ? (
          // PK MODE: Grid or Focus layout
          focusedParticipantId === null ? (
            // Grid layout
            <div className={cn(
              "w-full h-full grid gap-[1px]",
              pkMaxSlots <= 2 ? "grid-cols-1 grid-rows-2" : "grid-cols-2 grid-rows-2"
            )}>
              {battleParticipants.map(p => renderPKFeed(p, false, false))}
              {/* Empty slots */}
              {Array.from({ length: pkMaxSlots - battleParticipants.length }).map((_, i) => (
                <div key={`empty-${i}`} className="relative bg-black/90 flex flex-col items-center justify-center gap-3 border border-white/5">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <Users className="w-8 h-8 text-white/20" />
                  </div>
                  {isHost && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="text-[10px] font-bold bg-white/5 px-3 py-1 rounded-full text-white/60"
                    >
                      Invite PK
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Focus layout: one big + mini overlays
            <div className="relative w-full h-full">
              {battleParticipants.find(p => p.id === focusedParticipantId) &&
                renderPKFeed(battleParticipants.find(p => p.id === focusedParticipantId)!, true, false)}
              <div className="absolute bottom-32 right-3 flex flex-col gap-2 z-30">
                {battleParticipants
                  .filter(p => p.id !== focusedParticipantId)
                  .map(p => renderPKFeed(p, false, true))}
              </div>
            </div>
          )
        ) : (
          // SOLO MODE: Single video
          <>
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
          </>
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
      </div>

      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 px-4 py-3 flex justify-between items-center z-40 pt-safe" style={{ transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden' }}>
        <button
          onClick={() => host && navigateToProfile(host.id)}
          className="flex items-center gap-2.5 min-w-0 active:scale-95 transition-transform duration-75"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-rose-500 shrink-0">
            {host?.avatar_url ? (
              <img src={host.avatar_url} alt={host?.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-rose-500/30 flex items-center justify-center text-white text-xs font-black">
                {host?.display_name?.[0] || 'H'}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white leading-tight truncate">{stream?.title || 'Live Stream'}</span>
            <span className="text-[11px] text-white/50 font-medium flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {formatNumber(viewerPresenceCount)} watching
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Gift button - visible for both host and viewers */}
          <button
            onClick={() => setShowStreamGiftModal(true)}
            className="w-7 h-7 bg-amber-500/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-amber-500/30 active:scale-90 transition-all"
            title={isHost ? "Gift viewers" : "Send gift"}
          >
            <Gift className="w-3 h-3 text-amber-400" />
          </button>

          {/* Share */}
          <button
            onClick={() => setShowShare(true)}
            className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <Share2 className="w-3 h-3 text-white" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <MoreHorizontal className="w-3 h-3 text-white" />
          </button>

          {/* Minimize / PiP */}
          <button
            onClick={handleMinimize}
            className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
          >
            <Minimize2 className="w-3 h-3 text-white" />
          </button>

          {/* End / Leave */}
          <button
            onClick={isHost ? handleEndStream : handleViewerLeave}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-full text-white text-xs font-bold active:scale-90 transition-all"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        </div>
      </div>

      {/* Gift count badge removed from header — shown in PK score bar context */}

      {/* PK SCORE BAR */}
      {isPKMode && battleActive && battleParticipants.length > 0 && (
        <div className="absolute top-20 left-0 right-0 z-30 pt-safe px-3">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 p-3">
            {/* Header: TEAM HOST | Timer | CHALLENGERS */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Team Host</span>
              <div className="bg-black/60 px-3 py-0.5 rounded-full border border-yellow-500/50">
                <span className={cn(
                  "font-mono font-bold text-sm",
                  battleTimeLeft <= 10 ? "text-red-500" : "text-yellow-400"
                )}>
                  {Math.floor(battleTimeLeft / 60)}:{(battleTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Challengers</span>
            </div>
            {/* Proportional bar */}
            <div className="relative h-3 rounded-full overflow-hidden bg-white/5">
              {battleParticipants.map((p, i) => {
                const totalScore = battleParticipants.reduce((sum, pp) => sum + pp.score, 0) || 1;
                const percent = (p.score / totalScore) * 100;
                const offset = battleParticipants.slice(0, i).reduce((sum, pp) => sum + (pp.score / totalScore) * 100, 0);
                return (
                  <motion.div
                    key={p.id}
                    className="absolute inset-y-0"
                    style={{ left: `${offset}%`, backgroundColor: p.color }}
                    animate={{ width: `${percent}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* RIGHT-SIDE PANEL: Co-broadcasters + Viewers */}
      <div className="absolute right-3 bottom-44 z-30 flex flex-col items-center gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
        {/* Request to join for viewers */}
        {!isHost && (
          <button
            onClick={() => {
              toast.success('Request sent to host!');
              supabase.channel(`stream-events-${streamId}`).send({
                type: 'broadcast',
                event: 'join_request',
                payload: { user_id: user?.id, display_name: user?.user_metadata?.display_name },
              });
            }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="w-8 h-8 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10">
              <Plus className="w-3 h-3 text-white" />
            </div>
            <span className="text-[8px] text-white/60 font-bold">Request</span>
          </button>
        )}

        {/* Co-broadcasters (with mic indicator) */}
        {viewers.filter(v => v.is_co_broadcaster).map((viewer) => (
          <div key={`co-${viewer.user_id}`} className="relative flex flex-col items-center gap-0.5">
            <button
              onClick={() => navigateToProfile(viewer.user_id)}
              className="relative"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-400">
                {viewer.profile?.avatar_url ? (
                  <img src={viewer.profile.avatar_url} alt={viewer.profile.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-emerald-500/20 flex items-center justify-center text-white/60 text-sm font-bold">
                    {viewer.profile?.display_name?.[0] || '?'}
                  </div>
                )}
              </div>
              {/* Mic status indicator */}
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-black",
                viewer.host_muted || !viewer.is_mic_on ? 'bg-red-500' : 'bg-emerald-500'
              )}>
                {viewer.host_muted || !viewer.is_mic_on
                  ? <MicOff className="w-2.5 h-2.5 text-white" />
                  : <Mic className="w-2.5 h-2.5 text-white" />
                }
              </div>
            </button>
            <span className="text-[8px] text-white/60 font-medium truncate max-w-[48px]">
              {viewer.profile?.display_name?.slice(0, 7) || 'User'}
            </span>
            {/* Host can mute/unmute co-broadcasters */}
            {isHost && (
              <button
                onClick={async () => {
                  const newMuted = !viewer.host_muted;
                  await supabase.from('live_stream_viewers').update({
                    host_muted: newMuted,
                  } as any).eq('stream_id', streamId).eq('user_id', viewer.user_id);
                  // Broadcast mute event
                  supabase.channel(`stream-events-${streamId}`).send({
                    type: 'broadcast',
                    event: 'host_mute',
                    payload: { user_id: viewer.user_id, muted: newMuted },
                  });
                  fetchViewers();
                  toast.success(newMuted ? `Muted ${viewer.profile?.display_name}` : `Unmuted ${viewer.profile?.display_name}`);
                }}
                className="text-[7px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-full"
              >
                {viewer.host_muted ? 'Unmute' : 'Mute'}
              </button>
            )}
          </div>
        ))}

        {/* Regular viewer avatars */}
        {viewers.filter(v => !v.is_co_broadcaster).slice(0, 4).map((viewer) => (
          <button
            key={viewer.user_id}
            onClick={() => navigateToProfile(viewer.user_id)}
            className="relative flex flex-col items-center gap-0.5"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
              {viewer.profile?.avatar_url ? (
                <img src={viewer.profile.avatar_url} alt={viewer.profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/40 text-sm font-bold">
                  {viewer.profile?.display_name?.[0] || '?'}
                </div>
              )}
            </div>
            <span className="text-[8px] text-white/60 font-medium truncate max-w-[48px]">
              {viewer.profile?.display_name?.slice(0, 7) || 'User'}
            </span>
          </button>
        ))}

        {/* View all viewers */}
        {viewers.filter(v => !v.is_co_broadcaster).length > 4 && (
          <button
            onClick={() => setView('guests')}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="w-8 h-8 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10">
              <Users className="w-3 h-3 text-white/60" />
            </div>
            <span className="text-[8px] text-white/60 font-bold">+{viewers.filter(v => !v.is_co_broadcaster).length - 4}</span>
          </button>
        )}
      </div>

      {/* CHAT AREA */}
      <div className="absolute bottom-36 left-0 right-16 z-30 px-4">
        <div className="flex flex-col space-y-1 max-h-[160px] overflow-y-auto scrollbar-hide pointer-events-auto" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <AnimatePresence initial={false} mode="popLayout">
            {replies.slice(-20).map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-3 py-1.5"
              >
                {msg.user_id === 'system' || msg.isGift ? (
                  <span className="text-[11px] text-amber-400/80 font-medium">{msg.text}</span>
                ) : (
                  <>
                    <span className="text-[11px] font-black mr-1.5 text-rose-400">{msg.user}</span>
                    <span className="text-[11px] font-medium text-white/80">{msg.text}</span>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={chatEndRef} />
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

      {/* Fullscreen Gift Overlay */}
      <AnimatePresence>
        {giftOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="text-8xl drop-shadow-2xl">{giftOverlay.icon}</span>
              <div className="bg-black/70 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10">
                <p className="text-white font-bold text-center text-sm">
                  {giftOverlay.sender} sent {giftOverlay.name} to {giftOverlay.receiver}!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QuickGiftBar */}
      <QuickGiftBar
        isOpen={showQuickGift}
        onClose={() => setShowQuickGift(false)}
        recipientId={interactionTargetId === 'all' ? (stream?.user_id || '') : interactionTargetId}
        roomId={streamId}
        isSpace={false}
        hostId={stream?.user_id}
        onGiftSent={(gift) => {
          handleFloatingReaction(gift.emoji, 'You');
        }}
      />

      {/* BOTTOM BROADCAST BAR */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black/80 via-black/40 to-transparent z-40" style={{ transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden' }}>
        {/* PK Interaction target selector */}
        {isPKMode && battleParticipants.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setInteractionTargetId('all')}
              className={cn(
                "text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all",
                interactionTargetId === 'all'
                  ? 'bg-white text-black'
                  : 'bg-black/50 text-gray-400 border border-white/10'
              )}
            >
              ALL
            </button>
            {battleParticipants.map(p => (
              <button
                key={p.id}
                onClick={() => setInteractionTargetId(p.id)}
                className={cn(
                  "text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition-all",
                  interactionTargetId === p.id
                    ? 'bg-white text-black'
                    : 'bg-black/50 text-gray-400 border border-white/10'
                )}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Chat input */}
          <form onSubmit={(e) => { e.preventDefault(); handleReplySubmit(); }} className="flex-1 min-w-0">
            <div className="flex items-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full overflow-hidden">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Say something..."
                className="flex-1 min-w-0 bg-transparent text-xs font-medium text-white placeholder-white/30 focus:outline-none px-3 py-2"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-8 h-8 flex items-center justify-center text-white disabled:opacity-30 shrink-0"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </form>

          {/* React button */}
          <button
            onClick={() => setShowReactions(true)}
            className="w-8 h-8 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all shrink-0"
          >
            <Heart className="w-4 h-4 text-rose-400" />
          </button>

          {/* Refill / Recharge credits */}
          <button
            onClick={() => navigate('/wallet')}
            className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-90 transition-all shrink-0"
            title="Refill credits"
          >
            <Coins className="w-4 h-4 text-white" />
          </button>
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
                {isHost ? (
                  <>
                    {/* HOST-SPECIFIC SETTINGS */}
                    <button
                      onClick={() => { setShowSettings(false); handleMicToggle(); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">{isMicOn ? 'Mute Mic' : 'Unmute Mic'}</span>
                      {isMicOn ? <Mic className="w-5 h-5 text-white/30" /> : <MicOff className="w-5 h-5 text-white/30" />}
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); handleCameraToggle(); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">{isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}</span>
                      {isCameraOn ? <Video className="w-5 h-5 text-white/30" /> : <VideoOff className="w-5 h-5 text-white/30" />}
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); handleCameraFlip(); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">Flip Camera</span>
                      <RotateCcw className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setView('guests'); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">Manage Guests ({viewers.length + 1})</span>
                      <Users className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowInviteModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">{isPKMode ? 'Invite PK Challenger' : 'Invite to Stream'}</span>
                      {isPKMode ? <Swords className="w-5 h-5 text-white/30" /> : <UserPlus className="w-5 h-5 text-white/30" />}
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowAudioSettingsModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">Stream Settings</span>
                      <Settings className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowRulesModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">View Rules</span>
                      <FileText className="w-5 h-5 text-white/30" />
                    </button>
                    <div className="my-2 border-t border-white/5" />
                    <button
                      onClick={() => { setShowSettings(false); handleEndStream(); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-rose-500/10 rounded-2xl transition-colors"
                    >
                      <span className="text-rose-500 font-bold">End Stream</span>
                      <X className="w-5 h-5 text-rose-500/60" />
                    </button>
                  </>
                ) : (
                  <>
                    {/* VIEWER-SPECIFIC SETTINGS */}
                    <button
                      onClick={() => { setShowSettings(false); setView('guests'); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">View Guests ({viewers.length + 1})</span>
                      <Users className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowGiftModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">Full Gift Store</span>
                      <Gift className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowAudioSettingsModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">Audio Settings</span>
                      <Settings className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowFeedbackModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">Share Feedback</span>
                      <MessageSquare className="w-5 h-5 text-white/30" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); setShowRulesModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-white font-medium">View Rules</span>
                      <FileText className="w-5 h-5 text-white/30" />
                    </button>
                    <div className="my-2 border-t border-white/5" />
                    <button
                      onClick={() => { setShowSettings(false); setShowReportModal(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-rose-400 font-medium">Report Stream</span>
                      <Flag className="w-5 h-5 text-rose-400/50" />
                    </button>
                    <button
                      onClick={() => { setShowSettings(false); handleViewerLeave(); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <span className="text-rose-400 font-medium">Leave Stream</span>
                      <LogOut className="w-5 h-5 text-rose-400/50" />
                    </button>
                  </>
                )}
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

      {/* IN-STREAM INVITE MODAL */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="w-full max-w-md bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5 max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-400" /> Invite to Stream
                </h3>
                <button onClick={() => setShowInviteModal(false)} className="p-2 bg-white/5 rounded-full">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Username search */}
              <div className="flex items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/5 mb-4">
                <Search className="w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setInviteUsername(val);
                    if (val.length >= 2) {
                      setInviteSearching(true);
                      const { data } = await supabase
                        .from('profiles')
                        .select('id, display_name, username, avatar_url')
                        .or(`username.ilike.%${val}%,display_name.ilike.%${val}%`)
                        .neq('id', user?.id || '')
                        .limit(10);
                      setInviteSearchResults(data || []);
                      setInviteSearching(false);
                    } else {
                      setInviteSearchResults([]);
                    }
                  }}
                  placeholder="Search by username..."
                  className="flex-1 bg-transparent text-white placeholder-white/30 outline-none ml-3 text-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
                {/* Search results */}
                {inviteUsername.length >= 2 && (
                  <>
                    {inviteSearching && <p className="text-center text-white/30 text-sm py-4">Searching...</p>}
                    {!inviteSearching && inviteSearchResults.map((profile: any) => {
                      const isJoined = battleParticipants.some(p => p.id === profile.id);
                      const isInStream = viewers.some(v => v.user_id === profile.id) || profile.id === host?.id;
                      return (
                        <div key={profile.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={profile.avatar_url || ''} alt={profile.display_name} className="w-10 h-10 rounded-full" />
                            <div className="min-w-0">
                              <p className="text-white font-bold text-sm truncate">{profile.display_name}</p>
                              <p className="text-white/40 text-xs">@{profile.username}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (isPKMode) {
                                handleInviteCreator(profile.id);
                              } else {
                                // Send invite notification
                                supabase.channel(`stream-events-${streamId}`).send({
                                  type: 'broadcast',
                                  event: 'invite_user',
                                  payload: { user_id: profile.id, display_name: profile.display_name },
                                });
                                toast.success(`Invited @${profile.username}`);
                              }
                              setInviteUsername('');
                              setInviteSearchResults([]);
                            }}
                            disabled={isJoined}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                              isJoined ? 'bg-gray-800 text-gray-500'
                                : isInStream ? 'bg-blue-600 text-white'
                                : 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                            )}
                          >
                            {isJoined ? 'On Stage' : isInStream ? 'In Stream' : 'Invite'}
                          </button>
                        </div>
                      );
                    })}
                    {!inviteSearching && inviteSearchResults.length === 0 && inviteUsername.length >= 2 && (
                      <p className="text-center text-white/30 text-sm py-4">No users found</p>
                    )}
                  </>
                )}

                {/* Current viewers (when not searching) */}
                {inviteUsername.length < 2 && (
                  <>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-wider mb-2">Current Viewers</p>
                    {viewers.filter(v => v.user_id !== host?.id).map(viewer => {
                      const isJoined = battleParticipants.some(p => p.id === viewer.user_id);
                      return (
                        <div key={viewer.user_id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={viewer.profile?.avatar_url || ''} alt={viewer.profile?.display_name} className="w-10 h-10 rounded-full" />
                            <div className="min-w-0">
                              <p className="text-white font-bold text-sm truncate">{viewer.profile?.display_name}</p>
                              <p className="text-white/40 text-xs">@{viewer.profile?.username}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInviteCreator(viewer.user_id)}
                            disabled={isJoined || (isPKMode && battleParticipants.length >= pkMaxSlots)}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                              isJoined ? 'bg-gray-800 text-gray-500'
                                : 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                            )}
                          >
                            {isJoined ? 'On Stage' : 'Invite'}
                          </button>
                        </div>
                      );
                    })}
                    {viewers.filter(v => v.user_id !== host?.id).length === 0 && (
                      <p className="text-center text-white/30 text-sm py-8">No viewers yet</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IN-STREAM GIFT MODAL */}
      <AnimatePresence>
        {showStreamGiftModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
            onClick={() => setShowStreamGiftModal(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="w-full max-w-md bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-black text-lg">Send Gift</h3>
                <button onClick={() => setShowStreamGiftModal(false)} className="p-2 bg-white/5 rounded-full">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-white/60">
                  Sending to:{' '}
                  <span className="text-white font-bold">
                    {interactionTargetId === 'all'
                      ? host?.display_name || 'The Host'
                      : battleParticipants.find(p => p.id === interactionTargetId)?.name || 'Host'}
                  </span>
                </span>
                <span className="ml-auto text-xs text-amber-400 font-bold">{userCredits.toLocaleString()} credits</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {STREAM_GIFTS.map(gift => (
                  <button
                    key={gift.id}
                    onClick={() => handleSendStreamGift(gift)}
                    disabled={userCredits < gift.cost}
                    className={cn(
                      "flex flex-col items-center gap-2 bg-black/20 p-4 rounded-xl hover:bg-white/5 transition",
                      userCredits < gift.cost && "opacity-40 pointer-events-none"
                    )}
                  >
                    <span className="text-3xl">{gift.icon}</span>
                    <span className="text-[10px] font-bold text-white/60">{gift.cost}</span>
                  </button>
                ))}
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
        maxSlots={pkMaxSlots}
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
