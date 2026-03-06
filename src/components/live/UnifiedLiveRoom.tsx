import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Heart, Wifi, WifiOff, Crown, 
  Plus, Radio, Zap, Sword, Monitor, Megaphone,
  Share2, Gift, ArrowLeft, Minimize2, MoreVertical,
  Mic, MicOff, Video, VideoOff, Hand, Circle
} from 'lucide-react';
import { StreamOptionsMenu } from '@/components/live/StreamOptionsMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useUnifiedLive, RoomInfo, ParticipantRole, Participant } from '@/context/UnifiedLiveContext';
import { FlyingChat } from '@/components/live/FlyingChat';
import { AudioVisualizer } from '@/components/live/unified/AudioVisualizer';
import { PKBattleBar } from '@/components/live/unified/PKBattleBar';
import { ConnectionOverlay } from '@/components/live/shared/ConnectionOverlay';
import { FloatingLivePlayer } from '@/components/live/FloatingLivePlayer';
import { LiveGiftModal } from '@/components/live/LiveGiftModal';
import { ParticipantsList } from '@/components/live/shared/ParticipantsList';
import { QuickGiftBar } from '@/components/live/shared/QuickGiftBar';
import { HostGiftPanel } from '@/components/live/shared/HostGiftPanel';
import { BroadcastInput } from '@/components/live/shared/BroadcastInput';
import { SpeakerQueuePanel } from '@/components/live/SpeakerQueuePanel';
import { PostRecordingModal } from '@/components/live/PostRecordingModal';
import { EventCoverDisplay } from '@/components/live/shared/EventCoverDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';
import { shareUrls } from '@/lib/url-utils';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_broadcast?: boolean;
  profiles?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

interface FlyingGift {
  id: string;
  gift_type: string;
  sender_name: string;
  credit_value: number;
  sender_id?: string;
  sender_avatar?: string;
}

interface UnifiedLiveRoomProps {
  roomInfo: RoomInfo;
  role: ParticipantRole;
  onClose: () => void;
}

