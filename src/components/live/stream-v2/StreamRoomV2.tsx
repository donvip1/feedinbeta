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
  Room, RoomEvent, VideoPresets, LocalVideoTrack, LocalAudioTrack,
  Track, RemoteTrack, createLocalVideoTrack, createLocalAudioTrack, ConnectionState,
} from 'livekit-client';

import { VideoEngine } from './VideoEngine';
import { POVSwitcher } from './POVSwitcher';
import { InteractiveCanvas } from './InteractiveCanvas';
import { CoPilotJoystick } from './CoPilotJoystick';
import { StreamHeader } from './StreamHeader';
import { StreamChat } from './StreamChat';
import { StreamControls } from './StreamControls';
import { GiftOverlay } from './GiftOverlay';
import { StreamGuests } from './StreamGuests';
import { PollSystem } from './PollSystem';
import { HypeParticles } from './HypeParticles';
import { HypeMeter } from './HypeMeter';
import { EventTicker } from './EventTicker';
import { LightFlashOverlay } from './LightFlashOverlay';
import { PredictionSystem } from './PredictionSystem';
import {
  ShareSheet, SettingsSheet, ReactionPicker,
  InStreamGiftSheet, InviteModal,
} from './StreamSettings';

import { LiveGiftModal } from '../LiveGiftModal';
import { ReportContentModal } from '@/components/moderation/ReportContentModal';
import { SpaceRulesModal } from '../twitter-space/SpaceRulesModal';
import { SpaceFeedbackModal } from '../twitter-space/SpaceFeedbackModal';
import { SpaceAudioSettingsModal } from '../twitter-space/SpaceAudioSettingsModal';
import { QuickGiftBar } from '../shared/QuickGiftBar';
import { PKBattleChallenge } from '../unified/PKBattleChallenge';
import { InStreamRechargeSheet } from '../InStreamRechargeSheet';
import { useStreamStore } from '@/stores/useStreamStore';
import type { PKParticipant } from '../unified/PKBattleBar';

// Audio context for sound triggers
let audioCtx: AudioContext | null = null;
const playTriggerSound = () => {
  if (!audioCtx) audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.5);
};

interface StreamRoomV2Props {
  streamId: string;
  onClose: () => void;
}

// Types
interface GiftAnimation { id: string; emoji: string; senderName: string; receiverName: string; value: number; }
interface Viewer { id: string; user_id: string; role: string; is_muted: boolean; has_raised_hand: boolean; is_co_broadcaster?: boolean; is_mic_on?: boolean; host_muted?: boolean; profile?: { display_name: string; username: string; avatar_url: string; is_verified?: boolean; }; }
interface StreamData { id: string; title: string; description: string; user_id: string; status: string; viewer_count: number; category?: string; started_at?: string; cover_image_url?: string; room_type?: string; pk_max_slots?: number; }
interface FloatingReaction { id: string; emoji: string; left: number; displayName?: string; }
interface FloatingGiftReaction { id: string | number; type: string; senderName?: string; emoji?: string; }
interface Reply { id: string; user_id: string; user: string; handle: string; time: string; text: string; avatar: string; likes: number; liked_by_me: boolean; isGift?: boolean; }

