import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Mic, MicOff, Hand, Users, MessageCircle, Gift, Share2, Crown, UserPlus, 
  Radio, Settings, PhoneOff, Volume2, VolumeX, Sparkles, Heart, Flame, 
  PartyPopper, ThumbsUp, Star, MoreVertical, Shield, ChevronDown, Wifi, WifiOff,
  AudioLines, Home, Monitor, MonitorOff, Speaker, ArrowLeft
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
import { TestAudioModal } from './TestAudioModal';
import { SpeakerAvatarWithWaves } from './SpeakerAvatarWithWaves';
import { ListenersModal } from './ListenersModal';
import { cn } from '@/lib/utils';
import { useNavigation } from '@/context/NavigationContext';
import { useOptionalSpaceContext, ConnectionStatus } from '@/context/SpaceContext';
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
  hand_raised_at?: string | null;
  host_muted?: boolean;
  mic_allowed?: boolean;
  joined_at?: string | null;
  left_at?: string | null;
  space_id?: string;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const spaceContext = useOptionalSpaceContext();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [myRole, setMyRole] = useState<string>('listener');
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [giftAnimations, setGiftAnimations] = useState<{ id: string; emoji: string; senderName: string; receiverName: string; value: number }[]>([]);
  const [showSpeakerQueue, setShowSpeakerQueue] = useState(false);
  const [selectedGiftRecipient, setSelectedGiftRecipient] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showTestAudio, setShowTestAudio] = useState(false);
  const [showSpaceEndedModal, setShowSpaceEndedModal] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [totalGifts, setTotalGifts] = useState(0);
  const [totalGiftValue, setTotalGiftValue] = useState(0);
  const [myHostMuted, setMyHostMuted] = useState(false);
  const [myMicAllowed, setMyMicAllowed] = useState(false);
  const [showListenersModal, setShowListenersModal] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const notifiedUsersRef = useRef<Set<string>>(new Set());
  
  // Listener audio output controls
  const [isOutputMuted, setIsOutputMuted] = useState(false);
  const [useLoudspeaker, setUseLoudspeaker] = useState(true);
  const [allParticipantsMuted, setAllParticipantsMuted] = useState(false);

  const canSpeak = myRole === 'host' || myRole === 'co_host' || myRole === 'speaker';
  const isHost = space?.user_id === user?.id || myRole === 'host' || myRole === 'co_host';
  
  // Use SpaceContext for audio management - GLOBAL, persists across navigation
  const connectionStatus = spaceContext?.spaceState.connectionStatus || 'disconnected';
  const audioLevels = spaceContext?.spaceState.audioLevels || {};
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  // Update SpaceContext when space data changes
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

  // No longer need to update context connection status - it's managed in SpaceContext

  // Minimize handler
  const handleMinimize = () => {
    if (spaceContext) {
      spaceContext.minimizeSpace();
      navigate('/feed');
    }
  };

  // Explicit leave handler - this is the ONLY way to leave the space
  const handleLeaveSpace = async () => {
    if (spaceContext) {
      await spaceContext.leaveSpace();
    }
    onClose();
  };

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

  // Initialize space and set up realtime
  useEffect(() => {
    const initSpace = async () => {
      console.log('[LiveSpace] Initializing space:', spaceId);
      await fetchSpaceData();
      await fetchTotalGifts();
    };
    
    initSpace();

    // OPTIMIZED: Use single channel with instant updates - no delays
    const channel = supabase
      .channel(`space-realtime-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload: any) => {
        console.log('[LiveSpace] 🚀 NEW speaker/listener joined INSTANTLY');
        // Immediately update viewer count (optimistic)
        setSpace(prev => prev ? { ...prev, viewer_count: (prev.viewer_count || 0) + 1 } : null);
        
        // Refetch speakers for UI update
        fetchSpeakers();
        
        // Show "user joined" toast for new listeners
        const newUserId = payload.new.user_id;
        if (newUserId && newUserId !== user?.id && !notifiedUsersRef.current.has(newUserId)) {
          notifiedUsersRef.current.add(newUserId);
          
          // Fetch profile in parallel - don't block UI
          supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', newUserId)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                toast(
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium">{profile.display_name?.[0] || 'U'}</span>
                      )}
                    </div>
                    <span className="text-sm">
                      <strong>{profile.display_name || profile.username}</strong> joined the space
                    </span>
                  </div>,
                  { duration: 2000 }
                );
              }
            });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload: any) => {
        console.log('[LiveSpace] 🔄 Speaker updated INSTANTLY:', payload.new);
        // If someone left (left_at set), decrement count
        if (payload.new.left_at && !payload.old?.left_at) {
          setSpace(prev => prev ? { ...prev, viewer_count: Math.max(0, (prev.viewer_count || 1) - 1) } : null);
        }
        // Immediately refetch speakers for UI update
        fetchSpeakers();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, async () => {
        console.log('[LiveSpace] 🗑️ Speaker deleted INSTANTLY');
        setSpace(prev => prev ? { ...prev, viewer_count: Math.max(0, (prev.viewer_count || 1) - 1) } : null);
        fetchSpeakers();
      })
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
        }, 2000); // Faster cleanup for smoother animations
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_gifts',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload: any) => {
        fetchTotalGifts();
        
        // Show gift animation to everyone
        const giftData = payload.new;
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', giftData.sender_id)
          .single();
        
        const { data: receiverProfile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', giftData.receiver_id)
          .single();
        
        const giftEmojis: Record<string, string> = {
          'rose': '🌹',
          'heart': '❤️',
          'star': '⭐',
          'crown': '👑',
          'rocket': '🚀',
          'diamond': '💎',
          'fire': '🔥',
          'kiss': '💋',
          'cake': '🎂',
          'money': '💰',
        };
        
        const newGiftAnim = {
          id: giftData.id,
          emoji: giftEmojis[giftData.gift_type] || '🎁',
          senderName: senderProfile?.display_name || senderProfile?.username || 'Someone',
          receiverName: receiverProfile?.display_name || receiverProfile?.username || 'Host',
          value: giftData.credit_value || 1,
        };
        
        setGiftAnimations(prev => [...prev, newGiftAnim]);
        setTimeout(() => {
          setGiftAnimations(prev => prev.filter(g => g.id !== newGiftAnim.id));
        }, 5000);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_spaces',
        filter: `id=eq.${spaceId}`,
      }, async (payload: any) => {
        console.log('[LiveSpace] Space updated:', payload.new.status);
        // Only handle ended status if this is a genuine transition from live to ended
        if (payload.new.status === 'ended' && payload.old?.status === 'live') {
          console.log('[LiveSpace] Space ended by host - disconnecting immediately');
          // Immediately leave the space and cleanup audio
          await spaceContext?.leaveSpace();
          // Show brief notification and redirect immediately
          toast.info('Space has ended');
          navigate('/live');
          return; // Don't update state since we're navigating away
        }
        // Update space data for other updates
        if (payload.new.status === 'live') {
          setSpace(payload.new);
        }
      })
      .subscribe();

    // Also subscribe to broadcast channels for instant reactions/gifts
    const broadcastChannel = supabase
      .channel(`space-reactions-${spaceId}`)
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        // Only add if not our own (we already show optimistically)
        if (payload.payload?.user_id !== user?.id) {
          const newReaction = {
            id: `broadcast-${Date.now()}-${Math.random()}`,
            emoji: payload.payload?.emoji,
            x: Math.random() * 60 + 20,
            y: Math.random() * 20,
          };
          setReactions(prev => [...prev, newReaction]);
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 3000);
        }
      })
      .subscribe();

    // Subscribe to host control broadcasts (mute all, etc.)
    const controlChannel = supabase
      .channel(`space-control-${spaceId}`)
      .on('broadcast', { event: 'mute_all' }, (payload: any) => {
        console.log('[LiveSpace] Host muted all participants');
        // If we're not the host, mute ourselves
        if (payload.payload?.by !== user?.id) {
          setIsMuted(true);
          setMyHostMuted(true);
          // Also mute via SpaceContext
          if (spaceContext) {
            spaceContext.setMuted(true);
          }
          toast.info('You have been muted by the host');
        }
      })
      .on('broadcast', { event: 'allow_unmute' }, (payload: any) => {
        console.log('[LiveSpace] Host allowed unmuting');
        if (payload.payload?.by !== user?.id) {
          setMyHostMuted(false);
          toast.info('You can now unmute');
        }
      })
      .subscribe();

    // Subscribe to promotion notifications for this user
    let promotionChannel: ReturnType<typeof supabase.channel> | null = null;
    if (user) {
      promotionChannel = supabase
        .channel(`speaker-promotion-${user.id}`)
        .on('broadcast', { event: 'promoted-to-speaker' }, async (payload: any) => {
          console.log('[LiveSpace] Received promotion notification:', payload);
          if (payload.payload?.space_id === spaceId) {
            const newRole = payload.payload?.role || 'speaker';
            toast.success(`🎉 You've been promoted to ${newRole === 'co_host' ? 'Co-Host' : 'Speaker'}! You can now speak.`);
            
            // Update local role and enable mic
            setMyRole(newRole);
            setMyMicAllowed(true);
            setMyHostMuted(false);
            
            // Refetch speakers to update UI
            await fetchSpeakers();
            
            // Start broadcasting if not already
            if (spaceContext) {
              spaceContext.updateRole(newRole);
            }
          }
        })
        .subscribe();
    }

    return () => {
      // DON'T call leaveSpace or disconnect here - user may just be navigating away
      // Audio continues via SpaceContext. Only cleanup when user explicitly leaves.
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(controlChannel);
      if (promotionChannel) {
        supabase.removeChannel(promotionChannel);
      }
    };
  }, [spaceId, user?.id]);

  // Join space AFTER space data is loaded (so we know if we're the host)
  useEffect(() => {
    if (space && user) {
      console.log('[LiveSpace] Space loaded, joining as user:', user.id, 'Space owner:', space.user_id);
      joinSpace();
    }
  }, [space?.id, user?.id]);

  // Audio connection now happens directly in joinSpace - no separate useEffect needed

  const fetchSpaceData = async () => {
    console.log('[LiveSpace] Fetching space data for:', spaceId);
    const { data, error } = await supabase
      .from('live_spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (error) {
      console.error('[LiveSpace] Error fetching space:', error);
      toast.error('Failed to load space');
      return;
    }
    
    if (data) {
      console.log('[LiveSpace] Space data loaded:', data.title, 'Status:', data.status, 'Owner:', data.user_id);
      
      // Check if space has actually ended
      if (data.status === 'ended') {
        console.log('[LiveSpace] Space is ended, redirecting...');
        toast.info('This space has ended');
        navigate('/live');
        return;
      }
      
      setSpace(data);
    }
  };

  const fetchSpeakers = async () => {
    console.log('[LiveSpace] Fetching speakers for space:', spaceId);
    const { data: speakersData, error } = await supabase
      .from('live_space_speakers')
      .select('*')
      .eq('space_id', spaceId)
      .is('left_at', null);

    if (error) {
      console.error('[LiveSpace] Error fetching speakers:', error);
      return;
    }

    console.log('[LiveSpace] Found speakers:', speakersData?.length || 0);

    // Get user IDs including the space owner as fallback
    let userIds = speakersData?.map(s => s.user_id) || [];
    
    // Ensure host is included even if not in speakers table yet
    if (space?.user_id && !userIds.includes(space.user_id)) {
      userIds.push(space.user_id);
    }

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      let enrichedSpeakers: Speaker[] = (speakersData || []).map(s => ({
        ...s,
        profile: profileMap.get(s.user_id),
      }));

      // Add host as fallback if not in speakers list
      if (space?.user_id) {
        const hostInSpeakers = enrichedSpeakers.find(s => s.user_id === space.user_id);
        if (!hostInSpeakers) {
          console.log('[LiveSpace] Host not in speakers, adding fallback');
          enrichedSpeakers.unshift({
            id: `fallback-${space.user_id}`,
            user_id: space.user_id,
            role: 'host',
            is_muted: false,
            has_raised_hand: false,
            host_muted: false,
            mic_allowed: true,
            hand_raised_at: null,
            joined_at: new Date().toISOString(),
            left_at: null,
            space_id: spaceId,
            profile: profileMap.get(space.user_id),
          });
        }
      }

      console.log('[LiveSpace] Enriched speakers:', enrichedSpeakers.map(s => ({ 
        user_id: s.user_id, 
        role: s.role, 
        name: s.profile?.display_name 
      })));

      setSpeakers(enrichedSpeakers);

      // Determine my role
      const mySpeaker = enrichedSpeakers.find(s => s.user_id === user?.id);
      if (mySpeaker) {
        console.log('[LiveSpace] My role from speakers:', mySpeaker.role);
        const previousRole = myRole;
        setMyRole(mySpeaker.role);
        setIsMuted(mySpeaker.is_muted);
        setHasRaisedHand(mySpeaker.has_raised_hand);
        setMyHostMuted(mySpeaker.host_muted || false);
        setMyMicAllowed(mySpeaker.mic_allowed !== false);
        
        // If role changed and we have SpaceContext, update it (this triggers broadcasting for new speakers)
        if (spaceContext && mySpeaker.role !== previousRole) {
          console.log('[LiveSpace] Role changed from', previousRole, 'to', mySpeaker.role);
          spaceContext.updateRole(mySpeaker.role);
        }
      } else if (user?.id === space?.user_id) {
        // I'm the owner but not in speakers list yet - set as host
        console.log('[LiveSpace] I am the space owner, setting role to host');
        setMyRole('host');
      }
    } else {
      // No speakers yet, check if I'm the host
      if (user?.id === space?.user_id) {
        console.log('[LiveSpace] No speakers yet, but I am the owner');
        setMyRole('host');
      }
    }
  };

  const fetchTotalGifts = async () => {
    const { data, count } = await supabase
      .from('live_space_gifts')
      .select('credit_value', { count: 'exact' })
      .eq('space_id', spaceId);
    
    setTotalGifts(count || 0);
    const total = data?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
    setTotalGiftValue(total);
  };

  const joinSpace = async (retryCount = 0) => {
    if (!user || !space) {
      console.log('[LiveSpace] Cannot join - no user or space data');
      return;
    }

    // Check if space is actually live
    if (space.status !== 'live') {
      toast.error('This space is not currently live');
      return;
    }

    console.log('[LiveSpace] Joining space as:', user.id, 'Space owner:', space.user_id);
    const isOwner = space.user_id === user.id;
    const role = isOwner ? 'host' : 'listener';
    
    // Set role immediately to avoid race conditions
    setMyRole(role);
    if (isOwner) {
      setIsMuted(false); // Host starts unmuted
    }

    try {
      // Clear any existing record for this user (simpler than upsert)
      await supabase
        .from('live_space_speakers')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', user.id);

      // Insert fresh record
      const { error: insertError } = await supabase
        .from('live_space_speakers')
        .insert({
          space_id: spaceId,
        user_id: user.id,
          role: role,
          is_muted: !isOwner, // Host starts unmuted
          host_muted: false,
          mic_allowed: isOwner, // Only host has mic permission by default, listeners need to raise hand
          left_at: null,
          joined_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[LiveSpace] Error inserting speaker:', insertError);
        throw insertError;
      }

      // Update viewer count
      const { data: currentSpace } = await supabase
        .from('live_spaces')
        .select('viewer_count')
        .eq('id', spaceId)
        .single();
      
      await supabase
        .from('live_spaces')
        .update({ viewer_count: (currentSpace?.viewer_count || 0) + 1 })
        .eq('id', spaceId);

      // Refetch speakers to update UI
      await fetchSpeakers();
      
      // Connect audio immediately after joining
      if (spaceContext) {
        spaceContext.updateRole(role);
        spaceContext.connectAudio(role);
      }
      
      toast.success('Joined space successfully!');
    } catch (error: any) {
      console.error('[LiveSpace] Join error:', error);
      
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[LiveSpace] Retrying join in ${delay}ms (attempt ${retryCount + 1}/3)`);
        toast.info(`Connecting to space... (attempt ${retryCount + 1}/3)`);
        setTimeout(() => joinSpace(retryCount + 1), delay);
      } else {
        toast.error(`Failed to join space: ${error.message || 'Unknown error'}`);
      }
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
    if (!user) return;
    
    // Check permissions based on role - listeners can speak if mic_allowed OR allow_mic_for_all
    const listenerCanSpeak = myRole === 'listener' && (space?.allow_mic_for_all || myMicAllowed) && !myHostMuted;
    const canToggle = canSpeak || listenerCanSpeak;
    
    if (!canToggle) {
      if (myRole === 'listener') {
        toast.error('Raise your hand to request speaking permission');
      }
      return;
    }

    // Check if host has muted us - can't unmute
    if (myHostMuted && isMuted) {
      toast.error('Host has muted you. Only the host can unmute you.');
      return;
    }

    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    
    // Update SpaceContext mute state for global audio control
    if (spaceContext) {
      spaceContext.setMuted(newMuteState);
    }
    
    // If listener is unmuting for first time, need to start broadcasting
    if (!newMuteState && listenerCanSpeak && spaceContext) {
      console.log('[LiveSpace] Listener unmuting - starting broadcast');
      await spaceContext.startListenerBroadcast();
    }

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

  // Toggle mute/unmute all participants
  const toggleMuteAllParticipants = async () => {
    if (!isHost) return;
    
    const shouldMute = !allParticipantsMuted;
    
    if (shouldMute) {
      // Mute all speakers (except host)
      const { error } = await supabase
        .from('live_space_speakers')
        .update({ 
          is_muted: true, 
          host_muted: true 
        })
        .eq('space_id', spaceId)
        .neq('user_id', user?.id);
      
      if (error) {
        console.error('[LiveSpace] Failed to mute all:', error);
        toast.error('Failed to mute all');
        return;
      }
      
      // Broadcast mute-all event for immediate effect
      const channel = supabase.channel(`space-control-${spaceId}`);
      await channel.send({
        type: 'broadcast',
        event: 'mute_all',
        payload: { by: user?.id },
      });
      supabase.removeChannel(channel);
      
      setAllParticipantsMuted(true);
      toast.success('All participants muted');
    } else {
      // Allow all to unmute (removes host_muted restriction)
      const { error } = await supabase
        .from('live_space_speakers')
        .update({ host_muted: false })
        .eq('space_id', spaceId);
      
      if (error) {
        console.error('[LiveSpace] Failed to allow unmute:', error);
        toast.error('Failed to allow unmute');
        return;
      }
      
      // Broadcast unmute permission
      const channel = supabase.channel(`space-control-${spaceId}`);
      await channel.send({
        type: 'broadcast',
        event: 'allow_unmute',
        payload: { by: user?.id },
      });
      supabase.removeChannel(channel);
      
      setAllParticipantsMuted(false);
      toast.success('All participants can now unmute');
    }
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

    toast.success(newHandState ? '✋ Hand raised! The host can see your request.' : 'Hand lowered');
  };

  const sendReaction = async (emoji: string) => {
    if (!user) return;

    // Optimistic UI - show reaction immediately
    const optimisticReaction = {
      id: `optimistic-${Date.now()}`,
      emoji,
      x: Math.random() * 60 + 20,
      y: Math.random() * 20,
    };
    setReactions(prev => [...prev, optimisticReaction]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== optimisticReaction.id));
    }, 3000);

    try {
      // Insert reaction to database (triggers realtime for all users)
      const { error } = await supabase.from('live_space_reactions').insert({
        space_id: spaceId,
        user_id: user.id,
        reaction_type: emoji,
      });
      
      if (error) {
        console.error('[LiveSpace] Failed to send reaction:', error);
      }
      
      // Also broadcast for instant delivery
      const broadcastChannel = supabase.channel(`space-reactions-${spaceId}`);
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji, user_id: user.id },
      });
      supabase.removeChannel(broadcastChannel);
    } catch (error) {
      console.error('[LiveSpace] Error sending reaction:', error);
    }
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

  // Screen sharing - host only
  const startScreenShare = async () => {
    if (!isHost) {
      toast.error('Only hosts can share screen');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      toast.success('Screen sharing started');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        toast.error('Failed to start screen sharing');
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    toast.success('Screen sharing stopped');
  };

  // Attach screen stream to video element
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const promoteSpeaker = async (speakerId: string, newRole: 'speaker' | 'co_host') => {
    // First get the user_id of the speaker being promoted
    const speakerRecord = speakers.find(s => s.id === speakerId);
    if (!speakerRecord) {
      toast.error('Could not find speaker');
      return;
    }

    await supabase
      .from('live_space_speakers')
      .update({ role: newRole, has_raised_hand: false, mic_allowed: true, host_muted: false })
      .eq('id', speakerId);
    
    // Broadcast promotion notification to the specific user
    const promotionChannel = supabase.channel(`speaker-promotion-${speakerRecord.user_id}`);
    await promotionChannel.send({
      type: 'broadcast',
      event: 'promoted-to-speaker',
      payload: { 
        space_id: spaceId, 
        role: newRole,
        by: user?.id,
      },
    });
    supabase.removeChannel(promotionChannel);
    
    // Refetch speakers immediately to update UI
    await fetchSpeakers();
    
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
            Connected (SFU)
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

      {/* Gift animations - TikTok style notifications */}
      <AnimatePresence>
        {giftAnimations.map((gift) => (
          <motion.div
            key={gift.id}
            initial={{ opacity: 0, x: -100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute left-4 top-1/3 z-50 max-w-[280px]"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-pink-500/90 backdrop-blur-sm shadow-lg">
              <motion.span 
                className="text-3xl"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
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

      {/* Screen Share Display - visible to all when host is sharing */}
      <AnimatePresence>
        {isScreenSharing && screenStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-x-4 top-20 bottom-64 z-30 rounded-2xl overflow-hidden bg-black shadow-2xl border border-primary/30"
          >
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge className="bg-red-500/90 text-white border-0 gap-1.5">
                <Monitor className="w-3 h-3" />
                Screen Sharing
              </Badge>
            </div>
            {isHost && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-4 right-4"
                onClick={stopScreenShare}
              >
                <MonitorOff className="w-4 h-4 mr-1" />
                Stop Sharing
              </Button>
            )}
          </motion.div>
        )}
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
                <ListenersModal 
                  listeners={listeners}
                  totalCount={listeners.length}
                  isHost={isHost}
                  onPromote={(speakerId) => promoteSpeaker(speakerId, 'speaker')}
                />
                {/* TikTok-style gift counter */}
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-500/30 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setShowGiftModal(true)}
                >
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-semibold text-xs">{totalGiftValue.toLocaleString()}</span>
                  {totalGifts > 0 && (
                    <span className="text-muted-foreground text-[10px]">({totalGifts})</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full" 
                onClick={handleMinimize}
                title="Go back - audio continues in background"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Host Controls Bar */}
          {isHost && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20">
              <div className="flex items-center gap-2 shrink-0">
                <Switch 
                  checked={space?.allow_mic_for_all !== false}
                  onCheckedChange={toggleMicForAll}
                  id="mic-for-all"
                  className="scale-90"
                />
                <label htmlFor="mic-for-all" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                  Allow Mic for All
                </label>
              </div>
              
              <div className="h-6 w-px bg-border shrink-0" />
              
              <Button 
                size="sm" 
                variant={allParticipantsMuted ? "outline" : "destructive"}
                className="h-8 gap-1.5"
                onClick={toggleMuteAllParticipants}
              >
                {allParticipantsMuted ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Unmute All</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mute All</span>
                  </>
                )}
              </Button>
              
              <div className="h-6 w-px bg-border shrink-0 hidden sm:block" />
              
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 ml-auto hidden sm:flex"
                onClick={() => setShowSpeakerQueue(true)}
              >
                <Hand className="w-3.5 h-3.5" />
                Queue
                {raisedHands.length > 0 && (
                  <Badge className="h-5 w-5 p-0 justify-center bg-amber-500 text-white">
                    {raisedHands.length}
                  </Badge>
                )}
              </Button>
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
                <SpeakerAvatarWithWaves
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
                  onProfileClick={() => navigate(`/profile/${speaker.user_id}`)}
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
                  <SpeakerAvatarWithWaves
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
                    onProfileClick={() => navigate(`/profile/${speaker.user_id}`)}
                    size="md"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Raised hands - visible to ALL users */}
          {raisedHands.length > 0 && (
            <section className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Requesting to Speak</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border-0">{raisedHands.length}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {raisedHands.map((speaker) => (
                  <div key={speaker.id} className="flex items-center justify-between p-2 rounded-xl bg-background/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 ring-2 ring-amber-400">
                        <AvatarImage src={speaker.profile?.avatar_url || ''} />
                        <AvatarFallback>{speaker.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{speaker.profile?.display_name}</span>
                        <span className="text-xs text-muted-foreground">wants to speak</span>
                      </div>
                    </div>
                    {/* Only hosts can promote speakers */}
                    {isHost ? (
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
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        ✋ Waiting
                      </Badge>
                    )}
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
                  <Avatar 
                    className={cn(
                      "w-12 h-12 ring-2 transition-all cursor-pointer",
                      listener.has_raised_hand ? "ring-amber-400 animate-bounce" : "ring-transparent hover:ring-primary/50"
                    )}
                    onClick={() => navigate(`/profile/${listener.user_id}`)}
                  >
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
          {/* Leave/End button - only hosts see "End Space" */}
          <Button 
            variant={isHost ? "destructive" : "outline"} 
            onClick={isHost ? () => setShowEndConfirm(true) : handleLeaveSpace}
            className={cn(
              "flex-1 h-12 rounded-xl font-semibold",
              isHost && "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            )}
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            {isHost ? 'End Space' : 'Leave'}
          </Button>

          {/* Action buttons - visible to ALL users */}
          <div className="flex gap-2">
            {/* Mic button - for everyone with mic permission */}
            {(canSpeak || (myRole === 'listener' && (space?.allow_mic_for_all || myMicAllowed) && !myHostMuted)) && (
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
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  {myHostMuted && (
                    <Shield className="absolute -top-1 -right-1 w-4 h-4 text-red-500" />
                  )}
                </Button>
              </motion.div>
            )}

            {/* Raise hand - visible to all listeners to request speaking */}
            {myRole === 'listener' && (
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant={hasRaisedHand ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-xl",
                    hasRaisedHand && "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0"
                  )}
                  onClick={toggleRaiseHand}
                  title={hasRaisedHand ? "Lower hand" : "Raise hand to speak"}
                >
                  <Hand className={cn("w-5 h-5", hasRaisedHand && "animate-pulse")} />
                </Button>
              </motion.div>
            )}

            {/* Test Audio - visible to anyone who can speak */}
            {(canSpeak || (myRole === 'listener' && (space?.allow_mic_for_all || myMicAllowed))) && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-xl"
                onClick={() => setShowTestAudio(true)}
                title="Test Microphone"
              >
                <AudioLines className="w-5 h-5" />
              </Button>
            )}

            {/* Chat - visible to ALL */}
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-xl"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="w-5 h-5" />
            </Button>

            {/* Gift - visible to ALL */}
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

            {/* Listener Audio Output Controls - visible to ALL for controlling their playback */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant={isOutputMuted ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-xl transition-all",
                  isOutputMuted && "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0"
                )}
                onClick={() => {
                  setIsOutputMuted(!isOutputMuted);
                  // Mute/unmute all remote audio elements
                  document.querySelectorAll<HTMLAudioElement>('[id^="audio-"], [id^="sfu-audio-"]').forEach(audio => {
                    audio.muted = !isOutputMuted;
                  });
                  toast(isOutputMuted ? 'Speaker unmuted' : 'Speaker muted');
                }}
                title={isOutputMuted ? "Unmute speaker" : "Mute speaker"}
              >
                {isOutputMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </motion.div>

            {/* Toggle Loudspeaker/Earpiece */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant={useLoudspeaker ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-xl transition-all",
                  useLoudspeaker && "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 border-0"
                )}
                onClick={async () => {
                  const newValue = !useLoudspeaker;
                  setUseLoudspeaker(newValue);
                  
                  // Try to use setSinkId API if available (Chrome, Edge)
                  const audioElements = document.querySelectorAll<HTMLAudioElement>('[id^="audio-"], [id^="sfu-audio-"]');
                  
                  if (audioElements.length > 0 && 'setSinkId' in audioElements[0]) {
                    try {
                      // Get available audio output devices
                      const devices = await navigator.mediaDevices.enumerateDevices();
                      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                      
                      // Find earpiece or speaker device
                      const targetDevice = audioOutputs.find(d => 
                        newValue 
                          ? d.label.toLowerCase().includes('speaker') || d.deviceId === 'default'
                          : d.label.toLowerCase().includes('earpiece') || d.label.toLowerCase().includes('phone')
                      );
                      
                      if (targetDevice) {
                        for (const audio of audioElements) {
                          await (audio as any).setSinkId(targetDevice.deviceId);
                        }
                        toast(newValue ? 'Using loudspeaker' : 'Using earpiece');
                      } else {
                        toast(newValue ? 'Loudspeaker active' : 'Earpiece mode (if available)');
                      }
                    } catch (error) {
                      console.log('[LiveSpace] setSinkId not fully supported:', error);
                      toast(newValue ? 'Loudspeaker active' : 'Earpiece mode');
                    }
                  } else {
                    toast(newValue ? 'Loudspeaker active' : 'Earpiece mode');
                  }
                }}
                title={useLoudspeaker ? "Switch to earpiece" : "Switch to loudspeaker"}
              >
                <Speaker className="w-5 h-5" />
              </Button>
            </motion.div>

            {/* Screen Share & Invite - only for hosts */}
            {isHost && (
              <>
                <Button 
                  variant={isScreenSharing ? "default" : "outline"}
                  size="icon" 
                  className={cn(
                    "h-12 w-12 rounded-xl",
                    isScreenSharing && "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 border-0"
                  )}
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  title={isScreenSharing ? "Stop sharing" : "Share screen"}
                >
                  {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl"
                  onClick={() => setShowInviteModal(true)}
                >
                  <UserPlus className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel - slides from bottom, semi-transparent so users can see reactions */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-x-0 bottom-0 h-[60vh] bg-background/95 backdrop-blur-lg border-t border-border z-40 rounded-t-3xl"
          >
            <SpaceChat spaceId={spaceId} onClose={() => setShowChat(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <TestAudioModal
        isOpen={showTestAudio}
        onClose={() => setShowTestAudio(false)}
      />

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
        isSpace={true}
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

      {/* Space Ended Modal - shown to all users when host ends the space */}
      <AlertDialog open={showSpaceEndedModal}>
        <AlertDialogContent className="text-center">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Space Ended</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              The host has ended this space. You will be redirected to the Live page in a moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-center py-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center animate-pulse">
              <Radio className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
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
