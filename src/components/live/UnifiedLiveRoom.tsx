import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, Heart, Wifi, WifiOff, Crown, 
  Plus, Radio, Zap 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useUnifiedLive, RoomInfo, ParticipantRole } from '@/context/UnifiedLiveContext';
import { FlyingChat } from '@/components/live/FlyingChat';
import { AudioVisualizer } from '@/components/live/unified/AudioVisualizer';
import { PKBattleBar } from '@/components/live/unified/PKBattleBar';
import { ConnectionOverlay } from '@/components/live/shared/ConnectionOverlay';
import { LiveControlBar } from '@/components/live/shared/LiveControlBar';
import { FloatingLivePlayer } from '@/components/live/FloatingLivePlayer';
import { LiveGiftModal } from '@/components/live/LiveGiftModal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
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
}

interface UnifiedLiveRoomProps {
  roomInfo: RoomInfo;
  role: ParticipantRole;
  onClose: () => void;
}

export const UnifiedLiveRoom = ({ roomInfo, role, onClose }: UnifiedLiveRoomProps) => {
  const navigate = useNavigate();
  const { 
    state, 
    joinRoom, 
    leaveRoom, 
    minimize, 
    toggleMute, 
    toggleCamera,
    videoTrack 
  } = useUnifiedLive();
  
  const { connectionStatus, isMuted, isCameraOn, isMinimized, viewerCount, audioLevels } = state;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [flyingGifts, setFlyingGifts] = useState<FlyingGift[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [heartTrigger, setHeartTrigger] = useState(0);
  const [pkTimeLeft, setPkTimeLeft] = useState(0);

  const isHost = role === 'host' || role === 'co_host';

  // Join room on mount
  useEffect(() => {
    joinRoom(roomInfo, role);
  }, []);

  // Attach video track
  useEffect(() => {
    if (videoRef.current && videoTrack && roomInfo.type !== 'audio_space') {
      videoTrack.attach(videoRef.current);
      return () => {
        if (videoRef.current) videoTrack.detach(videoRef.current);
      };
    }
  }, [videoTrack, roomInfo.type]);

  // Fetch chat messages for video streams only (simpler query)
  const { data: chatMessages } = useQuery({
    queryKey: ['live-chat', roomInfo.id, roomInfo.type],
    queryFn: async () => {
      if (roomInfo.type === 'audio_space') {
        // For spaces, fetch messages without join
        const { data, error } = await supabase
          .from('live_space_messages')
          .select('id, content, user_id, created_at')
          .eq('space_id', roomInfo.id)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (error) throw error;
        
        // Fetch profiles separately
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
        // For streams
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

  // Handle leave
  const handleLeave = async () => {
    await leaveRoom();
    onClose();
  };

  // Handle follow
  const handleFollow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

  // Handle double tap for hearts
  const handleDoubleTap = useCallback(() => {
    setHeartTrigger(prev => prev + 1);
  }, []);

  // Handle gift sent
  const handleGiftSent = (gift: { type: string; credits: number; senderName: string }) => {
    const newGift: FlyingGift = {
      id: Date.now().toString(),
      gift_type: gift.type,
      sender_name: gift.senderName,
      credit_value: gift.credits,
    };
    setFlyingGifts(prev => [...prev, newGift]);
    setTimeout(() => {
      setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
    }, 5000);
  };

  // Share
  const handleShare = async () => {
    const url = `${window.location.origin}/live/${roomInfo.type === 'audio_space' ? 'space' : 'stream'}/${roomInfo.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: roomInfo.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
      }
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  // If minimized, show floating player
  if (isMinimized) {
    return <FloatingLivePlayer />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent"
      >
        <div className="flex items-center justify-between">
          {/* Host Info */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar 
                className="w-12 h-12 ring-2 ring-primary cursor-pointer"
                onClick={() => navigate(`/profile/${roomInfo.hostId}`)}
              >
                <AvatarImage src={roomInfo.hostAvatar} />
                <AvatarFallback>{roomInfo.hostName[0]}</AvatarFallback>
              </Avatar>
              {connectionStatus === 'connected' && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{roomInfo.hostName}</span>
                {isHost && <Crown className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Users className="w-3 h-3" />
                <span>{viewerCount}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>LIVE</span>
              </div>
            </div>
            {!isHost && (
              <Button
                size="sm"
                variant={isFollowing ? "secondary" : "default"}
                onClick={handleFollow}
                className="ml-2"
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            )}
          </div>

          {/* Connection Status & Close */}
          <div className="flex items-center gap-3">
            {connectionStatus === 'reconnecting' && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 px-2 py-1 rounded-full">
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-400">Reconnecting...</span>
              </div>
            )}
            <button
              onClick={handleLeave}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Stage */}
      <div 
        className="flex-1 relative"
        onDoubleClick={handleDoubleTap}
      >
        {/* Connection Overlay */}
        <AnimatePresence>
          {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting' || connectionStatus === 'error') && (
            <ConnectionOverlay 
              status={connectionStatus} 
              onRetry={() => joinRoom(roomInfo, role)}
            />
          )}
        </AnimatePresence>

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
                <div className="absolute bottom-4 right-4 text-white text-sm font-semibold bg-red-500/50 px-2 py-1 rounded">
                  {roomInfo.pkData.challengerName}
                </div>
              </div>
            </div>
          </div>
        ) : roomInfo.type === 'audio_space' ? (
          // Audio Space Mode
          <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-emerald-500/10"
                  style={{
                    width: 200 + i * 100,
                    height: 200 + i * 100,
                    left: '50%',
                    top: '50%',
                    x: '-50%',
                    y: '-50%',
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.1, 0.3],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>

            {/* Host Avatar with Visualizer */}
            <div className="relative z-10">
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(16, 185, 129, 0.3)',
                    '0 0 60px rgba(16, 185, 129, 0.6)',
                    '0 0 20px rgba(16, 185, 129, 0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-full"
              >
                <Avatar className="w-32 h-32 ring-4 ring-emerald-400">
                  <AvatarImage src={roomInfo.hostAvatar} />
                  <AvatarFallback className="text-4xl">{roomInfo.hostName[0]}</AvatarFallback>
                </Avatar>
              </motion.div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                <AudioVisualizer 
                  active={connectionStatus === 'connected' && !isMuted}
                  barCount={5}
                  color="bg-emerald-400"
                />
              </div>
            </div>

            {/* Title */}
            <h2 className="mt-8 text-2xl font-bold text-white text-center px-8 z-10">
              {roomInfo.title}
            </h2>

            {/* Live Badge */}
            <div className="mt-4 flex items-center gap-2 bg-emerald-500/20 px-4 py-2 rounded-full z-10">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Live Audio</span>
            </div>
          </div>
        ) : (
          // Video Broadcast Mode
          <div className="h-full relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={roomInfo.hostAvatar} />
                  <AvatarFallback className="text-3xl">{roomInfo.hostName[0]}</AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
        )}

        {/* Flying Chat Overlay */}
        <FlyingChat
          messages={messages}
          gifts={flyingGifts}
          hostId={roomInfo.hostId}
          bottomOffset={isHost ? 180 : 160}
        />

        {/* Floating Hearts Animation */}
        <FloatingHearts trigger={heartTrigger} />

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-48 flex flex-col gap-4 z-20">
          <ActionButton
            icon={<Heart className="w-6 h-6" />}
            onClick={() => setHeartTrigger(prev => prev + 1)}
            className="text-red-400"
          />
          {!isHost && (
            <ActionButton
              icon={<Plus className="w-6 h-6" />}
              onClick={() => setShowGiftModal(true)}
              className="text-amber-400 bg-amber-500/20"
            />
          )}
        </div>
      </div>

      {/* Control Bar */}
      <LiveControlBar
        roomType={roomInfo.type}
        isHost={isHost}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        onMicToggle={toggleMute}
        onCameraToggle={toggleCamera}
        onChatToggle={() => {}}
        onGiftClick={() => setShowGiftModal(true)}
        onShareClick={handleShare}
        onEndStream={handleLeave}
        onMinimize={minimize}
      />

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

// Floating Hearts Animation
const FloatingHearts = ({ trigger }: { trigger: number }) => {
  const [hearts, setHearts] = useState<{ id: number; left: number; color: string }[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const colors = ['text-red-500', 'text-pink-500', 'text-purple-500', 'text-orange-400'];
    const newHeart = {
      id: Date.now(),
      left: 70 + (Math.random() * 20 - 10),
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== newHeart.id)), 2000);
  }, [trigger]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {hearts.map(heart => (
        <motion.div
          key={heart.id}
          initial={{ y: 0, scale: 0.5, opacity: 0 }}
          animate={{ y: -300, scale: 1.2, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2, ease: 'easeOut' }}
          className={cn("absolute bottom-40", heart.color)}
          style={{ left: `${heart.left}%` }}
        >
          <Heart className="w-8 h-8" fill="currentColor" />
        </motion.div>
      ))}
    </div>
  );
};

export default UnifiedLiveRoom;