export const UnifiedLiveRoom = ({ roomInfo, role, onClose }: UnifiedLiveRoomProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    state, 
    joinRoom, 
    leaveRoom, 
    minimize, 
    toggleMute, 
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    toggleRaiseHand,
    muteParticipant,
    unmuteParticipant,
    muteAll,
    unmuteAll,
    inviteToSpeak,
    removeFromSpeakers,
    sendBroadcastMessage,
    startPKBattle,
    videoTrack,
  } = useUnifiedLive();
  
  const { remoteVideoTrack } = state;
  
  const { 
    connectionStatus, 
    isMuted, 
    isCameraOn, 
    isMinimized, 
    viewerCount, 
    audioLevels,
    participants,
    isScreenSharing,
    isRecording,
    userCredits,
    hasRaisedHand,
    role: currentRole
  } = state;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [flyingGifts, setFlyingGifts] = useState<FlyingGift[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showQuickGifts, setShowQuickGifts] = useState(false);
  const [showHostGiftPanel, setShowHostGiftPanel] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showRaisedHands, setShowRaisedHands] = useState(false);
  const [raisedHandsCount, setRaisedHandsCount] = useState(0);
  const [reactionTrigger, setReactionTrigger] = useState(0);
  const [reactionIcon, setReactionIcon] = useState("❤️");
  const [pkTimeLeft, setPkTimeLeft] = useState(0);
  const [localCredits, setLocalCredits] = useState(userCredits);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const isHost = role === 'host' || role === 'co_host';
  const isListener = role === 'listener';

  // Join room on mount
  useEffect(() => {
    joinRoom(roomInfo, role);
  }, []);

  // Fetch user credits from user_credits table (source of truth)
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setLocalCredits(data.balance || 0);
      }
    };
    fetchCredits();
  }, [user]);

  // Subscribe to raised hands count for host (all room types)
  useEffect(() => {
    if (!isHost || connectionStatus !== 'connected') return;

    const tableName = roomInfo.type === 'audio_space' 
      ? 'live_space_speakers' 
      : 'live_stream_viewers';
    const filterField = roomInfo.type === 'audio_space' ? 'space_id' : 'stream_id';

    const fetchRaisedHands = async () => {
      if (roomInfo.type === 'audio_space') {
        const { count } = await supabase
          .from('live_space_speakers')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', roomInfo.id)
          .eq('has_raised_hand', true)
          .is('left_at', null);
        setRaisedHandsCount(count || 0);
      } else {
        const { count } = await supabase
          .from('live_stream_viewers')
          .select('*', { count: 'exact', head: true })
          .eq('stream_id', roomInfo.id)
          .eq('has_raised_hand', true)
          .eq('is_active', true);
        setRaisedHandsCount(count || 0);
      }
    };

    const handleRaisedHandChange = async (payload: any) => {
      // Check if hand was just raised (new.has_raised_hand = true, old was false)
      if (payload.new?.has_raised_hand && !payload.old?.has_raised_hand) {
        // Fetch user profile to show in toast
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', payload.new.user_id)
          .single();
        
        // Show toast notification with View Queue action
        toast(`${profile?.display_name || 'Someone'} raised their hand!`, {
          icon: '✋',
          duration: 5000,
          action: {
            label: 'View Queue',
            onClick: () => setShowRaisedHands(true)
          }
        });
      }
      // Always update count
      fetchRaisedHands();
    };

    fetchRaisedHands();

    // Subscribe to changes with notification for new hand raises
    const channel = supabase
      .channel(`raised-hands-${roomInfo.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: tableName,
        filter: `${filterField}=eq.${roomInfo.id}`,
      }, handleRaisedHandChange)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: tableName,
        filter: `${filterField}=eq.${roomInfo.id}`,
      }, () => fetchRaisedHands())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isHost, roomInfo.id, roomInfo.type, connectionStatus]);

  // Subscribe to realtime reactions and gifts so they show on all screens (including host)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const reactionChannel = supabase
      .channel(`live-reactions-${roomInfo.id}`)
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload?.emoji) {
          setReactionIcon(payload.emoji);
          setReactionTrigger(prev => prev + 1);
        }
      })
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        // Show gift from other users (don't duplicate for sender)
        if (payload?.senderId && payload.senderId !== user?.id) {
          const newGift: FlyingGift = {
            id: `broadcast-${Date.now()}`,
            gift_type: payload.giftType,
            sender_name: payload.senderName,
            credit_value: payload.credits,
            sender_id: payload.senderId,
            sender_avatar: payload.senderAvatar,
          };
          setFlyingGifts(prev => [...prev, newGift]);
          setReactionIcon(payload.giftType);
          setReactionTrigger(prev => prev + 1);
          
          setTimeout(() => {
            setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
          }, 5000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reactionChannel);
    };
  }, [roomInfo.id, connectionStatus, user?.id]);

  // Subscribe to host control broadcasts (mute all, etc.) for non-host participants
  useEffect(() => {
    if (isHost || connectionStatus !== 'connected') return;

    const controlChannel = supabase
      .channel(`space-control-listener-${roomInfo.id}`)
      .on('broadcast', { event: 'mute_all' }, (payload: any) => {
        if (payload.payload?.by !== user?.id) {
          // Mute local audio via context
          toggleMute();
          toast.info('You have been muted by the host');
        }
      })
      .on('broadcast', { event: 'allow_unmute' }, (payload: any) => {
        if (payload.payload?.by !== user?.id) {
          toast.info('You can now unmute');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(controlChannel);
    };
  }, [isHost, roomInfo.id, connectionStatus, user?.id, toggleMute]);

  // Attach video track - use local track for host, remote track for viewers
  useEffect(() => {
    if (!videoRef.current || roomInfo.type === 'audio_space') return;
    
    // Host uses their own local video track
    if (isHost && videoTrack) {
      console.log('[UnifiedLiveRoom] Attaching local video track (host)');
      videoTrack.attach(videoRef.current);
      return () => {
        if (videoRef.current) videoTrack.detach(videoRef.current);
      };
    }
    
    // Viewers use remote video track from host
    if (!isHost && remoteVideoTrack) {
      console.log('[UnifiedLiveRoom] Attaching remote video track (viewer)');
      remoteVideoTrack.attach(videoRef.current);
      return () => {
        if (videoRef.current) remoteVideoTrack.detach(videoRef.current);
      };
    }
  }, [videoTrack, remoteVideoTrack, roomInfo.type, isHost]);

  // Fetch chat messages
  const { data: chatMessages } = useQuery({
    queryKey: ['live-chat', roomInfo.id, roomInfo.type],
    queryFn: async () => {
      if (roomInfo.type === 'audio_space') {
        const { data, error } = await supabase
          .from('live_space_messages')
          .select('id, content, user_id, created_at')
          .eq('space_id', roomInfo.id)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(m => m.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', userIds);
          
          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          return data.map(m => ({
            ...m,
            profiles: profileMap.get(m.user_id),
          }));
        }
        return data || [];
      } else {
        const { data, error } = await supabase
          .from('live_stream_comments')
          .select('id, content, user_id, created_at')
          .eq('stream_id', roomInfo.id)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(m => m.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', userIds);
          
          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          return data.map(m => ({
            ...m,
            profiles: profileMap.get(m.user_id),
          }));
        }
        return data || [];
      }
    },
    enabled: connectionStatus === 'connected',
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (chatMessages) {
      setMessages(chatMessages.map((m: any) => ({
        id: m.id,
        content: m.content,
        user_id: m.user_id,
        created_at: m.created_at,
        profiles: m.profiles,
        is_broadcast: m.content?.startsWith('📢'),
      })));
    }
  }, [chatMessages]);

  // Real-time chat subscription
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const table = roomInfo.type === 'audio_space' ? 'live_space_messages' : 'live_stream_comments';
    
    const channel = supabase
      .channel(`${table}-${roomInfo.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table,
        filter: roomInfo.type === 'audio_space' 
          ? `space_id=eq.${roomInfo.id}`
          : `stream_id=eq.${roomInfo.id}`,
      }, async (payload) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', payload.new.user_id)
          .single();

        const newMessage: ChatMessage = {
          id: payload.new.id,
          content: payload.new.content,
          user_id: payload.new.user_id,
          created_at: payload.new.created_at,
          profiles: profile || undefined,
          is_broadcast: payload.new.content?.startsWith('📢'),
        };
        setMessages(prev => [...prev.slice(-49), newMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomInfo.id, roomInfo.type, connectionStatus]);

  // PK Battle timer
  useEffect(() => {
    if (roomInfo.type === 'pk_battle' && roomInfo.pkData?.endTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((new Date(roomInfo.pkData!.endTime).getTime() - Date.now()) / 1000));
        setPkTimeLeft(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomInfo.pkData?.endTime, roomInfo.type]);

  // Handle send message
  const handleSendMessage = async (message: string, isBroadcast: boolean) => {
    if (!user) return;

    if (isBroadcast && isHost) {
      await sendBroadcastMessage(message);
    } else {
      try {
        if (roomInfo.type === 'audio_space') {
          await supabase.from('live_space_messages').insert({
            space_id: roomInfo.id,
            user_id: user.id,
            content: message,
          });
        } else {
          await supabase.from('live_stream_comments').insert({
            stream_id: roomInfo.id,
            user_id: user.id,
            content: message,
          });
        }
      } catch (error) {
        toast.error('Failed to send message');
      }
    }
  };

  // Handle leave
  const handleLeave = async () => {
    // Check for recording URL if host is ending the stream
    if (isHost && isRecording) {
      try {
        // For live_streams (video), check recording_url
        if (roomInfo.type !== 'audio_space') {
          const { data } = await supabase
            .from('live_streams')
            .select('cf_recording_uid')
            .eq('id', roomInfo.id)
            .single();
          
          if (data?.cf_recording_uid) {
            // Recording was made - show modal
            setRecordingUrl(data.cf_recording_uid);
            setShowRecordingModal(true);
            await leaveRoom();
            return;
          }
        } else {
          // For audio spaces
          const { data } = await supabase
            .from('live_spaces')
            .select('recording_url')
            .eq('id', roomInfo.id)
            .single();
          
          if (data?.recording_url) {
            setRecordingUrl(data.recording_url);
            setShowRecordingModal(true);
            await leaveRoom();
            return;
          }
        }
      } catch (error) {
        console.error('Error checking recording:', error);
      }
    }
    
    await leaveRoom();
    onClose();
  };

  // Handle close after recording modal
  const handleCloseRecordingModal = () => {
    setShowRecordingModal(false);
    onClose();
  };

  // Handle follow
  const handleFollow = async () => {
    try {
      if (!user) {
        toast.error('Please sign in to follow');
        return;
      }

      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', roomInfo.hostId);
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: roomInfo.hostId });
      }
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  // Handle double tap for reactions - broadcasts to all viewers
  const handleDoubleTap = useCallback(() => {
    // Broadcast reaction to all viewers
    supabase.channel(`live-reactions-${roomInfo.id}`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji: '❤️', userId: user?.id }
    });
    // Local trigger for sender
    setReactionIcon("❤️");
    setReactionTrigger(prev => prev + 1);
  }, [roomInfo.id, user?.id]);

  // Handle heart button click - broadcasts to all viewers
  const handleHeartReaction = useCallback(() => {
    supabase.channel(`live-reactions-${roomInfo.id}`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji: '❤️', userId: user?.id }
    });
    // Local trigger for sender
    setReactionIcon("❤️");
    setReactionTrigger(prev => prev + 1);
  }, [roomInfo.id, user?.id]);

  // Handle gift sent
  const handleGiftSent = (gift: { type: string; credits: number; senderName: string; senderAvatar?: string }) => {
    const newGift: FlyingGift = {
      id: Date.now().toString(),
      gift_type: gift.type,
      sender_name: gift.senderName,
      credit_value: gift.credits,
      sender_id: user?.id,
      sender_avatar: gift.senderAvatar || user?.user_metadata?.avatar_url,
    };
    setFlyingGifts(prev => [...prev, newGift]);
    
    // Broadcast gift to all viewers (so host sees it too)
    supabase.channel(`live-reactions-${roomInfo.id}`).send({
      type: 'broadcast',
      event: 'gift',
      payload: { 
        giftType: gift.type, 
        credits: gift.credits, 
        senderName: gift.senderName,
        senderAvatar: gift.senderAvatar || user?.user_metadata?.avatar_url,
        senderId: user?.id
      }
    });
    
    // Local trigger for reaction animation
    setReactionIcon(gift.type);
    setReactionTrigger(prev => prev + 1);
    
    setTimeout(() => {
      setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
    }, 5000);
  };

  // Handle quick gift
  const handleQuickGift = (gift: { type: string; value: number; emoji: string }) => {
    const senderName = user?.user_metadata?.display_name || user?.user_metadata?.username || 'Me';
    const senderAvatar = user?.user_metadata?.avatar_url;
    handleGiftSent({ type: gift.type, credits: gift.value, senderName, senderAvatar });
    setShowQuickGifts(false);
  };

  // Share - with proper URL and full share options
  const handleShare = async () => {
    const url = roomInfo.type === 'audio_space' 
      ? shareUrls.liveSpace(roomInfo.id)
      : shareUrls.liveStream(roomInfo.id);
    const shareTitle = roomInfo.title || (roomInfo.type === 'audio_space' ? 'Live Space' : 'Live Stream');
    const shareText = roomInfo.type === 'audio_space' 
      ? `Join this live audio space: ${shareTitle}` 
      : `Watch this live stream: ${shareTitle}`;
    
    try {
      if (navigator.share) {
        await navigator.share({ 
          title: shareTitle, 
          text: shareText,
          url 
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (e: any) {
      // User cancelled share - fallback to copy
      if (e.name !== 'AbortError') {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
      }
    }
  };

  // Handle start PK
  const handleStartPK = () => {
    // For demo, use a random challenger
    toast('PK Battle feature coming soon!');
  };

  // If minimized, show floating player
  if (isMinimized) {
    return <FloatingLivePlayer />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header - Modern TikTok/Tango Style */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent"
      >
        <div className="flex items-center justify-between">
          {/* Left: Back + Host Info Pill */}
          <div className="flex items-center gap-2">
            {/* Back Button - keeps connection alive, navigates away */}
            <button
              onClick={minimize}
              className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors"
              title="Go back - connection continues in background"
            >
              <ArrowLeft className="w-4 h-4 text-white/80" />
            </button>
            
            {/* Host Info Pill */}
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5">
              <div className="relative">
                <Avatar 
                  className="w-8 h-8 cursor-pointer"
                  onClick={() => navigate(`/profile/${roomInfo.hostId}`)}
                >
                  <AvatarImage src={roomInfo.hostAvatar} />
                  <AvatarFallback>{roomInfo.hostName[0]}</AvatarFallback>
                </Avatar>
                {connectionStatus === 'connected' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border border-black" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                   <span className="text-white text-sm font-medium">{roomInfo.hostName}</span>
                   {roomInfo.hostId && <VerifiedBadge userId={roomInfo.hostId} size="sm" />}
                  {isHost && <Crown className="w-3 h-3 text-amber-400" />}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/60">
                  <Users className="w-2.5 h-2.5" />
                  <span>{viewerCount}</span>
                </div>
              </div>
              {!isHost && (
                <Button
                  size="sm"
                  variant={isFollowing ? "secondary" : "default"}
                  onClick={handleFollow}
                  className="h-6 px-2 text-xs rounded-full ml-1"
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>

          {/* Right Actions - Manage viewers, Speaker Queue, End/Leave */}
          <div className="flex items-center gap-1">
            {/* Connection Status */}
            {connectionStatus === 'reconnecting' && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 backdrop-blur-md px-2 py-1 rounded-full mr-1">
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-400">Reconnecting...</span>
              </div>
            )}

            {/* Manage Viewers - plain icon, no background (Host only) */}
            {isHost && (
              <button 
                onClick={() => setShowParticipants(true)}
                title="Manage Viewers"
                className="p-2"
              >
                <Users className="w-5 h-5 text-white/80" />
              </button>
            )}
            
            {/* Speaker Queue - plain icon, no background (Host for all room types) */}
            {isHost && (
              <button 
                onClick={() => setShowRaisedHands(true)}
                title="Speaker Queue"
                className="p-2 relative"
              >
                <Hand className="w-5 h-5 text-white/80" />
                {raisedHandsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {raisedHandsCount}
                  </span>
                )}
              </button>
            )}

            {/* End/Leave Button */}
            <button
              onClick={handleLeave}
              className="px-4 py-1.5 rounded-full bg-destructive text-white text-sm font-semibold hover:bg-destructive/80 transition-colors ml-1"
            >
              {isHost ? 'End' : 'Leave'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Stage */}
      <div 
        className="flex-1 relative"
        onDoubleClick={handleDoubleTap}
      >
        {/* Inline Connection Status - below header, subtle */}
        <AnimatePresence>
          {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
            <div className="absolute top-16 left-0 right-0 z-30">
              <ConnectionOverlay 
                status={connectionStatus} 
                inline={true}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Full Connection Overlay - only for error state */}
        <AnimatePresence>
          {connectionStatus === 'error' && (
            <ConnectionOverlay 
              status={connectionStatus} 
              onRetry={() => joinRoom(roomInfo, role)}
            />
          )}
        </AnimatePresence>

        {/* Event Cover Image - Top Left */}
        {roomInfo.coverImageUrl && (
          <div className="absolute top-20 left-4 z-20">
            <EventCoverDisplay
              coverUrl={roomInfo.coverImageUrl}
              title={roomInfo.title}
            />
          </div>
        )}

        {/* Stage Content - Based on Room Type */}
        {roomInfo.type === 'pk_battle' && roomInfo.pkData ? (
          // PK Battle Mode
          <div className="h-full flex flex-col">
            <PKBattleBar
              hostScore={roomInfo.pkData.hostScore}
              challengerScore={roomInfo.pkData.challengerScore}
              timeLeft={pkTimeLeft}
              hostName={roomInfo.hostName}
              challengerName={roomInfo.pkData.challengerName}
              hostAvatar={roomInfo.hostAvatar}
              challengerAvatar={roomInfo.pkData.challengerAvatar}
              className="mt-20"
            />
            <div className="flex-1 flex">
              {/* Host Side */}
              <div className="flex-1 relative bg-gradient-to-br from-blue-900/50 to-blue-800/30">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 text-white text-sm font-semibold bg-blue-500/50 px-2 py-1 rounded">
                  {roomInfo.hostName}
                </div>
              </div>
              {/* Challenger Side */}
              <div className="flex-1 relative bg-gradient-to-br from-red-900/50 to-red-800/30">
                <img 
                  src={roomInfo.pkData.challengerAvatar} 
                  alt={roomInfo.pkData.challengerName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 right-4 text-white text-sm font-semibold bg-destructive/50 px-2 py-1 rounded">
                  {roomInfo.pkData.challengerName}
                </div>
              </div>
            </div>
          </div>
        ) : roomInfo.type === 'audio_space' ? (
          // Audio Space Mode - Clean center for messages/gifts
          <div className="h-full flex flex-col bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
            {/* Animated Background - Subtle rings */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-emerald-500/5"
                  style={{
                    width: 300 + i * 150,
                    height: 300 + i * 150,
                    left: '50%',
                    top: '50%',
                    x: '-50%',
                    y: '-50%',
                  }}
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.05, 0.2],
                  }}
                  transition={{
                    duration: 4 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.5,
                  }}
                />
              ))}
            </div>

            {/* Top Section - Title & Live Badge */}
            <div className="pt-20 pb-4 px-6 z-10">
              <h2 className="text-xl font-bold text-white text-center">
                {roomInfo.title}
              </h2>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-500/20 px-3 py-1 rounded-full">
                  <Radio className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-medium">Live Audio</span>
                </div>
              </div>
            </div>

            {/* Center Area - Empty for messages/gifts/emojis to display */}
            <div className="flex-1 relative">
              {/* Speaker Avatars - Small row at top of center area */}
              {participants.filter(p => p.role !== 'listener').length > 0 && (
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-3 z-10 px-4">
                  {participants.filter(p => p.role !== 'listener').slice(0, 6).map(p => (
                    <motion.div 
                      key={p.id} 
                      className="flex flex-col items-center gap-0.5"
                      animate={p.is_speaking ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.5, repeat: p.is_speaking ? Infinity : 0 }}
                    >
                      <div className="relative">
                        <Avatar className={cn(
                          "w-10 h-10 border-2",
                          p.is_speaking ? "border-emerald-400" : "border-white/20"
                        )}>
                          <AvatarImage src={p.profile?.avatar_url} />
                          <AvatarFallback className="text-xs">{p.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        {p.is_muted && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                            <MicOff className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {p.is_speaking && !p.is_muted && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                            <AudioVisualizer active={true} barCount={3} color="bg-white" className="scale-50" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-white/60 max-w-[48px] truncate flex items-center gap-0.5">
                        {p.profile?.display_name?.split(' ')[0] || 'User'}
                        <VerifiedBadge userId={p.user_id} size="sm" />
                      </span>
                    </motion.div>
                  ))}
                  {participants.filter(p => p.role !== 'listener').length > 6 && (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-xs text-white/70">+{participants.filter(p => p.role !== 'listener').length - 6}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Video Broadcast Mode - Clean, no center avatar blocking view
          <div className="h-full relative bg-black">
            {isScreenSharing ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="text-center">
                  <Monitor className="w-12 h-12 text-primary mx-auto mb-2" />
                  <p className="text-white/80 text-sm">Screen Sharing</p>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Show subtle loading state when no video - no avatar blocking */}
                {(isHost && !isCameraOn) || (!isHost && !remoteVideoTrack) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                    <div className="flex flex-col items-center gap-2">
                      {isHost && !isCameraOn ? (
                        <>
                          <VideoOff className="w-10 h-10 text-white/40" />
                          <p className="text-white/50 text-sm">Camera off</p>
                        </>
                      ) : !isHost && connectionStatus === 'connected' ? (
                        <p className="text-white/50 text-xs">Waiting for video...</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Flying Chat Overlay */}
        <FlyingChat
          messages={messages}
          gifts={flyingGifts}
          hostId={roomInfo.hostId}
          bottomOffset={isHost ? 200 : 180}
        />

        {/* Floating Reactions Animation */}
        <FloatingReactionsSimple trigger={reactionTrigger} icon={reactionIcon} />

        {/* Right Side Actions - Single Vertical Stack */}
        <div className="absolute right-4 bottom-44 flex flex-col gap-3 z-20">
          {/* Heart Reaction - White outline style - broadcasts to all */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleHeartReaction}
            className="p-3 rounded-full border-2 border-white bg-transparent backdrop-blur-sm"
          >
            <Heart className="w-6 h-6 text-white" />
          </motion.button>
          
          {/* Animated Gift Button - For viewers to gift host */}
          {!isHost && (
            <motion.button
              animate={{ 
                y: [0, -4, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowQuickGifts(true)}
              className="p-3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-orange-500/40"
            >
              <Gift className="w-6 h-6 text-white" />
            </motion.button>
          )}

          {/* Host Gift Button - For hosts to gift viewers */}
          {isHost && (
            <motion.button
              animate={{ 
                y: [0, -4, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHostGiftPanel(true)}
              className="p-3 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-teal-500/40"
            >
              <Gift className="w-6 h-6 text-white" />
            </motion.button>
          )}
          
          {/* Share Button - White outline style */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}
            className="p-3 rounded-full border-2 border-white bg-transparent backdrop-blur-sm"
          >
            <Share2 className="w-6 h-6 text-white" />
          </motion.button>

          {/* Recording Button (Host Only) - RED style */}
          {isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => toggleRecording()}
              className={cn(
                "p-3 rounded-full transition-colors relative",
                isRecording 
                  ? "bg-red-500 border-2 border-red-500" 
                  : "bg-red-500/20 border-2 border-red-500"
              )}
            >
              <Circle className={cn(
                "w-5 h-5",
                isRecording ? "text-white fill-white animate-pulse" : "text-red-500 fill-red-500"
              )} />
            </motion.button>
          )}

          {/* Screen Share Button (Host Only) - replaces 3-dot menu */}
          {isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleScreenShare}
              className={cn(
                "p-3 rounded-full transition-colors",
                isScreenSharing 
                  ? "bg-primary border-2 border-primary" 
                  : "border-2 border-white bg-transparent backdrop-blur-sm"
              )}
              title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            >
              {isScreenSharing ? (
                <Monitor className="w-5 h-5 text-white" />
              ) : (
                <Monitor className="w-5 h-5 text-white" />
              )}
            </motion.button>
          )}

          {/* Hand Raise Button (Listeners Only) - 20% smaller */}
          {isListener && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleRaiseHand}
              className={cn(
                "p-2 rounded-full transition-colors",
                hasRaisedHand 
                  ? "bg-amber-500 border-2 border-amber-500" 
                  : "border-2 border-white bg-transparent backdrop-blur-sm"
              )}
              title={hasRaisedHand ? "Lower Hand" : "Raise Hand"}
            >
              <Hand className={cn("w-4 h-4", hasRaisedHand ? "text-white" : "text-white")} />
            </motion.button>
          )}
        </div>

        {/* Quick Gift Bar - For viewers to gift host */}
        <QuickGiftBar
          isOpen={showQuickGifts}
          onClose={() => setShowQuickGifts(false)}
          recipientId={roomInfo.hostId}
          roomId={roomInfo.id}
          isSpace={roomInfo.type === 'audio_space'}
          onGiftSent={handleQuickGift}
          userCredits={localCredits}
          onCreditsChange={setLocalCredits}
          hostId={roomInfo.hostId}
        />

        {/* Host Gift Panel - For hosts to gift viewers */}
        <HostGiftPanel
          isOpen={showHostGiftPanel}
          onClose={() => setShowHostGiftPanel(false)}
          roomId={roomInfo.id}
          isSpace={roomInfo.type === 'audio_space'}
          participants={participants.map(p => ({
            id: p.user_id,
            display_name: p.profile?.display_name || 'User',
            username: p.profile?.username || '',
            avatar_url: p.profile?.avatar_url || '',
          }))}
          onGiftSent={(gift) => {
            const senderName = user?.user_metadata?.display_name || user?.user_metadata?.username || 'Host';
            handleGiftSent({ type: gift.type, credits: gift.value, senderName });
          }}
        />
      </div>

      {/* Footer Control Bar - Modern Separated Layout */}
      <FooterControlBar
        isHost={isHost}
        canSpeak={isHost || state.role === 'speaker' || state.role === 'co_host'}
        isHardMuted={state.isHardMuted}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        roomType={roomInfo.type}
        role={currentRole}
        hasRaisedHand={hasRaisedHand}
        onSendMessage={handleSendMessage}
        onMicToggle={toggleMute}
        onCameraToggle={toggleCamera}
        onScreenShareToggle={toggleScreenShare}
        onPKBattleStart={handleStartPK}
        onRaiseHand={toggleRaiseHand}
      />

      {/* Participants Modal */}
      <ParticipantsList
        isOpen={showParticipants}
        onClose={() => setShowParticipants(false)}
        roomId={roomInfo.id}
        roomType={roomInfo.type}
        isHost={isHost}
        participants={participants}
        onMuteParticipant={muteParticipant}
        onUnmuteParticipant={unmuteParticipant}
        onMuteAll={muteAll}
        onUnmuteAll={unmuteAll}
        onInviteUser={() => toast('Invite feature coming soon!')}
        onPromoteToSpeaker={inviteToSpeak}
        onDemoteToListener={removeFromSpeakers}
      />

      {/* Raised Hands Panel for Host in Audio Spaces */}
      {showRaisedHands && isHost && roomInfo.type === 'audio_space' && (
        <SpeakerQueuePanel
          spaceId={roomInfo.id}
          isHost={isHost}
          onClose={() => setShowRaisedHands(false)}
        />
      )}

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={roomInfo.id}
        hostId={roomInfo.hostId}
        viewers={[]}
        isHost={isHost}
        isSpace={roomInfo.type === 'audio_space'}
      />

      {/* Post Recording Modal */}
      {recordingUrl && (
        <PostRecordingModal
          isOpen={showRecordingModal}
          onClose={handleCloseRecordingModal}
          recordingUrl={recordingUrl}
          roomType={roomInfo.type === 'audio_space' ? 'audio_space' : 'video_broadcast'}
          title={roomInfo.title}
          hostName={roomInfo.hostName}
          hostAvatar={roomInfo.hostAvatar}
          viewerCount={viewerCount}
        />
      )}
    </div>
  );
};

// Footer Control Bar - Modern TikTok/Tango Style
interface FooterControlBarProps {
  isHost: boolean;
  canSpeak: boolean;
  isHardMuted: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  roomType: 'video_broadcast' | 'audio_space' | 'pk_battle';
  role: ParticipantRole;
  hasRaisedHand: boolean;
  onSendMessage: (message: string, isBroadcast: boolean) => void;
  onMicToggle: () => void;
  onCameraToggle: () => void;
  onScreenShareToggle: () => void;
  onPKBattleStart: () => void;
  onRaiseHand: () => void;
}

const FooterControlBar = ({
  isHost,
  canSpeak,
  isHardMuted,
  isMuted,
  isCameraOn,
  isScreenSharing,
  roomType,
  role,
  hasRaisedHand,
  onSendMessage,
  onMicToggle,
  onCameraToggle,
  onScreenShareToggle,
  onPKBattleStart,
  onRaiseHand,
}: FooterControlBarProps) => {
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
    >
      <div className="flex items-center gap-2 flex-nowrap">
        {/* Megaphone Toggle - Host Only, Smaller */}
        {isHost && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsBroadcastMode(!isBroadcastMode)}
            className={cn(
              "p-2 rounded-full transition-all shrink-0",
              isBroadcastMode 
                ? "bg-destructive text-white" 
                : "bg-white/10 text-white/60 hover:text-white"
            )}
          >
            <Megaphone className="w-4 h-4" />
          </motion.button>
        )}

        {/* Input Container - Takes remaining space, mic button inside */}
        <div className="flex-1 min-w-0">
          <BroadcastInput
            onSendMessage={onSendMessage}
            placeholder="Say something..."
            isBroadcastMode={isBroadcastMode}
            showMicButton={(roomType === 'audio_space') || canSpeak}
            isMuted={isMuted}
            onMicToggle={onMicToggle}
            isHardMuted={isHardMuted}
          />
        </div>

        {/* Raise Hand Button - For listeners only in audio spaces (to request co-host/speaker promotion) */}
        {role === 'listener' && roomType === 'audio_space' && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onRaiseHand}
            className={cn(
              "p-2.5 rounded-full transition-all shrink-0",
              hasRaisedHand 
                ? "bg-amber-500 text-white" 
                : "bg-white/10 text-white/60"
            )}
            title="Raise hand to request speaker role"
          >
            <Hand className="w-4 h-4" />
          </motion.button>
        )}

        {/* Desktop Only: Show extra controls inline on wider screens */}
        <div className="hidden md:flex items-center gap-2">
          {/* Screen Share Button - Host Only */}
          {isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onScreenShareToggle}
              className={cn(
                "p-2.5 rounded-full transition-all shrink-0",
                isScreenSharing 
                  ? "bg-emerald-500 text-white" 
                  : "bg-white/10 text-white/60 hover:text-white"
              )}
            >
              <Monitor className="w-4 h-4" />
            </motion.button>
          )}

          {/* Camera Button - Video Only */}
          {roomType !== 'audio_space' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onCameraToggle}
              className={cn(
                "p-2.5 rounded-full transition-all shrink-0",
                isCameraOn 
                  ? "bg-white/10 text-white/60 hover:text-white" 
                  : "bg-rose-500 text-white"
              )}
            >
              {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </motion.button>
          )}

          {/* PK Battle Button - Host, Video Only */}
          {isHost && roomType === 'video_broadcast' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onPKBattleStart}
              className="p-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0"
            >
              <Sword className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Right Side Menu Component - For Screen Share, Camera, PK Battle on mobile
const RightSideMenu = ({
  roomType,
  isCameraOn,
  isScreenSharing,
  onCameraToggle,
  onScreenShareToggle,
  onPKBattleStart,
}: {
  roomType: 'video_broadcast' | 'audio_space' | 'pk_battle';
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onCameraToggle: () => void;
  onScreenShareToggle: () => void;
  onPKBattleStart: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* 3-dot menu trigger */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-full bg-slate-800/80 backdrop-blur-md"
      >
        <MoreVertical className="w-5 h-5 text-white/80" />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.9 }}
            className="absolute right-12 bottom-0 flex flex-col gap-2 bg-slate-900/95 backdrop-blur-md rounded-xl p-2 border border-white/10"
          >
            {/* Screen Share */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { onScreenShareToggle(); setIsOpen(false); }}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isScreenSharing 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : "text-white/80 hover:bg-white/10"
              )}
            >
              <Monitor className="w-4 h-4" />
              <span>{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
            </motion.button>

            {/* Camera Toggle - Video Only */}
            {roomType !== 'audio_space' && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { onCameraToggle(); setIsOpen(false); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  !isCameraOn 
                    ? "bg-rose-500/20 text-rose-400" 
                    : "text-white/80 hover:bg-white/10"
                )}
              >
                {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                <span>{isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}</span>
              </motion.button>
            )}

            {/* PK Battle - Video Only */}
            {roomType === 'video_broadcast' && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { onPKBattleStart(); setIsOpen(false); }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <Sword className="w-4 h-4" />
                <span>Start PK Battle</span>
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Action Button Component
const ActionButton = ({ 
  icon, 
  onClick, 
  className 
}: { 
  icon: React.ReactNode; 
  onClick: () => void; 
  className?: string;
}) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={cn(
      "p-3 rounded-full bg-white/10 backdrop-blur-sm",
      className
    )}
  >
    {icon}
  </motion.button>
);

// Floating Reactions Animation - Matches reference design
const FloatingReactionsSimple = ({ trigger, icon }: { trigger: number; icon: string }) => {
  const [items, setItems] = useState<{ id: number; left: number }[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const newItem = { id: Date.now(), left: 50 + (Math.random() * 40 - 20) };
    setItems(prev => [...prev, newItem]);
    setTimeout(() => setItems(prev => prev.filter(h => h.id !== newItem.id)), 2500);
  }, [trigger]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {items.map(item => (
        <div
          key={item.id}
          className="absolute bottom-40 text-4xl animate-float-up"
          style={{ left: `${item.left}%` }}
        >
          {icon}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(-40px) scale(1.1); }
          100% { transform: translateY(-400px) scale(0.8); opacity: 0; }
        }
        .animate-float-up { animation: floatUp 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
      `}</style>
    </div>
  );
};

// Legacy FloatingHearts for backwards compatibility
const FloatingHearts = ({ trigger }: { trigger: number }) => {
  return <FloatingReactionsSimple trigger={trigger} icon="❤️" />
};

export default UnifiedLiveRoom;
