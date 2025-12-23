import { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, MicOff, Hand, Users, MessageCircle, Gift, Share2, Crown, UserPlus, 
  Radio, Settings, PhoneOff, Volume2, VolumeX, Sparkles, Heart, Flame, 
  PartyPopper, ThumbsUp, Star, MoreVertical, Shield, ChevronDown, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SpaceChat } from './SpaceChat';
import { SpaceInviteModal } from './SpaceInviteModal';
import { LiveGiftModal } from './LiveGiftModal';
import { SpeakerQueuePanel } from './SpeakerQueuePanel';
import { cn } from '@/lib/utils';
import { useSpaceAudio, ConnectionStatus } from '@/hooks/useSpaceAudio';
import { useNavigation } from '@/context/NavigationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LiveSpaceRoomProps {
  spaceId: string;
  onClose: () => void;
}

interface Speaker {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  hand_raised_at?: string;
  host_muted?: boolean;
  mic_allowed?: boolean;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
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
}

const REACTION_EMOJIS = [
  { emoji: '❤️', label: 'heart' },
  { emoji: '🔥', label: 'fire' },
  { emoji: '👏', label: 'clap' },
  { emoji: '😂', label: 'laugh' },
  { emoji: '🎉', label: 'party' },
  { emoji: '💯', label: '100' },
  { emoji: '🚀', label: 'rocket' },
  { emoji: '✨', label: 'sparkle' },
];

