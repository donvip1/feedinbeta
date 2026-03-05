import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOptionalSpaceContext } from '@/context/SpaceContext';
import { useNavigation } from '@/context/NavigationContext';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
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
  ChevronDown,
  Search,
  MoreHorizontal,
  Link as LinkIcon,
  Send,
  Flag,
  MessageCircle,
  CheckCircle2,
  FileText,
  Type,
  ArrowLeft,
  Camera,
  Gift,
  Volume2,
  VolumeX,
  Volume1,
  Hand,
  Circle,
  Speaker,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { shareUrls } from '@/lib/url-utils';

import { LiveGiftModal } from '../LiveGiftModal';
import { SpeakerQueuePanel } from '../SpeakerQueuePanel';
import { ReportContentModal } from '@/components/moderation/ReportContentModal';
import { SpaceRulesModal } from './SpaceRulesModal';
import { SpaceFeedbackModal } from './SpaceFeedbackModal';
import { SpaceAudioSettingsModal } from './SpaceAudioSettingsModal';
import { FloatingReactions } from '../FloatingReactions';
import { MentionText } from '../MentionText';
import { ThreadedRepliesList } from './ThreadedRepliesList';
import { SpeakerActionSheet } from './SpeakerActionSheet';
import { SpeakInviteDialog } from './SpeakInviteDialog';

interface TwitterSpaceRoomProps {
  spaceId: string;
  onClose: () => void;
}

interface GiftAnimation {
  id: string;
  emoji: string;
  senderName: string;
  receiverName: string;
  value: number;
}

interface Speaker {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  hand_raised_at?: string | null;
  host_muted?: boolean;
  mic_allowed?: boolean;
  joined_at?: string | null;
  left_at?: string | null;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
    is_verified?: boolean;
  };
}

interface SpaceData {
  id: string;
  title: string;
  description: string;
  user_id: string;
  status: string;
  viewer_count: number;
  topic_category: string;
  share_link: string;
  is_private: boolean;
  started_at?: string;
  allow_mic_for_all?: boolean;
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

export const TwitterSpaceRoom = ({ spaceId, onClose }: TwitterSpaceRoomProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const spaceContext = useOptionalSpaceContext();
  
  // View states
  const [view, setView] = useState<'main' | 'guests'>('main');
  const [showChat, setShowChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showSpeakerQueue, setShowSpeakerQueue] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState(false);
  
  // Gift animations state
  const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);
  const [floatingGiftReactions, setFloatingGiftReactions] = useState<FloatingGiftReaction[]>([]);
  