const PK_COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b'];
const STREAM_GIFTS = [
  { id: 'rose', name: 'Rose', icon: '🌹', cost: 10 },
  { id: 'coffee', name: 'Coffee', icon: '☕', cost: 50 },
  { id: 'heart', name: 'Heart', icon: '💖', cost: 100 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', cost: 1000 },
];

const formatNumber = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString();

export const StreamRoomV2 = ({ streamId, onClose }: StreamRoomV2Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const streamContext = useOptionalLiveStreamContext();
  const { createBattle, sendChallenge } = usePKBattle(streamId);
  const updateStreak = useStreamStore((s) => s.updateStreak);
  const resetStream = useStreamStore((s) => s.resetStream);
  const boostHype = useStreamStore((s) => s.boostHype);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const chatChannelRef = useRef<any>(null);
  const reactionsChannelRef = useRef<any>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // View states
  const [view, setView] = useState<'main' | 'guests'>('main');
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
  const [showReactions, setShowReactions] = useState(false);
  const [showRefill, setShowRefill] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [isLightFlashing, setIsLightFlashing] = useState(false);
  const [latestTickerEvent, setLatestTickerEvent] = useState<string | undefined>();
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);

  // Gift animations
  const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);
  const [floatingGiftReactions, setFloatingGiftReactions] = useState<FloatingGiftReaction[]>([]);
  const [hostGiftTotal, setHostGiftTotal] = useState(0);
  const [giftOverlay, setGiftOverlay] = useState<{ icon: string; sender: string; name: string; receiver: string } | null>(null);

  // Data
  const [stream, setStream] = useState<StreamData | null>(null);
  const [host, setHost] = useState<any>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewerPresenceCount, setViewerPresenceCount] = useState(1);
  const [userCredits, setUserCredits] = useState(0);

  // Connection
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);

  // PK
  const [showPKBattle, setShowPKBattle] = useState(false);
  const [battleParticipants, setBattleParticipants] = useState<PKParticipant[]>([]);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const [interactionTargetId, setInteractionTargetId] = useState<'all' | string>('all');
  const [battleTimeLeft, setBattleTimeLeft] = useState(300);
  const [battleActive, setBattleActive] = useState(false);

  const isHost = stream?.user_id === user?.id;
  const isPKMode = stream?.room_type === 'pk_battle';
  const pkMaxSlots = (stream as any)?.pk_max_slots || 2;

  // Camera angles for POV switcher
  const cameraAngles = [
    { id: 'host', label: host?.display_name || 'Host', isActive: true },
    ...viewers.filter(v => v.is_co_broadcaster).map(v => ({
      id: v.user_id,
      label: v.profile?.display_name || 'Guest',
      isActive: true,
    })),
  ];

  // ===== EFFECTS =====

  // Hide bottom nav + prevent overscroll
  useEffect(() => {
    setHideBottomNav(true);
    const preventOverscroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const scrollable = target.closest('[data-scrollable="true"]') || target.closest('.scrollbar-hide');
      if (!scrollable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventOverscroll, { passive: false });
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      setHideBottomNav(false);
      document.removeEventListener('touchmove', preventOverscroll);
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [setHideBottomNav]);

  // Reset stream store on mount
  useEffect(() => { resetStream(); }, []);

  // Fetch user credits
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setUserCredits(data.balance || 0); });
  }, [user?.id]);

  // Initialize stream
  useEffect(() => {
    const initStream = async () => {
      await fetchStreamData();
      if (user?.id) {
        await supabase.from('live_stream_viewers').upsert({
          stream_id: streamId, user_id: user.id, is_active: true, joined_at: new Date().toISOString(),
        } as any, { onConflict: 'stream_id,user_id' });
      }
    };
    initStream();

    const presenceChannel = supabase.channel(`stream-presence-${streamId}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        setViewerPresenceCount(Object.keys(presenceChannel.presenceState()).length);
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
      if (user?.id) {
        supabase.from('live_stream_viewers').update({ is_active: false, left_at: new Date().toISOString() } as any)
          .eq('stream_id', streamId).eq('user_id', user.id);
      }
      supabase.removeChannel(presenceChannel);
      roomRef.current?.disconnect();
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
      if ((window as any).__viewerRefreshInterval) clearInterval((window as any).__viewerRefreshInterval);
    };
  }, [streamId, user?.id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!streamId) return;

    const reactionsChannel = supabase.channel(`stream-reactions-${streamId}`)
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        const data = payload.payload;
        if (data?.user_id !== user?.id) handleFloatingReaction(data?.emoji || '❤️', data?.display_name);
      }).subscribe();
    reactionsChannelRef.current = reactionsChannel;

    const giftChannel = supabase.channel(`stream-gifts-${streamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_stream_gifts', filter: `stream_id=eq.${streamId}` },
        async (payload: any) => { handleGiftEvent(payload.new); }).subscribe();

    const streamChannel = supabase.channel(`stream-events-${streamId}`)
      .on('broadcast', { event: 'room_ended' }, () => { toast.info('Stream has ended'); onClose(); })
      .on('broadcast', { event: 'join_request' }, (payload: any) => {
        if (isHost) {
          toast(`🙋 ${payload.payload?.display_name || 'Someone'} wants to join`, {
            action: { label: 'Accept', onClick: () => handleInviteCreator(payload.payload?.user_id) },
          });
        }
      })
      .on('broadcast', { event: 'host_mute' }, (payload: any) => {
        if (payload.payload?.user_id === user?.id) toast.info(payload.payload?.muted ? 'Host muted your mic' : 'Host unmuted your mic');
        fetchViewers();
      })
      .on('broadcast', { event: 'co_broadcast_invite' }, (payload: any) => {
        if (payload.payload?.user_id === user?.id) { toast.success('You have been invited to co-broadcast!'); fetchViewers(); }
      }).subscribe();

    // Poll channel
    const pollChannel = supabase.channel(`stream-polls-${streamId}`)
      .on('broadcast', { event: 'new_poll' }, (payload: any) => {
        useStreamStore.getState().addPoll(payload.payload);
      })
      .on('broadcast', { event: 'poll_vote' }, (payload: any) => {
        const { pollId, optionId } = payload.payload;
        useStreamStore.getState().updatePoll(pollId, {
          options: useStreamStore.getState().polls.find(p => p.id === pollId)?.options.map(o =>
            o.id === optionId ? { ...o, votes: o.votes + 1 } : o
          ) || [],
        });
      }).subscribe();

    const viewerChangesChannel = supabase.channel(`stream-viewer-changes-${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_stream_viewers', filter: `stream_id=eq.${streamId}` },
        () => fetchViewers()).subscribe();

    return () => {
      reactionsChannelRef.current = null;
      [reactionsChannel, giftChannel, streamChannel, pollChannel, viewerChangesChannel].forEach(ch => supabase.removeChannel(ch));
    };
  }, [streamId, user?.id, stream?.user_id]);

  // PK timer
  useEffect(() => {
    if (!battleActive || battleTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setBattleTimeLeft(prev => { if (prev <= 1) { setBattleActive(false); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [battleActive, battleTimeLeft]);

  // Chat subscription
  useEffect(() => {
    if (!streamId) return;
    fetchReplies();
    const channel = supabase.channel(`stream-chat-${streamId}`)
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const msgData = payload.payload;
        if (msgData?.user_id && msgData.user_id !== user?.id) {
          setReplies(prev => [...prev, {
            id: msgData.id || `msg-${Date.now()}`, user_id: msgData.user_id,
            user: msgData.display_name || 'User', handle: '@' + (msgData.username || 'user'),
            time: 'Just now', text: msgData.content || '', avatar: msgData.avatar_url || '',
            likes: 0, liked_by_me: false,
          }]);
        }
      }).subscribe();
    chatChannelRef.current = channel;
    return () => { chatChannelRef.current = null; supabase.removeChannel(channel); };
  }, [streamId]);

  // ===== HELPERS =====

  const fetchStreamData = async () => {
    const { data: streamData, error } = await supabase.from('live_streams').select('*').eq('id', streamId).maybeSingle();
    if (error || !streamData) { toast.error('Stream not found'); onClose(); return; }
    setStream(streamData as any);
    if (streamData.room_type === 'pk_battle') { setBattleActive(true); setBattleTimeLeft(300); }

    const { data: hostData } = await supabase.from('profiles').select('id, display_name, username, avatar_url').eq('id', streamData.user_id).single() as any;
    if (hostData) {
      setHost(hostData);
      updateStreak(hostData.id);
      if (streamData.room_type === 'pk_battle') {
        setBattleParticipants([{ id: hostData.id, name: hostData.display_name || 'Host', avatar: hostData.avatar_url, score: 0, color: PK_COLORS[0] }]);
      }
    }

    const { data: giftData } = await supabase.from('live_stream_gifts').select('credit_value').eq('stream_id', streamId).eq('receiver_id', streamData.user_id);
    if (giftData) setHostGiftTotal(giftData.reduce((sum, g) => sum + (g.credit_value || 0), 0));

    await fetchViewers();
    setLoading(false);
    (window as any).__viewerRefreshInterval = setInterval(fetchViewers, 15000);
    setTimeout(() => initializeLiveKit(streamData as any), 100);
  };

  const fetchViewers = async () => {
    const { data: viewersData } = await supabase.from('live_stream_viewers').select('*').eq('stream_id', streamId).eq('is_active', true);
    if (viewersData && viewersData.length > 0) {
      const userIds = viewersData.map((v: any) => v.user_id).filter(Boolean);
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setViewers(viewersData.map((v: any) => ({
        id: v.user_id, user_id: v.user_id,
        role: v.role || (v.is_co_broadcaster ? 'co_broadcaster' : 'listener'),
        is_muted: !v.is_mic_on, has_raised_hand: v.has_raised_hand || false,
        is_co_broadcaster: v.is_co_broadcaster || false, is_mic_on: v.is_mic_on || false,
        host_muted: v.host_muted || false, profile: profileMap.get(v.user_id) as any,
      })));
    } else { setViewers([]); }
  };

  const fetchReplies = async () => {
    const supabaseAny = supabase as any;
    const { data } = await supabaseAny.from('live_stream_messages').select('*').eq('stream_id', streamId).order('created_at', { ascending: false }).limit(30);
    if (!data || data.length === 0) return;
    const userIds = data.map((m: any) => m.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', userIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    setReplies(data.reverse().map((msg: any) => ({
      id: msg.id, user_id: msg.user_id,
      user: profileMap.get(msg.user_id)?.display_name || 'User',
      handle: '@' + (profileMap.get(msg.user_id)?.username || 'user'),
      time: getRelativeTime(msg.created_at), text: msg.content,
      avatar: profileMap.get(msg.user_id)?.avatar_url || '',
      likes: 0, liked_by_me: false,
    })));
  };

  const getRelativeTime = (dateStr: string) => {
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const h = Math.floor(diffMins / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  };

  const initializeLiveKit = async (streamData: StreamData) => {
    if (!user) return;
    try {
      setConnectionStatus('connecting');
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: { roomName: `stream-${streamId}`, participantName: user.user_metadata?.display_name || 'Viewer', participantIdentity: user.id, isHost: user.id === streamData.user_id },
      });
      if (error || !data?.token) throw new Error(data?.error || 'Failed to get LiveKit token');

      const lkRoom = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: VideoPresets.h720 } });
      roomRef.current = lkRoom;

      lkRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) {
          setConnectionStatus('connected');
          if (user.id === streamData.user_id) {
            toast.success("You are now live!");
            supabase.from("live_streams").update({ status: "live", stream_ready: true, connection_state: "live", started_at: new Date().toISOString() } as any).eq("id", streamId);
          }
        } else if (state === ConnectionState.Reconnecting) setConnectionStatus('reconnecting');
        else if (state === ConnectionState.Disconnected) setConnectionStatus('error');
      });

      lkRoom.on(RoomEvent.ParticipantConnected, () => fetchViewers());
      lkRoom.on(RoomEvent.ParticipantDisconnected, () => fetchViewers());

      lkRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && videoRef.current) { track.attach(videoRef.current); setHasVideo(true); }
        else if (track.kind === Track.Kind.Audio) { const el = document.createElement('audio'); el.autoplay = true; track.attach(el); document.body.appendChild(el); }
      });
      lkRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { track.detach(); if (track.kind === Track.Kind.Video) setHasVideo(false); });

      await lkRoom.connect(data.url, data.token);

      if (user.id === streamData.user_id) {
        const vTrack = await createLocalVideoTrack({ facingMode: "user", resolution: VideoPresets.h720 });
        const aTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
        videoTrackRef.current = vTrack; audioTrackRef.current = aTrack;
        if (videoRef.current) vTrack.attach(videoRef.current);
        await lkRoom.localParticipant.publishTrack(vTrack);
        await lkRoom.localParticipant.publishTrack(aTrack);
        setHasVideo(true); setIsMicOn(true); setIsCameraOn(true);
      }
    } catch (err: any) {
      console.error('[StreamRoomV2] LiveKit error:', err);
      setConnectionStatus('error');
      toast.error(err.message || 'Failed to connect');
    }
  };

  // ===== HANDLERS =====

  const handleFloatingReaction = (emoji: string, displayName?: string) => {
    const r: FloatingReaction = { id: `${Date.now()}-${Math.random()}`, emoji, left: 35 + Math.random() * 30, displayName };
    setFloatingReactions(prev => [...prev, r]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(x => x.id !== r.id)), 3000);
  };

  const handleGiftEvent = async (giftData: any) => {
    if (giftData.receiver_id === stream?.user_id) setHostGiftTotal(prev => prev + (giftData.credit_value || 0));
    if (isPKMode) setBattleParticipants(prev => prev.map(p => p.id === giftData.receiver_id ? { ...p, score: p.score + (giftData.credit_value || 0) } : p));

    const { data: senderProfile } = await supabase.from('profiles').select('display_name, username, avatar_url').eq('id', giftData.sender_id).single();
    const { data: receiverProfile } = await supabase.from('profiles').select('display_name, username').eq('id', giftData.receiver_id).single();
    const giftEmojis: Record<string, string> = { rose: '🌹', coffee: '☕', heart: '❤️', diamond: '💎', rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌', credits: '💰' };
    const emoji = giftEmojis[giftData.gift_type] || '🎁';

    setGiftOverlay({ icon: emoji, sender: senderProfile?.display_name || 'Someone', name: giftData.gift_type, receiver: receiverProfile?.display_name || 'Host' });
    setTimeout(() => setGiftOverlay(null), 3000);

    setFloatingGiftReactions(prev => [...prev, { id: giftData.id, type: giftData.gift_type, senderName: senderProfile?.display_name || 'Someone', emoji }]);

    const anim: GiftAnimation = { id: giftData.id, emoji, senderName: senderProfile?.display_name || 'Someone', receiverName: receiverProfile?.display_name || 'Host', value: giftData.credit_value || 1 };
    setGiftAnimations(prev => [...prev, anim]);
    setTimeout(() => setGiftAnimations(prev => prev.filter(g => g.id !== anim.id)), 5000);

    setReplies(prev => [...prev, {
      id: `gift-${giftData.id}`, user_id: giftData.sender_id, user: senderProfile?.display_name || 'Someone',
      handle: '@' + (senderProfile?.username || 'user'), time: 'Just now',
      text: `🎁 Sent ${emoji} ${giftData.gift_type} (${giftData.credit_value} credits)`,
      avatar: senderProfile?.avatar_url || '', likes: 0, liked_by_me: false, isGift: true,
    }]);
  };

  const handleMicToggle = () => { if (!isHost) return; audioTrackRef.current?.[isMicOn ? 'mute' : 'unmute'](); setIsMicOn(!isMicOn); };
  const handleCameraToggle = () => { if (!isHost) return; videoTrackRef.current?.[isCameraOn ? 'mute' : 'unmute'](); setIsCameraOn(!isCameraOn); };

  const handleCameraFlip = async () => {
    if (!isHost || !videoTrackRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      await videoTrackRef.current.restartTrack({ facingMode: newFacing });
      setFacingMode(newFacing);
    } catch {
      try {
        const room = roomRef.current; if (!room) return;
        const old = videoTrackRef.current; await room.localParticipant.unpublishTrack(old); old.stop();
        const newTrack = await createLocalVideoTrack({ facingMode: newFacing, resolution: VideoPresets.h720 });
        videoTrackRef.current = newTrack;
        if (videoRef.current) newTrack.attach(videoRef.current);
        await room.localParticipant.publishTrack(newTrack);
        setFacingMode(newFacing);
      } catch { toast.error('Failed to flip camera'); }
    }
  };

  const handleEndStream = async () => {
    if (isHost) {
      await supabase.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() } as any).eq('id', streamId);
      supabase.channel(`stream-events-${streamId}`).send({ type: 'broadcast', event: 'room_ended', payload: {} });
      toast.success('Stream ended');
    }
    roomRef.current?.disconnect();
    onClose();
  };

  const handleViewerLeave = () => { roomRef.current?.disconnect(); onClose(); };
  const handleMinimize = () => { streamContext?.minimizeStream(); navigate('/live'); };

  const handleReaction = async (emoji: string) => {
    setShowReactions(false);
    const myName = viewers.find(v => v.user_id === user?.id)?.profile?.display_name || user?.user_metadata?.display_name || 'Someone';
    handleFloatingReaction(emoji, myName);
    reactionsChannelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, user_id: user?.id, display_name: myName } });
    supabase.from('live_stream_reactions').insert({ stream_id: streamId, user_id: user?.id, reaction_type: 'heart' } as any);
  };

  const handleReplySubmit = async () => {
    if (!user || !replyText.trim()) return;
    const content = replyText;
    const myProfile = host?.id === user.id ? host : viewers.find(v => v.user_id === user.id)?.profile;
    const displayName = myProfile?.display_name || user.user_metadata?.display_name || 'You';
    const username = myProfile?.username || user.user_metadata?.username || 'user';
    const avatarUrl = myProfile?.avatar_url || '';

    const optimisticMsg: Reply = { id: `temp-${Date.now()}`, user_id: user.id, user: displayName, handle: '@' + username, time: 'Just now', text: content, avatar: avatarUrl, likes: 0, liked_by_me: false };
    setReplies(prev => [...prev, optimisticMsg]);
    chatChannelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: { id: optimisticMsg.id, user_id: user.id, content, display_name: displayName, username, avatar_url: avatarUrl } });
    supabase.from('live_stream_messages').insert({ stream_id: streamId, user_id: user.id, content } as any);
    setReplyText('');
  };

  const handleSendStreamGift = async (gift: typeof STREAM_GIFTS[0]) => {
    if (!user) return;
    const targetId = interactionTargetId === 'all' ? stream?.user_id || '' : interactionTargetId;
    if (userCredits < gift.cost) { toast.error('Not enough credits'); return; }
    try {
      const { error } = await supabase.rpc('send_live_gift', { p_stream_id: streamId, p_gift_type: gift.id, p_credit_value: gift.cost });
      if (error) throw error;
      setUserCredits(prev => prev - gift.cost);
      const targetName = battleParticipants.find(p => p.id === targetId)?.name || host?.display_name || 'Host';
      setGiftOverlay({ icon: gift.icon, sender: user.user_metadata?.display_name || 'You', name: gift.name, receiver: targetName });
      setTimeout(() => setGiftOverlay(null), 3000);
      if (isPKMode) setBattleParticipants(prev => prev.map(p => p.id === targetId ? { ...p, score: p.score + gift.cost } : p));
      setShowStreamGiftModal(false);
    } catch (err: any) { toast.error(err.message || 'Failed to send gift'); }
  };

  const handleInviteCreator = async (creatorId: string) => {
    if (isPKMode) {
      if (battleParticipants.length >= pkMaxSlots || battleParticipants.some(p => p.id === creatorId)) return;
      const viewer = viewers.find(v => v.user_id === creatorId);
      if (!viewer?.profile) return;
      setBattleParticipants(prev => [...prev, { id: creatorId, name: viewer.profile!.display_name || 'User', avatar: viewer.profile!.avatar_url, score: 0, color: PK_COLORS[prev.length % PK_COLORS.length] }]);
      const newBattle = await createBattle(300);
      if (newBattle) await sendChallenge(creatorId);
    } else {
      const coBroadcasters = viewers.filter(v => v.is_co_broadcaster);
      if (coBroadcasters.length >= 10) { toast.error('Max 10 co-broadcasters'); return; }
      await supabase.from('live_stream_viewers').update({ is_co_broadcaster: true, role: 'co_broadcaster', is_mic_on: false } as any).eq('stream_id', streamId).eq('user_id', creatorId);
      supabase.channel(`stream-events-${streamId}`).send({ type: 'broadcast', event: 'co_broadcast_invite', payload: { user_id: creatorId } });
      toast.success('Invited to co-broadcast!');
      await fetchViewers();
    }
    setShowInviteModal(false);
  };

  const handleInviteSearch = async (val: string) => {
    if (val.length >= 2) {
      setInviteSearching(true);
      const { data } = await supabase.from('profiles').select('id, display_name, username, avatar_url').or(`username.ilike.%${val}%,display_name.ilike.%${val}%`).neq('id', user?.id || '').limit(10);
      setInviteSearchResults(data || []);
      setInviteSearching(false);
    } else { setInviteSearchResults([]); }
  };

  const handleParticipantTap = (id: string) => {
    if (focusedParticipantId === id) { setFocusedParticipantId(null); setInteractionTargetId('all'); }
    else { setFocusedParticipantId(id); setInteractionTargetId(id); }
  };

  const handlePOVSelect = (angleId: string) => {
    // In a real multi-cam setup, this would swap which RemoteTrack is attached to videoRef
    // For now, it sets the active angle in the store
    console.log('[StreamRoomV2] POV angle selected:', angleId);
  };

  // ===== RENDER =====

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

  if (view === 'guests') {
    return (
      <StreamGuests
        host={host}
        viewers={viewers}
        isHost={isHost}
        isMicOn={isMicOn}
        onBack={() => setView('main')}
        onNavigateToProfile={(id) => navigate(`/profile/${id}`)}
      />
    );
  }

  const targetName = interactionTargetId === 'all'
    ? host?.display_name || 'The Host'
    : battleParticipants.find(p => p.id === interactionTargetId)?.name || 'Host';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050505] overflow-hidden min-h-[100dvh]"
      style={{
        WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation',
        overscrollBehavior: 'none', contain: 'layout style paint',
        transform: 'translateZ(0)', backfaceVisibility: 'hidden',
      }}
    >
      {/* Z-1: Video Engine */}
      <VideoEngine
        videoRef={videoRef} hasVideo={hasVideo} isCameraOn={isCameraOn}
        isHost={isHost} isPKMode={isPKMode} pkMaxSlots={pkMaxSlots}
        battleParticipants={battleParticipants} focusedParticipantId={focusedParticipantId}
        host={host} onParticipantTap={handleParticipantTap} onInvite={() => setShowInviteModal(true)}
      />

      {/* Z-10: Interactive Canvas */}
      <InteractiveCanvas />

      {/* Z-20: Overlay Layer */}

      {/* Header */}
      <StreamHeader
        streamId={streamId} streamTitle={stream?.title || 'Live Stream'} host={host}
        isHost={isHost} viewerCount={viewerPresenceCount} viewers={viewers}
        onHostProfile={() => host && navigate(`/profile/${host.id}`)}
        onViewGuests={() => setView('guests')}
        onGift={() => setShowStreamGiftModal(true)} onShare={() => setShowShare(true)}
        onSettings={() => setShowSettings(true)} onMinimize={handleMinimize}
        onEnd={isHost ? handleEndStream : handleViewerLeave}
      />

      {/* PK Score Bar */}
      {isPKMode && battleActive && battleParticipants.length > 0 && (
        <div className="absolute top-20 left-0 right-0 z-30 pt-safe px-3">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Team Host</span>
              <div className="bg-black/60 px-3 py-0.5 rounded-full border border-yellow-500/50">
                <span className={`font-mono font-bold text-sm ${battleTimeLeft <= 10 ? 'text-red-500' : 'text-yellow-400'}`}>
                  {Math.floor(battleTimeLeft / 60)}:{(battleTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Challengers</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-white/5">
              {battleParticipants.map((p, i) => {
                const total = battleParticipants.reduce((s, pp) => s + pp.score, 0) || 1;
                const pct = (p.score / total) * 100;
                const offset = battleParticipants.slice(0, i).reduce((s, pp) => s + (pp.score / total) * 100, 0);
                return (
                  <motion.div key={p.id} className="absolute inset-y-0" style={{ left: `${offset}%`, backgroundColor: p.color }}
                    animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 100, damping: 15 }} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Co-Pilot Joystick (host only) */}
      <CoPilotJoystick isHost={isHost} onCreatePoll={() => setShowPollCreator(true)} />

      {/* POV Switcher */}
      <POVSwitcher angles={cameraAngles} onSelectAngle={handlePOVSelect} />

      {/* Right-side panel: co-broadcasters + viewers */}
      <div className="absolute right-3 bottom-44 z-30 flex flex-col items-center gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide"
        style={{ transform: 'translateZ(0)', overscrollBehavior: 'contain' }}>
        {!isHost && (
          <button onClick={() => {
            toast.success('Request sent to host!');
            supabase.channel(`stream-events-${streamId}`).send({ type: 'broadcast', event: 'join_request', payload: { user_id: user?.id, display_name: user?.user_metadata?.display_name } });
          }} className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10">
              <span className="text-white text-xs">+</span>
            </div>
            <span className="text-[8px] text-white/60 font-bold">Request</span>
          </button>
        )}
        {viewers.filter(v => !v.is_co_broadcaster).slice(0, 4).map(viewer => (
          <button key={viewer.user_id} onClick={() => navigate(`/profile/${viewer.user_id}`)} className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
              {viewer.profile?.avatar_url ? (
                <img src={viewer.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/40 text-sm font-bold">{viewer.profile?.display_name?.[0] || '?'}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Chat */}
      <StreamChat messages={replies} hostId={host?.id} />

      {/* Gift overlays */}
      <GiftOverlay
        giftAnimations={giftAnimations} floatingReactions={floatingReactions}
        floatingGiftReactions={floatingGiftReactions} giftOverlay={giftOverlay}
      />

      {/* QuickGiftBar */}
      <QuickGiftBar isOpen={showQuickGift} onClose={() => setShowQuickGift(false)}
        recipientId={interactionTargetId === 'all' ? (stream?.user_id || '') : interactionTargetId}
        roomId={streamId} isSpace={false} hostId={stream?.user_id}
        onGiftSent={(gift) => handleFloatingReaction(gift.emoji, 'You')} />

      {/* Bottom controls */}
      <StreamControls
        replyText={replyText} onReplyTextChange={setReplyText} onSubmit={handleReplySubmit}
        onReact={() => setShowReactions(true)} onRefill={() => setShowRefill(true)}
        isPKMode={isPKMode} battleParticipants={battleParticipants}
        interactionTargetId={interactionTargetId} onSetTarget={setInteractionTargetId}
      />

      {/* ===== SHEETS & MODALS ===== */}
      <ReactionPicker isOpen={showReactions} onClose={() => setShowReactions(false)} onReact={handleReaction} />
      <ShareSheet isOpen={showShare} onClose={() => setShowShare(false)} stream={stream} streamId={streamId} />
      <SettingsSheet isOpen={showSettings} onClose={() => setShowSettings(false)} isHost={isHost}
        isMicOn={isMicOn} isCameraOn={isCameraOn} isPKMode={isPKMode} viewerCount={viewers.length}
        onMicToggle={handleMicToggle} onCameraToggle={handleCameraToggle} onCameraFlip={handleCameraFlip}
        onViewGuests={() => setView('guests')} onInvite={() => setShowInviteModal(true)}
        onAudioSettings={() => setShowAudioSettingsModal(true)} onRules={() => setShowRulesModal(true)}
        onFullGiftStore={() => setShowGiftModal(true)} onFeedback={() => setShowFeedbackModal(true)}
        onReport={() => setShowReportModal(true)} onEndStream={handleEndStream} onLeave={handleViewerLeave} />
      <InStreamGiftSheet isOpen={showStreamGiftModal} onClose={() => setShowStreamGiftModal(false)}
        targetName={targetName} userCredits={userCredits} onSendGift={handleSendStreamGift} />
      <InviteModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}
        isPKMode={isPKMode} host={host} viewers={viewers} battleParticipants={battleParticipants}
        pkMaxSlots={pkMaxSlots} inviteUsername={inviteUsername} setInviteUsername={setInviteUsername}
        inviteSearchResults={inviteSearchResults} inviteSearching={inviteSearching}
        onSearch={handleInviteSearch} onInviteCreator={handleInviteCreator}
        onInviteExternal={(profile) => {
          supabase.channel(`stream-events-${streamId}`).send({ type: 'broadcast', event: 'invite_user', payload: { user_id: profile.id, display_name: profile.display_name } });
          toast.success(`Invited @${profile.username}`);
          setInviteUsername(''); setInviteSearchResults([]);
        }} />
      <PollSystem isOpen={showPollCreator} onClose={() => setShowPollCreator(false)} streamId={streamId} />

      {showGiftModal && (
        <LiveGiftModal isOpen={showGiftModal} onClose={() => setShowGiftModal(false)} streamId={streamId}
          hostId={stream?.user_id || ''} viewers={viewers.map(v => ({ id: v.user_id, display_name: v.profile?.display_name || 'User', username: v.profile?.username || 'user', avatar_url: v.profile?.avatar_url || '' }))}
          isHost={isHost} isSpace={false} />
      )}
      <ReportContentModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} contentType="live_stream" contentId={streamId} reportedUserId={stream?.user_id} />
      <SpaceRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      <SpaceFeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} spaceId={streamId} spaceTitle={stream?.title || 'Stream'} />
      <SpaceAudioSettingsModal isOpen={showAudioSettingsModal} onClose={() => setShowAudioSettingsModal(false)} />
      <PKBattleChallenge isOpen={showPKBattle} onClose={() => setShowPKBattle(false)} mode="select" maxSlots={pkMaxSlots}
        onAccept={() => setShowPKBattle(false)} onDecline={() => setShowPKBattle(false)}
        availableUsers={viewers.map(v => ({ id: v.user_id, name: v.profile?.display_name || 'User', avatar: v.profile?.avatar_url, isLive: true }))}
        onSelectChallenger={async (userId) => { setShowPKBattle(false); const b = await createBattle(300); if (b) await sendChallenge(userId); }} />
      <InStreamRechargeSheet isOpen={showRefill} onClose={() => setShowRefill(false)} currentBalance={userCredits} onBalanceUpdate={setUserCredits} />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
        .pt-safe { padding-top: max(1rem, env(safe-area-inset-top)); }
        * { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"] { touch-action: manipulation; -webkit-touch-callout: none; }
        input, textarea { -webkit-appearance: none; appearance: none; font-size: 16px !important; }
        video { -webkit-playsinline: true; object-fit: cover; transform: translateZ(0); will-change: transform; }
      `}</style>
    </div>
  );
};

export default StreamRoomV2;