export const LiveSpaceRoom = ({ spaceId, onClose }: LiveSpaceRoomProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [myRole, setMyRole] = useState<string>('listener');
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [showSpeakerQueue, setShowSpeakerQueue] = useState(false);
  const [selectedGiftRecipient, setSelectedGiftRecipient] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [totalGifts, setTotalGifts] = useState(0);
  const [myHostMuted, setMyHostMuted] = useState(false);
  const [myMicAllowed, setMyMicAllowed] = useState(true);

  const canSpeak = myRole === 'host' || myRole === 'co_host' || myRole === 'speaker';
  const isHost = space?.user_id === user?.id || myRole === 'host' || myRole === 'co_host';
  
  const { isConnected, isConnecting, connectionStatus, audioLevels, connect, disconnect } = useSpaceAudio({
    spaceId,
    isMuted,
    isHost: myRole === 'host' || myRole === 'co_host',
    isSpeaker: myRole === 'speaker',
    isListener: myRole === 'listener',
  });

  // Hide bottom navigation when in live space
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Duration timer
  useEffect(() => {
    if (!space?.started_at) return;
    
    const interval = setInterval(() => {
      const start = new Date(space.started_at!).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [space?.started_at]);

  // Connect audio for ALL users (not just speakers)
  useEffect(() => {
    fetchSpaceData();
    joinSpace();
    fetchTotalGifts();

    const channel = supabase
      .channel(`space-${spaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, () => fetchSpeakers())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_reactions',
        filter: `space_id=eq.${spaceId}`,
      }, (payload: any) => {
        const newReaction = {
          id: payload.new.id,
          emoji: payload.new.reaction_type,
          x: Math.random() * 60 + 20,
          y: Math.random() * 20,
        };
        setReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_gifts',
        filter: `space_id=eq.${spaceId}`,
      }, () => fetchTotalGifts())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_spaces',
        filter: `id=eq.${spaceId}`,
      }, (payload: any) => {
        if (payload.new.status === 'ended') {
          toast.info('This space has ended');
          onClose();
        }
        setSpace(payload.new);
      })
      .subscribe();

    return () => {
      leaveSpace();
      disconnect();
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  // Connect audio after role is determined
  useEffect(() => {
    if (space && user && myRole) {
      // Disconnect and reconnect when role changes to ensure proper audio setup
      disconnect();
      const timer = setTimeout(() => {
        connect();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [space, user, myRole]);

  const fetchSpaceData = async () => {
    const { data, error } = await supabase
      .from('live_spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (!error && data) {
      setSpace(data);
    }
    
    fetchSpeakers();
  };

  const fetchSpeakers = async () => {
    const { data: speakersData } = await supabase
      .from('live_space_speakers')
      .select('*')
      .eq('space_id', spaceId)
      .is('left_at', null);

    if (speakersData && speakersData.length > 0) {
      const userIds = speakersData.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const enrichedSpeakers = speakersData.map(s => ({
        ...s,
        profile: profileMap.get(s.user_id),
      }));

      setSpeakers(enrichedSpeakers);

      const mySpeaker = enrichedSpeakers.find(s => s.user_id === user?.id);
      if (mySpeaker) {
        setMyRole(mySpeaker.role);
        setIsMuted(mySpeaker.is_muted);
        setHasRaisedHand(mySpeaker.has_raised_hand);
        setMyHostMuted(mySpeaker.host_muted || false);
        setMyMicAllowed(mySpeaker.mic_allowed !== false);
      }
    }
  };

  const fetchTotalGifts = async () => {
    const { count } = await supabase
      .from('live_space_gifts')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', spaceId);
    
    setTotalGifts(count || 0);
  };

  const joinSpace = async () => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('live_space_speakers')
      .select('id')
      .eq('space_id', spaceId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (!existing) {
      await supabase.from('live_space_speakers').insert({
        space_id: spaceId,
        user_id: user.id,
        role: space?.user_id === user.id ? 'host' : 'listener',
        is_muted: true,
        host_muted: false,
        mic_allowed: true,
      });

      await supabase
        .from('live_spaces')
        .update({ viewer_count: (space?.viewer_count || 0) + 1 })
        .eq('id', spaceId);
    }
  };

  const leaveSpace = async () => {
    if (!user) return;

    await supabase
      .from('live_space_speakers')
      .update({ left_at: new Date().toISOString() })
      .eq('space_id', spaceId)
      .eq('user_id', user.id);

    if (space) {
      await supabase
        .from('live_spaces')
        .update({ viewer_count: Math.max(0, (space.viewer_count || 1) - 1) })
        .eq('id', spaceId);
    }
  };

  // Toggle mute with host control checks
  const toggleMute = async () => {
    if (!user || myRole === 'listener') return;

    // Check if host has muted us - can't unmute
    if (myHostMuted && isMuted) {
      toast.error('Host has muted you. Only the host can unmute you.');
      return;
    }

    // Check if mic is not allowed globally and we don't have permission
    if (!space?.allow_mic_for_all && !myMicAllowed && isMuted) {
      toast.error('Mic is currently disabled by host');
      return;
    }

    const newMuteState = !isMuted;
    setIsMuted(newMuteState);

    await supabase
      .from('live_space_speakers')
      .update({ is_muted: newMuteState })
      .eq('space_id', spaceId)
      .eq('user_id', user.id);
  };

  // Host mutes a user (they can't unmute themselves)
  const hostMuteUser = async (speakerId: string) => {
    if (!isHost) return;
    
    await supabase
      .from('live_space_speakers')
      .update({ is_muted: true, host_muted: true })
      .eq('id', speakerId);
    
    toast.success('User muted');
  };

  // Host allows user to unmute
  const hostUnmuteUser = async (speakerId: string) => {
    if (!isHost) return;
    
    await supabase
      .from('live_space_speakers')
      .update({ host_muted: false })
      .eq('id', speakerId);
    
    toast.success('User can now unmute');
  };

  // Toggle mic permission for a specific user
  const toggleMicPermission = async (speakerId: string, allowed: boolean) => {
    if (!isHost) return;
    
    await supabase
      .from('live_space_speakers')
      .update({ mic_allowed: allowed })
      .eq('id', speakerId);
    
    toast.success(allowed ? 'Mic permission granted' : 'Mic permission revoked');
  };

  // Global: Allow/disallow mic for all listeners
  const toggleMicForAll = async (allowed: boolean) => {
    if (!isHost) return;
    
    await supabase
      .from('live_spaces')
      .update({ allow_mic_for_all: allowed })
      .eq('id', spaceId);
    
    setSpace(prev => prev ? { ...prev, allow_mic_for_all: allowed } : null);
    toast.success(allowed ? 'Mic enabled for all' : 'Mic disabled for all');
  };

  // Mute all speakers
  const muteAllSpeakers = async () => {
    if (!isHost) return;
    
    await supabase
      .from('live_space_speakers')
      .update({ is_muted: true, host_muted: true })
      .eq('space_id', spaceId)
      .neq('user_id', user?.id)
      .in('role', ['speaker', 'co_host']);
    
    toast.success('All speakers muted');
  };

  // Allow all to unmute
  const allowAllToUnmute = async () => {
    if (!isHost) return;
    
    await supabase
      .from('live_space_speakers')
      .update({ host_muted: false })
      .eq('space_id', spaceId);
    
    toast.success('All users can now unmute');
  };

  const toggleRaiseHand = async () => {
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

    toast.success(newHandState ? '✋ Hand raised!' : 'Hand lowered');
  };

  const sendReaction = async (emoji: string) => {
    if (!user) return;

    await supabase.from('live_space_reactions').insert({
      space_id: spaceId,
      user_id: user.id,
      reaction_type: emoji,
    });
  };

  const endSpace = async () => {
    if (!user || space?.user_id !== user.id) return;

    await supabase
      .from('live_spaces')
      .update({ 
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', spaceId);

    toast.success('Space ended successfully');
    onClose();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/space/${space?.share_link || spaceId}`;
    
    // Try native share first (mobile devices)
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: space?.title || 'Live Space',
          text: `Join my live space: ${space?.title}`,
          url: shareUrl,
        });
        return;
      } catch (error: any) {
        // If user cancelled, don't fall through to clipboard
        if (error?.name === 'AbortError') return;
      }
    }
    
    // Fallback to clipboard with multiple methods
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success('Link copied to clipboard!');
        } else {
          toast.error('Could not copy link. Please copy manually: ' + shareUrl);
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Could not copy link. Please copy manually: ' + shareUrl);
    }
  };

  const promoteSpeaker = async (speakerId: string, newRole: 'speaker' | 'co_host') => {
    await supabase
      .from('live_space_speakers')
      .update({ role: newRole, has_raised_hand: false, mic_allowed: true, host_muted: false })
      .eq('id', speakerId);
    
    toast.success(`User promoted to ${newRole === 'co_host' ? 'co-host' : 'speaker'}`);
  };

  const removeSpeaker = async (speakerId: string) => {
    await supabase
      .from('live_space_speakers')
      .update({ role: 'listener', is_muted: true })
      .eq('id', speakerId);
    
    toast.success('User moved to listeners');
  };

  const hosts = speakers.filter(s => s.role === 'host' || s.role === 'co_host');
  const activeSpeakers = speakers.filter(s => s.role === 'speaker');
  const listeners = speakers.filter(s => s.role === 'listener');
  const raisedHands = listeners.filter(s => s.has_raised_hand).sort((a, b) => 
    new Date(a.hand_raised_at || 0).getTime() - new Date(b.hand_raised_at || 0).getTime()
  );

  const getViewersList = () => {
    return speakers.map(s => ({
      id: s.user_id,
      display_name: s.profile?.display_name || 'User',
      username: s.profile?.username || 'user',
      avatar_url: s.profile?.avatar_url || '',
    }));
  };

  // Connection status badge
  const ConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Connecting...
          </Badge>
        );
      case 'reconnecting':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Reconnecting...
          </Badge>
        );
      case 'connected':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
            <Wifi className="w-3 h-3" />
            Connected
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
            <WifiOff className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground gap-1">
            <WifiOff className="w-3 h-3" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-primary/5">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Floating reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -200, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute text-4xl pointer-events-none z-50"
            style={{ left: `${reaction.x}%`, bottom: `${20 + reaction.y}%` }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-semibold text-red-400 uppercase">Live</span>
                </div>
                <span className="text-xs text-muted-foreground">{duration}</span>
                <ConnectionStatusBadge />
                {space?.topic_category && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {space.topic_category}
                  </Badge>
                )}
              </div>
              <h1 className="text-lg font-bold truncate">{space?.title}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {speakers.length} listening
                </span>
                {totalGifts > 0 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Gift className="w-3 h-3" />
                    {totalGifts} gifts
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Host Controls Bar */}
          {isHost && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-muted/50 border border-border/50 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch 
                  checked={space?.allow_mic_for_all !== false}
                  onCheckedChange={toggleMicForAll}
                  id="mic-for-all"
                  className="scale-90"
                />
                <label htmlFor="mic-for-all" className="text-[10px] font-medium cursor-pointer whitespace-nowrap">
                  Mic All
                </label>
              </div>
              <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="h-7 w-7"
                  onClick={muteAllSpeakers}
                  title="Mute All"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="h-7 w-7"
                  onClick={allowAllToUnmute}
                  title="Allow Unmute"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
        <div className="px-4 py-6 space-y-6">
          {/* Hosts section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hosts</span>
            </div>
            <div className="flex flex-wrap gap-6 justify-center">
              {hosts.map((speaker) => (
                <SpeakerAvatar
                  key={speaker.id}
                  speaker={speaker}
                  isHost={isHost}
                  currentUserId={user?.id}
                  audioLevel={audioLevels[speaker.user_id] || 0}
                  onGift={() => {
                    setSelectedGiftRecipient(speaker.user_id);
                    setShowGiftModal(true);
                  }}
                  onHostMute={() => hostMuteUser(speaker.id)}
                  onHostUnmute={() => hostUnmuteUser(speaker.id)}
                  onToggleMicPermission={(allowed) => toggleMicPermission(speaker.id, allowed)}
                  onRemove={() => removeSpeaker(speaker.id)}
                  size="lg"
                  showCrown
                />
              ))}
            </div>
          </section>

          {/* Speakers section */}
          {activeSpeakers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Mic className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Speakers</span>
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                {activeSpeakers.map((speaker) => (
                  <SpeakerAvatar
                    key={speaker.id}
                    speaker={speaker}
                    isHost={isHost}
                    currentUserId={user?.id}
                    audioLevel={audioLevels[speaker.user_id] || 0}
                    onGift={() => {
                      setSelectedGiftRecipient(speaker.user_id);
                      setShowGiftModal(true);
                    }}
                    onHostMute={() => hostMuteUser(speaker.id)}
                    onHostUnmute={() => hostUnmuteUser(speaker.id)}
                    onToggleMicPermission={(allowed) => toggleMicPermission(speaker.id, allowed)}
                    onRemove={() => removeSpeaker(speaker.id)}
                    size="md"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Raised hands (for hosts) */}
          {isHost && raisedHands.length > 0 && (
            <section className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Raised Hands</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border-0">{raisedHands.length}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {raisedHands.map((speaker) => (
                  <div key={speaker.id} className="flex items-center justify-between p-2 rounded-xl bg-background/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={speaker.profile?.avatar_url || ''} />
                        <AvatarFallback>{speaker.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{speaker.profile?.display_name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="h-7 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700"
                        onClick={() => promoteSpeaker(speaker.id, 'speaker')}
                      >
                        <Mic className="w-3 h-3 mr-1" />
                        Invite
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7"
                        onClick={() => promoteSpeaker(speaker.id, 'co_host')}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Co-host
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Listeners section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Listeners ({listeners.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {listeners.slice(0, 24).map((listener) => (
                <div key={listener.id} className="relative group">
                  <Avatar className={cn(
                    "w-12 h-12 ring-2 transition-all cursor-pointer",
                    listener.has_raised_hand ? "ring-amber-400 animate-bounce" : "ring-transparent hover:ring-primary/50"
                  )}>
                    <AvatarImage src={listener.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-muted">
                      {listener.profile?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {listener.has_raised_hand && (
                    <span className="absolute -top-1 -right-1 text-lg">✋</span>
                  )}
                  {isHost && (
                    <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="icon" 
                        className="w-5 h-5 rounded-full"
                        onClick={() => promoteSpeaker(listener.id, 'speaker')}
                      >
                        <Mic className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {listeners.length > 24 && (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  +{listeners.length - 24}
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-background/90 border-t border-border/50 pb-safe">
        {/* Host muted warning */}
        {myHostMuted && canSpeak && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-500/10 border-b border-red-500/20">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">You've been muted by the host</span>
          </div>
        )}

        {/* Quick reactions */}
        <div className="flex justify-center gap-1 py-3 px-4 border-b border-border/30">
          {REACTION_EMOJIS.map(({ emoji, label }) => (
            <motion.button
              key={label}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.2 }}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors text-xl"
              onClick={() => sendReaction(emoji)}
            >
              {emoji}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          {/* Leave/End button */}
          <Button 
            variant={isHost ? "destructive" : "outline"} 
            onClick={isHost ? () => setShowEndConfirm(true) : onClose}
            className={cn(
              "flex-1 h-12 rounded-xl font-semibold",
              isHost && "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            )}
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            {isHost ? 'End Space' : 'Leave'}
          </Button>

          {/* Action buttons */}
          <div className="flex gap-2">
            {myRole === 'listener' ? (
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant={hasRaisedHand ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-xl",
                    hasRaisedHand && "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0"
                  )}
                  onClick={toggleRaiseHand}
                >
                  <Hand className={cn("w-5 h-5", hasRaisedHand && "animate-bounce")} />
                </Button>
              </motion.div>
            ) : (
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant={isMuted ? "outline" : "default"}
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-xl transition-all relative",
                    !isMuted && "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-0",
                    myHostMuted && "opacity-50"
                  )}
                  onClick={toggleMute}
                  disabled={myHostMuted && isMuted}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  {myHostMuted && (
                    <Shield className="absolute -top-1 -right-1 w-4 h-4 text-red-500" />
                  )}
                </Button>
              </motion.div>
            )}

            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-xl"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="w-5 h-5" />
            </Button>

            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-xl relative"
              onClick={() => setShowGiftModal(true)}
            >
              <Gift className="w-5 h-5" />
              {totalGifts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-white flex items-center justify-center">
                  {totalGifts > 99 ? '99+' : totalGifts}
                </span>
              )}
            </Button>

            {isHost && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-xl"
                onClick={() => setShowInviteModal(true)}
              >
                <UserPlus className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-background border-l border-border z-50"
          >
            <SpaceChat spaceId={spaceId} onClose={() => setShowChat(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <SpaceInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        spaceId={spaceId}
      />

      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => {
          setShowGiftModal(false);
          setSelectedGiftRecipient(null);
        }}
        streamId={spaceId}
        hostId={selectedGiftRecipient || hosts[0]?.user_id || space?.user_id || ''}
        viewers={getViewersList()}
        isHost={isHost}
      />

      {/* End Space Confirmation */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this space?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end the space for all {speakers.length} listeners. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={endSpace}
              className="bg-red-500 hover:bg-red-600"
            >
              End Space
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Speaker Avatar Component
interface SpeakerAvatarProps {
  speaker: Speaker;
  isHost: boolean;
  currentUserId?: string;
  audioLevel: number;
  onGift: () => void;
  onHostMute?: () => void;
  onHostUnmute?: () => void;
  onToggleMicPermission?: (allowed: boolean) => void;
  onRemove?: () => void;
  size: 'sm' | 'md' | 'lg';
  showCrown?: boolean;
}

const SpeakerAvatar = ({ 
  speaker, 
  isHost, 
  currentUserId,
  audioLevel, 
  onGift, 
  onHostMute,
  onHostUnmute,
  onToggleMicPermission,
  onRemove,
  size, 
  showCrown 
}: SpeakerAvatarProps) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const isSpeaking = !speaker.is_muted && audioLevel > 0.1;
  const isSelf = speaker.user_id === currentUserId;
  const canShowHostControls = isHost && !isSelf && speaker.role !== 'host';

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative">
        {/* Speaking indicator ring */}
        {isSpeaking && (
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '1s' }} />
        )}
        
        <Avatar className={cn(
          sizeClasses[size],
          "ring-4 transition-all",
          isSpeaking 
            ? "ring-primary shadow-lg shadow-primary/30" 
            : speaker.is_muted 
            ? "ring-muted" 
            : "ring-green-500/50"
        )}>
          <AvatarImage src={speaker.profile?.avatar_url || ''} />
          <AvatarFallback className="text-lg font-bold">
            {speaker.profile?.display_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>

        {/* Crown for hosts */}
        {showCrown && speaker.role === 'host' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
        )}

        {/* Mute indicator */}
        <div className={cn(
          "absolute -bottom-1 -right-1 rounded-full p-1",
          speaker.is_muted ? "bg-red-500" : "bg-green-500"
        )}>
          {speaker.is_muted ? (
            <MicOff className="w-3 h-3 text-white" />
          ) : (
            <Mic className="w-3 h-3 text-white" />
          )}
        </div>

        {/* Host muted indicator */}
        {speaker.host_muted && (
          <div className="absolute -top-1 -left-1 rounded-full p-1 bg-red-500">
            <Shield className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Actions dropdown for hosts */}
        {canShowHostControls && (
          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary" className="w-6 h-6 rounded-full">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onGift}>
                  <Gift className="w-4 h-4 mr-2" />
                  Send Gift
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {speaker.host_muted ? (
                  <DropdownMenuItem onClick={onHostUnmute}>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Allow to Unmute
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onHostMute}>
                    <VolumeX className="w-4 h-4 mr-2" />
                    Mute User
                  </DropdownMenuItem>
                )}
                {speaker.mic_allowed ? (
                  <DropdownMenuItem onClick={() => onToggleMicPermission?.(false)}>
                    <MicOff className="w-4 h-4 mr-2" />
                    Revoke Mic Permission
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onToggleMicPermission?.(true)}>
                    <Mic className="w-4 h-4 mr-2" />
                    Grant Mic Permission
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRemove} className="text-destructive">
                  <X className="w-4 h-4 mr-2" />
                  Remove from stage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-xs font-medium truncate max-w-[80px]">
          {speaker.profile?.display_name || 'User'}
        </p>
        {speaker.role !== 'listener' && speaker.role !== 'speaker' && (
          <Badge variant="secondary" className="text-[10px] h-4 mt-0.5">
            {speaker.role === 'host' ? 'Host' : 'Co-host'}
          </Badge>
        )}
      </div>

      {/* Gift button on hover */}
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onGift}
      >
        <Gift className="w-3 h-3 mr-1" />
        Gift
      </Button>
    </div>
  );
};