  // Data states
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [raisedHandsCount, setRaisedHandsCount] = useState(0);
  const [activeGuestTab, setActiveGuestTab] = useState('All');
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; user: string; handle: string } | null>(null);
  
  // User states
  const [isMuted, setIsMuted] = useState(true);
  const [isMicOn, setIsMicOn] = useState(false);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [myRole, setMyRole] = useState<string>('listener');
  const [myHostMuted, setMyHostMuted] = useState(false);
  const [allMuted, setAllMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [isLoudspeaker, setIsLoudspeaker] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(100);
  
  // Speaker management states
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showSpeakInvite, setShowSpeakInvite] = useState(false);
  const [inviterName, setInviterName] = useState('');

  const notifiedUsersRef = useRef<Set<string>>(new Set());
  
  const canSpeak = myRole === 'host' || myRole === 'co_host' || myRole === 'speaker';
  const isHost = space?.user_id === user?.id || myRole === 'host' || myRole === 'co_host';
  
  // Connection status from SpaceContext
  const connectionStatus = spaceContext?.spaceState.connectionStatus || 'disconnected';
  const audioLevels = spaceContext?.spaceState.audioLevels || {};

  // Hide bottom nav
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Initialize space
  useEffect(() => {
    const initSpace = async () => {
      await fetchSpaceData();
      await joinSpace();
    };
    initSpace();
    
    return () => {
      // Don't auto-leave - let user explicitly leave
    };
  }, [spaceId]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`twitter-space-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, () => {
        fetchSpeakers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload: any) => {
        // Notify host of new hand raises
        if (isHost && payload.new.has_raised_hand && !payload.old?.has_raised_hand) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
          
          toast(`${profile?.display_name || 'Someone'} raised their hand!`, {
            icon: '✋',
            duration: 5000,
            action: {
              label: 'View Queue',
              onClick: () => setShowSpeakerQueue(true)
            }
          });
        }
        fetchSpeakers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_spaces',
        filter: `id=eq.${spaceId}`,
      }, async (payload: any) => {
        if (payload.new.status === 'ended') {
          console.log('[SpaceRoom] Space ended via realtime, navigating out');
          try {
            await spaceContext?.leaveSpace();
          } catch (e) {
            console.warn('[SpaceRoom] Error leaving space:', e);
          }
          toast.info('This space has ended');
          navigate('/live', { replace: true });
          return;
        }
        if (payload.new.status === 'live') {
          setSpace(payload.new);
        }
      })
      .on('broadcast', { event: 'space_ended' }, async () => {
        console.log('[SpaceRoom] Space ended via broadcast, navigating out');
        try {
          await spaceContext?.leaveSpace();
        } catch (e) {
          console.warn('[SpaceRoom] Error leaving space:', e);
        }
        toast.info('This space has ended');
        navigate('/live', { replace: true });
      })
      .subscribe();

    // Reactions broadcast channel
    const reactionsChannel = supabase
      .channel(`space-reactions-${spaceId}`)
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        if (payload.payload?.user_id !== user?.id) {
          handleFloatingReaction(payload.payload?.emoji, payload.payload?.display_name);
        }
      })
      .subscribe();

    // Control channel (mute all, etc.)
    const controlChannel = supabase
      .channel(`space-control-${spaceId}`)
      .on('broadcast', { event: 'mute_all' }, (payload: any) => {
        if (payload.payload?.by !== user?.id) {
          setIsMuted(true);
          setIsMicOn(false);
          setMyHostMuted(true);
          spaceContext?.setMuted(true);
          toast.info('You have been muted by the host');
        }
      })
      .on('broadcast', { event: 'allow_unmute' }, (payload: any) => {
        if (payload.payload?.by !== user?.id) {
          setMyHostMuted(false);
          toast.info('You can now unmute');
        }
      })
      .on('broadcast', { event: 'invite-to-speak' }, (payload: any) => {
        if (payload.payload?.target_user_id === user?.id) {
          setInviterName(payload.payload?.inviter_name || 'Host');
          setShowSpeakInvite(true);
        }
      })
      .on('broadcast', { event: 'demoted-to-listener' }, (payload: any) => {
        if (payload.payload?.target_user_id === user?.id) {
          setMyRole('listener');
          setIsMicOn(false);
          setIsMuted(true);
          spaceContext?.setMuted(true);
          spaceContext?.updateRole?.('listener');
          toast.info('You have been moved to listener');
        }
        fetchSpeakers();
      })
      .subscribe();

    // Gift channel - listen for gifts in this space
    const giftChannel = supabase
      .channel(`space-gifts-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_gifts',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload: any) => {
        const giftData = payload.new;
        
        // Fetch sender and receiver profiles
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
        const senderName = senderProfile?.display_name || 'Someone';
        const receiverName = receiverProfile?.display_name || 'Host';
        const creditValue = giftData.credit_value || 1;
        const recipientAmount = Math.floor(creditValue * 0.85);

        // Toast notification for the receiver (host/speaker)
        if (giftData.receiver_id === user?.id) {
          toast(`${emoji} ${senderName} sent you a ${giftData.gift_type}! (+${recipientAmount} credits)`, {
            icon: '🎁',
            duration: 6000,
          });
        }

        // Add to FloatingReactions for TikTok-style floating animation
        const floatingGift: FloatingGiftReaction = {
          id: giftData.id,
          type: giftData.gift_type,
          senderName,
          emoji,
        };
        setFloatingGiftReactions(prev => [...prev, floatingGift]);

        // Also keep the banner notification
        const newGiftAnim: GiftAnimation = {
          id: giftData.id,
          emoji,
          senderName,
          receiverName,
          value: creditValue,
        };
        setGiftAnimations(prev => [...prev, newGiftAnim]);

        // Add gift message to chat
        const giftChatMessage: Reply = {
          id: `gift-${giftData.id}`,
          user_id: giftData.sender_id,
          user: senderName,
          handle: '@' + (senderProfile?.username || 'user'),
          time: 'Just now',
          text: `🎁 Sent ${emoji} ${giftData.gift_type} (${creditValue} credits)`,
          avatar: senderProfile?.avatar_url || '',
          likes: 0,
          liked_by_me: false,
          isGift: true,
        };
        setReplies(prev => [...prev, giftChatMessage]);

        // Remove banner animation after 5 seconds
        setTimeout(() => {
          setGiftAnimations(prev => prev.filter(g => g.id !== newGiftAnim.id));
        }, 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(controlChannel);
      supabase.removeChannel(giftChannel);
    };
  }, [spaceId, isHost, user?.id]);

  // Update SpaceContext when connected
  useEffect(() => {
    if (space && spaceContext) {
      const hostProfile = speakers.find(s => s.user_id === space.user_id)?.profile;
      spaceContext.joinSpace({
        id: space.id,
        title: space.title,
        hostId: space.user_id,
        hostName: hostProfile?.display_name || 'Host',
        hostAvatar: hostProfile?.avatar_url || '',
        startedAt: space.started_at || new Date().toISOString(),
      }, myRole);
    }
  }, [space?.id, myRole, speakers.length]);

  // Fetch raised hands count
  useEffect(() => {
    const count = speakers.filter(s => s.has_raised_hand && !s.left_at).length;
    setRaisedHandsCount(count);
  }, [speakers]);

  // Fetch replies
  useEffect(() => {
    const fetchReplies = async () => {
      const { data } = await supabase
        .from('live_space_messages')
        .select('*, likes_count')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const messageIds = data.map(m => m.id);
        
        const [{ data: profiles }, { data: myLikes }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', userIds),
          user ? supabase
            .from('live_space_message_likes')
            .select('message_id')
            .eq('user_id', user.id)
            .in('message_id', messageIds) : { data: [] },
        ]);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const likedSet = new Set(myLikes?.map(l => l.message_id) || []);

        setReplies(
          data.reverse().map((msg) => ({
            id: msg.id,
            user_id: msg.user_id,
            user: profileMap.get(msg.user_id)?.display_name || 'User',
            handle: '@' + (profileMap.get(msg.user_id)?.username || 'user'),
            time: getRelativeTime(msg.created_at),
            text: msg.content,
            avatar: profileMap.get(msg.user_id)?.avatar_url || '',
            likes: (msg as any).likes_count || 0,
            liked_by_me: likedSet.has(msg.id),
            reply_to_id: (msg as any).reply_to_id || null,
          }))
        );
      }
    };

    fetchReplies();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`space-messages-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_messages',
        filter: `space_id=eq.${spaceId}`,
      }, () => {
        fetchReplies();
        if (!showChat) {
          setUnreadMessages(prev => prev + 1);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, showChat]);
  
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

  const fetchSpaceData = async () => {
    const { data, error } = await supabase
      .from('live_spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (error) {
      toast.error('Failed to load space');
      return;
    }
    
    setSpace(data);
    // Initialize recording state from database
    if (data.is_recording_enabled) {
      setIsRecording(true);
    }
    await fetchSpeakers();
  };

  const fetchSpeakers = async () => {
    const { data } = await supabase
      .from('live_space_speakers')
      .select('*')
      .eq('space_id', spaceId)
      .is('left_at', null)
      .order('joined_at', { ascending: true });

    if (data && data.length > 0) {
      const userIds = data.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setSpeakers(data.map(s => ({
        ...s,
        profile: profileMap.get(s.user_id),
      })));

      // Check my status
      if (user) {
        const mySpeaker = data.find(s => s.user_id === user.id);
        if (mySpeaker) {
          setMyRole(mySpeaker.role);
          setIsMuted(mySpeaker.is_muted);
          setHasRaisedHand(mySpeaker.has_raised_hand);
          setMyHostMuted(mySpeaker.host_muted || false);
        }
      }
    }
  };

  const joinSpace = async () => {
    if (!user) return;
    
    // Check if already actively in space
    const { data: existing } = await supabase
      .from('live_space_speakers')
      .select('*')
      .eq('space_id', spaceId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    let role: string;

    if (existing) {
      role = existing.role;
      setMyRole(existing.role);
      setIsMuted(existing.is_muted);
      if (existing.role === 'host') {
        setIsMicOn(true);
      }
    } else {
      // Check if this user is the host
      const isSpaceHost = space?.user_id === user.id;
      role = isSpaceHost ? 'host' : 'listener';

      // Check for a previous record (user left and is rejoining)
      const { data: previousRecord } = await supabase
        .from('live_space_speakers')
        .select('id')
        .eq('space_id', spaceId)
        .eq('user_id', user.id)
        .not('left_at', 'is', null)
        .order('left_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousRecord) {
        // Re-activate the old record
        const { error } = await supabase
          .from('live_space_speakers')
          .update({
            left_at: null,
            role,
            is_muted: !isSpaceHost,
            has_raised_hand: false,
            host_muted: false,
          })
          .eq('id', previousRecord.id);

        if (error) {
          toast.error('Failed to rejoin space');
          return;
        }
      } else {
        // First time joining - insert new record
        const { error } = await supabase.from('live_space_speakers').insert({
          space_id: spaceId,
          user_id: user.id,
          role,
          is_muted: !isSpaceHost,
        });

        if (error) {
          toast.error('Failed to join space');
          return;
        }
      }

      setMyRole(role);
      setIsMuted(!isSpaceHost);
      if (isSpaceHost) {
        setIsMicOn(true);
      }
    }

    // ALWAYS connect audio regardless of existing record
    if (spaceContext) {
      audioPlaybackManager.enableAudioPlayback();
      await spaceContext.connectAudio(role);
    }
  };

  const handleFloatingReaction = (emoji: string, displayName?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingReactions(prev => [...prev, { id, emoji, left: 35 + Math.random() * 30, displayName }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;
    
    // Get current user's display name
    const myDisplayName = speakers.find(s => s.user_id === user.id)?.profile?.display_name || 'Someone';
    
    // Show locally
    handleFloatingReaction(emoji, myDisplayName);
    
    // Broadcast to others
    const channel = supabase.channel(`space-reactions-${spaceId}`);
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, user_id: user.id, display_name: myDisplayName },
    });
    supabase.removeChannel(channel);
    
    // Save to database
    await supabase.from('live_space_reactions').insert({
      space_id: spaceId,
      user_id: user.id,
      reaction_type: emoji,
    });
    
    setShowReactions(false);
  };

  const handleToggleMute = async () => {
    if (!user) return;
    
    // If listener, this is a request to speak
    if (myRole === 'listener') {
      await handleRaiseHand();
      return;
    }
    
    if (myHostMuted && !isMicOn) {
      toast.error('Host has muted you. Wait for host to allow you to unmute.');
      return;
    }

    const newMicState = !isMicOn;
    setIsMicOn(newMicState);
    setIsMuted(!newMicState);
    
    if (spaceContext) {
      spaceContext.setMuted(!newMicState);
    }
    
    // If unmuting, need to start broadcasting
    if (newMicState && spaceContext) {
      const success = await spaceContext.startListenerBroadcast();
      if (success) {
        toast.success('You are now speaking');
      }
    }

    await supabase
      .from('live_space_speakers')
      .update({ is_muted: !newMicState })
      .eq('space_id', spaceId)
      .eq('user_id', user.id);
  };

  const handleRaiseHand = async () => {
    if (!user || myRole !== 'listener') return;

    const newHandState = !hasRaisedHand;
    setHasRaisedHand(newHandState);

    await supabase
      .from('live_space_speakers')
      .update({ 
        has_raised_hand: newHandState,
        hand_raised_at: newHandState ? new Date().toISOString() : null
      })
      .eq('space_id', spaceId)
      .eq('user_id', user.id);

    toast.success(newHandState ? '✋ Request sent to host!' : 'Request cancelled');
  };

  const handleMuteAll = async () => {
    if (!isHost) return;
    
    const newMuteState = !allMuted;
    setAllMuted(newMuteState);
    
    // Broadcast mute all event
    const channel = supabase.channel(`space-control-${spaceId}`);
    await channel.send({
      type: 'broadcast',
      event: newMuteState ? 'mute_all' : 'allow_unmute',
      payload: { by: user?.id },
    });
    supabase.removeChannel(channel);
    
    // Update all speakers in database
    await supabase
      .from('live_space_speakers')
      .update({ host_muted: newMuteState })
      .eq('space_id', spaceId)
      .neq('user_id', user?.id);
    
    toast.success(newMuteState ? '🔇 All participants muted' : '🔊 Participants can now unmute');
  };

  const handleMinimize = () => {
    if (spaceContext) {
      spaceContext.minimizeSpace();
      navigate('/feed');
    }
  };

  const handleLeave = async () => {
    // Stop recording if active before ending
    if (isRecording && isHost) {
      await handleRecordingToggle();
    }
    
    if (isHost) {
      // End the space - update DB and broadcast to all participants
      await supabase
        .from('live_spaces')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', spaceId);

      // Broadcast immediate end signal to all participants
      await supabase
        .channel(`space-${spaceId}`)
        .send({ type: 'broadcast', event: 'space_ended', payload: {} });

      // Mark all participants as left
      await supabase
        .from('live_space_speakers')
        .update({ left_at: new Date().toISOString() })
        .eq('space_id', spaceId)
        .is('left_at', null);
    }
    
    if (spaceContext) {
      await spaceContext.leaveSpace();
    }
    onClose();
  };

  const handleRecordingToggle = async () => {
    if (!isHost || recordingLoading) return;
    
    setRecordingLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please sign in to record');
        return;
      }

      const action = isRecording ? 'stop' : 'start';
      
      const response = await supabase.functions.invoke('livekit-recording', {
        body: {
          action,
          roomId: spaceId,
          roomType: 'live_spaces',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Recording failed');
      }

      const newRecordingState = action === 'start';
      setIsRecording(newRecordingState);
      
      // Update database
      await supabase
        .from('live_spaces')
        .update({ is_recording_enabled: newRecordingState })
        .eq('id', spaceId);

      toast.success(action === 'start' ? '🔴 Recording started' : '⏹️ Recording stopped');
    } catch (error: any) {
      console.error('[Recording] Error:', error);
      toast.error(error.message || 'Failed to toggle recording');
    } finally {
      setRecordingLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!user || !replyText.trim()) return;

    const content = replyingTo 
      ? `@${replyingTo.handle.replace('@', '')} ${replyText}` 
      : replyText;

    await supabase.from('live_space_messages').insert({
      space_id: spaceId,
      user_id: user.id,
      content,
      reply_to_id: replyingTo?.id || null,
    } as any);

    setReplyText('');
    setReplyingTo(null);
  };
  
  // Handle like toggle - persistent
  const handleLikeMessage = async (messageId: string) => {
    if (!user) return;
    
    const reply = replies.find(r => r.id === messageId);
    if (!reply || reply.isGift) return;
    
    const isLiked = reply.liked_by_me;
    
    // Optimistic update
    setReplies(prev => prev.map(r => {
      if (r.id === messageId) {
        return {
          ...r,
          liked_by_me: !isLiked,
          likes: isLiked ? r.likes - 1 : r.likes + 1,
        };
      }
      return r;
    }));

    try {
      if (isLiked) {
        await supabase
          .from('live_space_message_likes')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('live_space_message_likes')
          .insert({ message_id: messageId, user_id: user.id });
      }
    } catch (error) {
      // Revert on error
      setReplies(prev => prev.map(r => {
        if (r.id === messageId) {
          return {
            ...r,
            liked_by_me: isLiked,
            likes: isLiked ? r.likes + 1 : r.likes - 1,
          };
        }
        return r;
      }));
    }
  };
  
  // Handle reply to specific message
  const handleReplyToMessage = (reply: Reply) => {
    setReplyingTo({ id: reply.id, user: reply.user, handle: reply.handle });
  };
  
  // Handle host name tap to open action sheet
  const handleNameTap = (speaker: Speaker) => {
    if (!isHost || speaker.user_id === user?.id || speaker.role === 'host') return;
    setSelectedSpeaker(speaker);
    setShowActionSheet(true);
  };

  // Invite listener to speak
  const handleInviteToSpeak = async (targetUserId: string) => {
    if (!user || !space) return;
    
    // Insert invitation record
    await supabase.from('live_space_invitations').insert({
      space_id: spaceId,
      inviter_id: user.id,
      invitee_id: targetUserId,
      status: 'pending',
    });

    // Broadcast invite
    const channel = supabase.channel(`space-control-${spaceId}`);
    const myProfile = speakers.find(s => s.user_id === user.id)?.profile;
    await channel.send({
      type: 'broadcast',
      event: 'invite-to-speak',
      payload: { target_user_id: targetUserId, inviter_name: myProfile?.display_name || 'Host' },
    });
    supabase.removeChannel(channel);

    toast.success('Invitation sent!');
  };

  // Demote speaker to listener
  const handleDemoteToListener = async (targetUserId: string) => {
    if (!user) return;

    await supabase
      .from('live_space_speakers')
      .update({ role: 'listener', is_muted: true, mic_allowed: false })
      .eq('space_id', spaceId)
      .eq('user_id', targetUserId);

    // Broadcast demote
    const channel = supabase.channel(`space-control-${spaceId}`);
    await channel.send({
      type: 'broadcast',
      event: 'demoted-to-listener',
      payload: { target_user_id: targetUserId, by: user.id },
    });
    supabase.removeChannel(channel);

    fetchSpeakers();
    toast.success('User moved to listener');
  };

  // Accept speak invitation
  const handleAcceptInvite = async () => {
    if (!user) return;
    setShowSpeakInvite(false);

    // Update role in DB
    await supabase
      .from('live_space_speakers')
      .update({ role: 'speaker', is_muted: false, has_raised_hand: false, host_muted: false, mic_allowed: true })
      .eq('space_id', spaceId)
      .eq('user_id', user.id);

    setMyRole('speaker');
    setIsMicOn(true);
    setIsMuted(false);
    setHasRaisedHand(false);
    setMyHostMuted(false);

    if (spaceContext) {
      spaceContext.setMuted(false);
      spaceContext.updateRole?.('speaker');
      await spaceContext.startListenerBroadcast();
    }

    toast.success('🎙️ You are now a speaker!');
    fetchSpeakers();
  };

  // Navigate to user profile
  const navigateToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (!space) {
    return (
      <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Guests overlay
  if (view === 'guests') {
    const filteredSpeakers = speakers.filter(s => {
      if (activeGuestTab === 'All') return true;
      if (activeGuestTab === 'Co-hosts') return s.role === 'co_host';
      if (activeGuestTab === 'Speakers') return s.role === 'speaker';
      if (activeGuestTab === 'Listening') return s.role === 'listener';
      return true;
    });

    return (
      <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col">
        {/* Guest Header */}
        <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
          <button onClick={() => setView('main')} className="p-2">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-white font-bold text-lg">Guests</h2>
          <div className="w-9" />
        </div>

        {/* Search */}
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

        {/* Tabs */}
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

        {/* Guest List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Host Section */}
          <div className="px-4 py-3">
            <h3 className="text-zinc-400 text-sm font-semibold mb-3">Host</h3>
            <button 
              onClick={() => navigateToProfile(space.user_id)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
            >
              <img
                src={speakers.find(s => s.user_id === space.user_id)?.profile?.avatar_url || ''}
                alt="host"
                className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
              />
              <div className="flex-1">
                <p className="text-white font-medium">
                  {speakers.find(s => s.user_id === space.user_id)?.profile?.display_name}
                </p>
                <p className="text-zinc-500 text-sm">
                  @{speakers.find(s => s.user_id === space.user_id)?.profile?.username}
                </p>
              </div>
            </button>
          </div>

          {/* Speakers Section */}
          {filteredSpeakers.filter(s => s.role === 'speaker').length > 0 && (
            <div className="px-4 py-3">
              <h3 className="text-zinc-400 text-sm font-semibold mb-3">
                Speakers ({filteredSpeakers.filter(s => s.role === 'speaker').length})
              </h3>
              <div className="space-y-2">
                {filteredSpeakers
                  .filter(s => s.role === 'speaker')
                  .map(speaker => (
                    <div
                      key={speaker.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
                    >
                      <img
                        src={speaker.profile?.avatar_url || ''}
                        alt={speaker.profile?.display_name}
                        className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                        onClick={() => navigateToProfile(speaker.user_id)}
                      />
                      <div 
                        className="flex-1"
                        onClick={() => isHost ? handleNameTap(speaker) : navigateToProfile(speaker.user_id)}
                      >
                        <p className="text-white font-medium">{speaker.profile?.display_name}</p>
                        <p className="text-zinc-500 text-sm">@{speaker.profile?.username}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Listeners Section */}
          {filteredSpeakers.filter(s => s.role === 'listener').length > 0 && (
            <div className="px-4 py-3">
              <h3 className="text-zinc-400 text-sm font-semibold mb-3">
                Listeners ({filteredSpeakers.filter(s => s.role === 'listener').length})
              </h3>
              <div className="space-y-2">
                {filteredSpeakers
                  .filter(s => s.role === 'listener')
                  .map(speaker => (
                    <div
                      key={speaker.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
                    >
                      <img
                        src={speaker.profile?.avatar_url || ''}
                        alt={speaker.profile?.display_name}
                        className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                        onClick={() => navigateToProfile(speaker.user_id)}
                      />
                      <div 
                        className="flex-1"
                        onClick={() => isHost ? handleNameTap(speaker) : navigateToProfile(speaker.user_id)}
                      >
                        <p className="text-white font-medium">{speaker.profile?.display_name}</p>
                        <p className="text-zinc-500 text-sm">@{speaker.profile?.username}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sort speakers: Host first, then co-hosts, speakers, and listeners last
  const sortedSpeakers = [...speakers].sort((a, b) => {
    const roleOrder: Record<string, number> = { host: 0, co_host: 1, speaker: 2, listener: 3 };
    const aOrder = a.user_id === space?.user_id ? 0 : (roleOrder[a.role] ?? 3);
    const bOrder = b.user_id === space?.user_id ? 0 : (roleOrder[b.role] ?? 3);
    return aOrder - bOrder;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-500">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={handleMinimize} className="p-2 hover:bg-white/5 rounded-full transition-all">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <div className="w-3 h-3 text-purple-400 animate-pulse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/></svg>
            </div>
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">HD Audio</span>
          </div>
          {/* Settings button - moved to header */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all"
          >
            <MoreHorizontal className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isHost && raisedHandsCount > 0 && (
            <button 
              onClick={() => setShowSpeakerQueue(true)}
              className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/5"
            >
              <Hand className="w-5 h-5 text-amber-400" />
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {raisedHandsCount}
              </span>
            </button>
          )}
          {isHost && (
            <button
              onClick={handleRecordingToggle}
              disabled={recordingLoading}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full bg-white/5 transition-all",
                isRecording ? "text-red-500" : "text-zinc-400 hover:text-white"
              )}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              <Circle className={cn("w-4 h-4", isRecording && "fill-red-500 animate-pulse")} />
            </button>
          )}
          <button
            onClick={() => setShowShare(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={handleLeave}
            className="bg-red-500/10 text-red-500 px-6 py-2 rounded-full text-xs font-black uppercase border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Connection Status */}
        {connectionStatus !== 'connected' && connectionStatus !== 'disconnected' && (
          <p className="text-center text-slate-500 text-xs mb-2 capitalize">{connectionStatus}...</p>
        )}

        {/* Room Info - Centered Host */}
        <div className="p-8 text-center max-w-lg mx-auto">
          <div className="mb-6 relative inline-block">
            <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full" />
            <img
              src={speakers.find(s => s.user_id === space?.user_id)?.profile?.avatar_url || ''}
              alt="Host"
              className="w-24 h-24 rounded-[2.5rem] border-4 border-white/10 relative z-10 shadow-2xl object-cover cursor-pointer"
              onClick={() => space?.user_id && navigateToProfile(space.user_id)}
            />
            <div className="absolute -bottom-2 -right-2 bg-purple-600 p-2 rounded-2xl z-20 border-4 border-[#050505]">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
          </div>
          <h1 className="text-2xl font-black mb-2 leading-tight text-white">{space?.title}</h1>
          <p className="text-sm text-slate-400 mb-3">
            Hosted by {speakers.find(s => s.user_id === space?.user_id)?.profile?.display_name || 'Host'}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setView('guests')}
              className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full hover:bg-white/10 transition-all"
            >
              <Users className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-bold text-slate-400">{speakers.length}</span>
            </button>
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full">
              <Volume2 className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-bold text-slate-400">{sortedSpeakers.filter(s => s.role !== 'listener').length} Speakers</span>
            </div>
          </div>
        </div>

        {/* Speaker Grid - Twitter/Clubhouse style */}
        <div className="px-6 pb-20 max-w-3xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-10 gap-x-4 mb-12">
            {sortedSpeakers
              .filter(s => s.role !== 'listener')
              .slice(0, 12)
              .map((speaker) => {
                const speaking = (audioLevels[speaker.user_id] || 0) > 10 && !speaker.is_muted;
                const isHostUser = speaker.user_id === space?.user_id;
                
                return (
                  <div
                    key={speaker.id}
                    className="flex flex-col items-center gap-4 group"
                  >
                    <div className="relative cursor-pointer" onClick={() => navigateToProfile(speaker.user_id)}>
                      {/* Ping-style audio wave indicators */}
                      {speaking && (
                        <>
                          <div className="absolute -inset-4 rounded-[2.5rem] border-2 border-purple-500/30 animate-[ping_2s_infinite] opacity-50" />
                          <div className="absolute -inset-2 rounded-[2.5rem] border-2 border-purple-500/50 animate-[ping_1.5s_infinite]" />
                        </>
                      )}
                      <div className={cn(
                        "w-20 h-20 sm:w-24 sm:h-24 rounded-[2.2rem] p-1 bg-gradient-to-tr transition-all duration-500",
                        speaking ? 'from-purple-500 to-pink-500 scale-105' : 'from-white/10 to-white/5'
                      )}>
                        {speaker.profile?.avatar_url ? (
                          <img
                            src={speaker.profile.avatar_url}
                            alt={speaker.profile.display_name}
                            className="w-full h-full rounded-[1.9rem] object-cover bg-slate-900 border-2 border-[#050505]"
                          />
                        ) : (
                          <div className="w-full h-full rounded-[1.9rem] bg-slate-900 border-2 border-[#050505] flex items-center justify-center text-slate-400 text-xl font-bold">
                            {speaker.profile?.display_name?.[0] || 'U'}
                          </div>
                        )}
                      </div>
                      {/* Microbadge indicators */}
                      <div className="absolute -bottom-1 -right-1 flex gap-1">
                        {isHostUser && (
                          <div className="bg-amber-400 p-1.5 rounded-xl shadow-xl border-2 border-[#050505]">
                            <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          </div>
                        )}
                        {speaker.is_muted && (
                          <div className="bg-zinc-700 p-1.5 rounded-xl shadow-xl border-2 border-[#050505]">
                            <MicOff className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {speaking && (
                          <div className="bg-purple-600 p-1.5 rounded-xl shadow-xl border-2 border-[#050505] animate-bounce">
                            <Volume2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div 
                      className="text-center cursor-pointer"
                      onClick={() => isHost ? handleNameTap(speaker) : navigateToProfile(speaker.user_id)}
                    >
                      <p className="text-xs font-black truncate max-w-[90px] group-hover:text-purple-400 transition-colors text-white">
                        {speaker.profile?.display_name?.split(' ')[0] || 'User'}
                      </p>
                      <p className={cn(
                        "text-[8px] font-black uppercase tracking-widest",
                        isHostUser ? 'text-amber-400' : speaker.role === 'co_host' ? 'text-purple-400' : 'text-slate-500'
                      )}>
                        {isHostUser ? 'Host' : speaker.role === 'co_host' ? 'Co-host' : 'Speaker'}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Listeners Section */}
          {sortedSpeakers.filter(s => s.role === 'listener').length > 0 && (
            <div className="border-t border-white/5 pt-8">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Listeners ({sortedSpeakers.filter(s => s.role === 'listener').length})
                </h4>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-6 opacity-80">
                {sortedSpeakers
                  .filter(s => s.role === 'listener')
                  .slice(0, 18)
                  .map((speaker) => (
                    <div
                      key={speaker.id}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/5 cursor-pointer" onClick={() => navigateToProfile(speaker.user_id)}>
                        {speaker.profile?.avatar_url ? (
                          <img src={speaker.profile.avatar_url} alt={speaker.profile.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                            {speaker.profile?.display_name?.[0] || 'U'}
                          </div>
                        )}
                      </div>
                      <span 
                        className="text-[10px] font-bold text-slate-500 truncate w-full text-center cursor-pointer hover:text-purple-400 transition-colors"
                        onClick={() => isHost ? handleNameTap(speaker) : navigateToProfile(speaker.user_id)}
                      >
                        {speaker.profile?.display_name?.split(' ')[0] || 'User'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Reactions - Center screen */}
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

      {/* Floating Gift Reactions - TikTok/Tango style */}
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
                <p className="text-white text-sm font-semibold truncate">
                  {gift.senderName}
                </p>
                <p className="text-white/80 text-xs truncate">
                  sent {gift.emoji} to {gift.receiverName}
                </p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
                <span className="text-white text-xs font-bold">+{gift.value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* BOTTOM CONTROLS - Premium rounded bar */}
      <div className="p-4 bg-[#0F1119] border-t border-white/5 rounded-t-[3rem]">
        <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
          {/* Mic / Request */}
          <button
            onClick={handleToggleMute}
            className={cn(
              "relative w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90",
              canSpeak
                ? isMicOn
                  ? 'bg-purple-600 text-white'
                  : 'bg-red-500/20 text-red-400'
                : hasRaisedHand
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
            )}
          >
            {canSpeak ? (
              isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />
            ) : (
              <Hand className="w-5 h-5" />
            )}
            {hasRaisedHand && !canSpeak && (
              <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">!</span>
            )}
          </button>

          {/* React */}
          <button
            onClick={() => setShowReactions(true)}
            className="w-12 h-12 flex items-center justify-center rounded-full text-white hover:text-white/80 active:scale-90 transition-all"
          >
            <Heart className="w-5 h-5" />
          </button>

          {/* Gift */}
          <button
            onClick={() => setShowGiftModal(true)}
            className="w-12 h-12 flex items-center justify-center rounded-full text-white hover:text-white/80 active:scale-90 transition-all"
          >
            <Gift className="w-5 h-5" />
          </button>

          {/* Chat */}
          <button
            onClick={() => setShowChat(true)}
            className="relative w-12 h-12 flex items-center justify-center rounded-full text-white hover:text-white/80 active:scale-90 transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-purple-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {unreadMessages}
              </span>
            )}
          </button>

          {/* Volume */}
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="w-12 h-12 flex items-center justify-center rounded-full text-white hover:text-white/80 active:scale-90 transition-all"
            >
              {volumeLevel > 50 ? <Volume2 className="w-6 h-6 text-white" /> : volumeLevel > 0 ? <Volume1 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />}
            </button>
            <AnimatePresence>
              {showVolumeSlider && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-16 right-0 bg-[#11131E] border border-white/10 rounded-2xl p-4 w-56 shadow-xl z-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white text-sm font-semibold">Volume</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{volumeLevel}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volumeLevel}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setVolumeLevel(val);
                      audioPlaybackManager.setVolume(val / 100);
                      setIsLoudspeaker(val > 50);
                    }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500 bg-white/10"
                    style={{
                      background: `linear-gradient(to right, #a855f7 ${volumeLevel}%, rgba(255,255,255,0.1) ${volumeLevel}%)`,
                    }}
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>Earpiece</span>
                    <span>Loudspeaker</span>
                  </div>
                  <button
                    onClick={() => setShowVolumeSlider(false)}
                    className="mt-3 w-full text-center text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mute All - Host Only */}
          {isHost && (
            <button
              onClick={handleMuteAll}
              className={cn(
                "w-14 h-14 rounded-[1.5rem] flex items-center justify-center active:scale-90 transition-all shadow-xl",
                allMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'
              )}
              title={allMuted ? 'Allow unmute' : 'Mute all'}
            >
              {allMuted ? <VolumeX className="w-6 h-6" /> : <Speaker className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Overlays */}

      {/* REACTION PICKER */}
      {showReactions && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowReactions(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
            <div className="grid grid-cols-5 gap-4">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReaction(emoji);
                  }}
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
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

            {/* Cover Image Preview */}
            <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-800/50">
              {space?.cover_image_url ? (
                <img src={space.cover_image_url} alt={space?.title} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-20 bg-gradient-to-r from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-purple-400" />
                </div>
              )}
              <div className="px-3 py-2">
                <p className="text-white text-sm font-semibold truncate">{space?.title || 'Live Space'}</p>
                <p className="text-zinc-500 text-xs truncate">feedinbeta.lovable.app</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const url = shareUrls.liveSpace(space?.share_link || spaceId);
                  toast.success('Space link copied!');
                  navigator.clipboard.writeText(url);
                  setShowShare(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Copy Link</span>
                <LinkIcon className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  const url = shareUrls.liveSpace(space?.share_link || spaceId);
                  if (navigator.share) {
                    navigator.share({
                      title: space?.title,
                      text: `Join me in this live space: ${space?.title}`,
                      url,
                    });
                  }
                  setShowShare(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
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
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
            <div className="space-y-1">
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowAudioSettingsModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Adjust settings</span>
                <Settings className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowFeedbackModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Share feedback</span>
                <MessageSquare className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowRulesModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">View rules</span>
                <FileText className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowReportModal(true);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-red-500 font-medium">Report this Space</span>
                <Flag className="w-5 h-5 text-red-500" />
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
            className="w-full max-w-md bg-zinc-900 flex flex-col h-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-white font-bold">Space</h2>
              <button onClick={() => setShowChat(false)} className="p-2">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Space Info with Cover Image */}
            {space?.cover_image_url ? (
              <div className="relative w-full h-36 overflow-hidden border-b border-zinc-800">
                <img src={space.cover_image_url} alt={space?.title || 'Space'} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="text-sm font-bold text-white/80">
                    {speakers.find(s => s.user_id === space?.user_id)?.profile?.display_name}
                  </p>
                  <p className="text-base font-black text-white drop-shadow-lg truncate mt-0.5">{space?.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1.5 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Live</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold">👥 {speakers.length} listening</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 border-b border-zinc-800">
                <div className="space-y-2">
                  <p className="text-sm text-white font-medium">
                    {speakers.find(s => s.user_id === space?.user_id)?.profile?.display_name} • LIVE
                  </p>
                  <p className="text-lg text-white font-bold">{space?.title}</p>
                  <div className="flex gap-2 text-xs text-zinc-400">
                    <span>🔴 Live</span>
                    <span>👥 {speakers.length} listening</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                  <p>Just now • {speakers.length} Views</p>
                </div>
              </div>
            )}

            {/* Replies Feed */}
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

            {/* Reply Input */}
            <div className="px-4 py-4 border-t border-zinc-800 pb-safe">
              {replyingTo && (
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs text-zinc-400">
                    Replying to <span className="text-purple-400">{replyingTo.handle}</span>
                  </span>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="text-zinc-500 hover:text-white"
                  >
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
                  className="flex-1 bg-zinc-800 text-white placeholder-zinc-500 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleReplySubmit}
                  disabled={!replyText.trim()}
                  className="p-2 text-purple-600 hover:text-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          streamId={spaceId}
          hostId={space?.user_id || ''}
          viewers={speakers.map(s => ({
            id: s.user_id,
            display_name: s.profile?.display_name || 'User',
            username: s.profile?.username || 'user',
            avatar_url: s.profile?.avatar_url || '',
          }))}
          isHost={isHost}
          isSpace={true}
          spaceName={space?.title || ''}
        />
      )}

      {showSpeakerQueue && (
        <SpeakerQueuePanel
          spaceId={spaceId}
          onClose={() => setShowSpeakerQueue(false)}
          isHost={isHost}
          onSpeakerUpdate={fetchSpeakers}
        />
      )}

      {/* Report Modal */}
      <ReportContentModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        contentType="live_stream"
        contentId={spaceId}
        reportedUserId={space?.user_id}
      />

      {/* Rules Modal */}
      <SpaceRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Feedback Modal */}
      <SpaceFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        spaceId={spaceId}
        spaceTitle={space?.title || 'Space'}
      />

      {/* Audio Settings Modal */}
      <SpaceAudioSettingsModal
        isOpen={showAudioSettingsModal}
        onClose={() => setShowAudioSettingsModal(false)}
      />

      {/* Speaker Action Sheet */}
      {showActionSheet && selectedSpeaker && (
        <SpeakerActionSheet
          speaker={selectedSpeaker}
          onClose={() => { setShowActionSheet(false); setSelectedSpeaker(null); }}
          onInviteToSpeak={handleInviteToSpeak}
          onDemoteToListener={handleDemoteToListener}
        />
      )}

      {/* Speak Invite Dialog */}
      <SpeakInviteDialog
        isOpen={showSpeakInvite}
        inviterName={inviterName}
        spaceName={space?.title || 'Space'}
        onAccept={handleAcceptInvite}
        onDecline={() => setShowSpeakInvite(false)}
      />

      <style>{`
        @keyframes space-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; transform: translateY(-20px) scale(1.5); }
          100% { transform: translateY(-500px) scale(0.8); opacity: 0; }
        }
        .animate-space-float {
          animation: space-float 4s ease-out forwards;
        }
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
      `}</style>
    </div>
  );
};

export default TwitterSpaceRoom;