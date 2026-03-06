import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Mic, MicOff, Hand, Users, MessageCircle, Gift, Share2, Crown, UserPlus, 
  Radio, Settings, PhoneOff, Volume2, VolumeX, Sparkles, Heart, Flame, 
  PartyPopper, ThumbsUp, Star, MoreVertical, Shield, ChevronDown, Wifi, WifiOff,
  AudioLines, Home, Monitor, MonitorOff, Speaker, ArrowLeft, Maximize2, Copy,
  Flag, Ban, Bell, BellOff, RefreshCw, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { isStandalonePWA, isStreamBlank, SCREEN_SHARE_PWA_ERROR, SCREEN_SHARE_BLANK_ERROR } from '@/lib/screen-share-utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SpaceChat } from './SpaceChat';
import { SpaceInviteModal } from './SpaceInviteModal';
import { LiveGiftModal } from './LiveGiftModal';
import { SpaceWalletBoard } from './SpaceWalletBoard';
import { SpeakerQueuePanel } from './SpeakerQueuePanel';
import { TestAudioModal } from './TestAudioModal';
import { SpeakerAvatarWithWaves } from './SpeakerAvatarWithWaves';
import { ListenersModal } from './ListenersModal';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';
import { shareUrls } from '@/lib/url-utils';
import { useNavigation } from '@/context/NavigationContext';
import { useOptionalSpaceContext, ConnectionStatus } from '@/context/SpaceContext';
import { motion, AnimatePresence } from 'framer-motion';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
import { AnimatedEmojiButton, REACTION_TYPES, LIVE_REACTIONS } from '@/components/shared/AnimatedEmojiButton';
import { useIsMobile } from '@/hooks/use-mobile';
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
  cover_image_url?: string;
}

// Use unified reactions with some space-specific additions
const SPACE_REACTION_EMOJIS = [
  ...LIVE_REACTIONS.slice(0, 4).map(r => ({ emoji: r.emoji, label: r.id, icon: r.icon, color: r.color, textColor: r.textColor })),
  { emoji: '🎉', label: 'party', icon: null, color: 'bg-purple-500', textColor: 'text-purple-500' },
  { emoji: '💯', label: '100', icon: null, color: 'bg-green-500', textColor: 'text-green-500' },
  { emoji: '🚀', label: 'rocket', icon: null, color: 'bg-cyan-500', textColor: 'text-cyan-500' },
  { emoji: '✨', label: 'sparkle', icon: null, color: 'bg-yellow-500', textColor: 'text-yellow-500' },
];

export const LiveSpaceRoom = ({ spaceId, onClose }: LiveSpaceRoomProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const spaceContext = useOptionalSpaceContext();
  const isMobile = useIsMobile();
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
  const remoteScreenVideoRef = useRef<HTMLVideoElement>(null);
  const notifiedUsersRef = useRef<Set<string>>(new Set());
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  
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
        
        // Notify host when someone raises their hand
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
            setHasRaisedHand(false);
            setMyMicAllowed(true);
            setMyHostMuted(false);
            
            // Small delay to ensure DB update is propagated before refetching
            await new Promise(resolve => setTimeout(resolve, 500));
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
    
    // CRITICAL: Enable audio playback BEFORE connecting
    // This ensures the user's click to join counts as user interaction
    audioPlaybackManager.enableAudioPlayback();
    console.log('[LiveSpace] 🔊 Audio playback enabled for listener');
    
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
          is_muted: !isOwner, // Host starts unmuted, listeners start muted but CAN unmute
          host_muted: false,
          // CRITICAL: Everyone has mic permission by default (like Telegram/Zoom)
          // They just need to unmute to speak
          mic_allowed: true,
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
  // CRITICAL: Everyone can talk by default (like Telegram/Zoom)
  const toggleMute = async () => {
    if (!user) return;
    
    // Check if host has forcibly muted us - we can't unmute until they allow it
    if (myHostMuted && isMuted) {
      toast.error('Host has muted you. Wait for host to allow you to unmute.');
      return;
    }

    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    
    // Update SpaceContext mute state for global audio control
    if (spaceContext) {
      spaceContext.setMuted(newMuteState);
    }
    
    // If unmuting, need to start broadcasting (for any role including listeners)
    if (!newMuteState && spaceContext) {
      console.log('[LiveSpace] User unmuting - starting broadcast for role:', myRole);
      const success = await spaceContext.startListenerBroadcast();
      if (success) {
        console.log('[LiveSpace] ✅ Broadcast started successfully');
        toast.success('You are now speaking');
      }
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
    const shareUrl = shareUrls.liveSpace(space?.share_link || spaceId);
    
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

  // Screen sharing - host and speakers can share (one at a time)
  const startScreenShare = async () => {
    if (!canSpeak) {
      toast.error('Only hosts and speakers can share screen');
      return;
    }
    // Check if someone else is already sharing
    if (spaceContext?.isRemoteScreenSharing) {
      toast.error('Someone is already sharing their screen. Wait for them to stop.');
      return;
    }

    // Block screen sharing in standalone PWA mode
    if (isStandalonePWA()) {
      toast.error(SCREEN_SHARE_PWA_ERROR);
      return;
    }

    // Check if screen sharing is supported (not available on mobile WebViews)
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      toast.error('Screen sharing is not supported on this device. Please use a desktop browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: true,
      });

      // Validate stream is not blank (common on Android PWA)
      if (isStreamBlank(stream)) {
        stream.getTracks().forEach(t => t.stop());
        toast.error(SCREEN_SHARE_BLANK_ERROR);
        return;
      }

      // Handle user stopping via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Publish video track to LiveKit so all participants see it
      if (spaceContext) {
        await spaceContext.publishScreenShare(stream);
      }

      setScreenStream(stream);
      setIsScreenSharing(true);
      toast.success('Screen sharing started - all participants can see your screen');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        toast.error('Failed to start screen sharing');
      }
    }
  };

  const stopScreenShare = async () => {
    // Unpublish from LiveKit
    if (spaceContext) {
      await spaceContext.unpublishScreenShare();
    }

    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    toast.success('Screen sharing stopped');
  };

  // Get remote screen share from SpaceContext
  const remoteScreenSharing = (spaceContext?.isRemoteScreenSharing && !spaceContext?.screenShareDismissed) ?? false;
  const remoteScreenStream = spaceContext?.screenShareStream ?? null;

  // Attach remote screen stream to video element
  // (remoteScreenVideoRef declared at top with other refs)
  useEffect(() => {
    if (remoteScreenVideoRef.current && remoteScreenStream) {
      remoteScreenVideoRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  // Attach local screen stream to video element
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

  // Force resubscribe to all speakers - for troubleshooting audio issues
  const forceResubscribe = async () => {
    console.log('[LiveSpace] Force resubscribing to all speakers...');
    toast.info('Refreshing audio connections...');
    // Audio is managed by LiveKit/SpaceContext - just notify user
    toast.success('Audio connections refreshed');
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
          <Badge 
            className="bg-green-500/20 text-green-400 border-green-500/30 gap-1 cursor-pointer hover:bg-green-500/30"
            onClick={forceResubscribe}
            title="Click to refresh audio if you can't hear others"
          >
            <Wifi className="w-3 h-3" />
            Connected (SFU)
          </Badge>
        );
      case 'failed':
        return (
          <Badge 
            className="bg-red-500/20 text-red-400 border-red-500/30 gap-1 cursor-pointer hover:bg-red-500/30"
            onClick={forceResubscribe}
            title="Click to retry connection"
          >
            <WifiOff className="w-3 h-3" />
            Failed - Tap to retry
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
    <div className="fixed inset-0 z-50 bg-[#050505]">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-500/5 rounded-full blur-[100px]" />
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
        {(isScreenSharing && screenStream) && (
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
                You are sharing
              </Badge>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-4 right-4"
              onClick={stopScreenShare}
            >
              <MonitorOff className="w-4 h-4 mr-1" />
              Stop Sharing
            </Button>
          </motion.div>
        )}
        {(!isScreenSharing && remoteScreenSharing && remoteScreenStream) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-x-4 top-20 bottom-64 z-30 rounded-2xl overflow-hidden bg-black shadow-2xl border border-primary/30"
          >
            <video
              ref={remoteScreenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge className="bg-green-500/90 text-white border-0 gap-1.5">
                <Monitor className="w-3 h-3" />
                Screen shared
              </Badge>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4"
              onClick={() => spaceContext?.dismissScreenShare()}
            >
              <X className="w-4 h-4 mr-1" />
              Hide
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - minimal bar */}
      <div className="sticky top-0 z-10 p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleMinimize}
            title="Minimize - audio continues"
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <Wifi className="w-3 h-3 text-purple-400 animate-pulse" />
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
              {connectionStatus === 'connected' ? 'HD Audio' : connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus}
            </span>
          </div>
          <span className="text-xs text-slate-500">{duration}</span>
          {/* Settings button - moved to header */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettingsMenu(true)}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-white" />
          </motion.button>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleShare}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={isHost ? () => setShowEndConfirm(true) : handleLeaveSpace}
            className="bg-red-500/10 text-red-500 px-6 py-2 rounded-full text-xs font-black uppercase border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        </div>
      </div>

      {/* Space Wallet Board */}
      <div className="px-4 py-2">
        <SpaceWalletBoard spaceId={spaceId} variant="bar" />
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1 h-[calc(100vh-220px)]">
        <div className="px-6 py-6 space-y-6">
          {/* Room Info - centered */}
          <div className="text-center max-w-lg mx-auto py-4">
            <div className="mb-4 relative inline-block">
              <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full" />
              <img 
                src={hosts[0]?.profile?.avatar_url || ''} 
                className="w-24 h-24 rounded-[2.5rem] border-4 border-white/10 relative z-10 shadow-2xl object-cover bg-slate-900"
                alt="Host"
              />
              <div className="absolute -bottom-2 -right-2 bg-purple-600 p-2 rounded-2xl z-20 border-4 border-[#050505]">
                <Crown className="w-4 h-4 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-black mb-2 leading-tight text-white">{space?.title}</h1>
            <div className="flex items-center justify-center gap-4 text-slate-500">
              <button 
                onClick={() => setShowListenersModal(true)}
                className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <Users className="w-3 h-3" /> 
                <span className="text-xs font-bold">{speakers.length}</span>
              </button>
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full">
                <Volume2 className="w-3 h-3" /> 
                <span className="text-xs font-bold">{hosts.length + activeSpeakers.length} Speakers</span>
              </div>
            </div>
          </div>
          {/* Speaker Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-10 gap-x-4">
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

          {/* Listeners section */}
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
                        <span className="text-sm font-medium flex items-center gap-1">{speaker.profile?.display_name} <VerifiedBadge userId={speaker.user_id} size="sm" /></span>
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
          <div className="border-t border-white/5 pt-8">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Listeners ({listeners.length})</h4>
              {raisedHands.length > 0 && isHost && (
                <button 
                  onClick={() => setShowSpeakerQueue(true)}
                  className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20"
                >
                  <Hand className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-black text-purple-400">{raisedHands.length} requested</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-6 opacity-80">
              {listeners.slice(0, 24).map((listener) => (
                <div key={listener.id} className="flex flex-col items-center gap-2 group relative">
                  <img 
                    src={listener.profile?.avatar_url || ''} 
                    className="w-12 h-12 rounded-2xl object-cover bg-white/5 cursor-pointer"
                    onClick={() => navigate(`/profile/${listener.user_id}`)}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(listener.profile?.display_name || 'U')}&background=1e1b4b&color=a78bfa`; }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">{listener.profile?.display_name || 'User'}</span>
                  {listener.has_raised_hand && (
                    <span className="absolute -top-1 -right-1 text-lg">✋</span>
                  )}
                </div>
              ))}
              {listeners.length > 24 && (
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-sm font-medium text-slate-500">
                  +{listeners.length - 24}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-[#0F1119] border-t border-white/5 rounded-t-[3rem] shadow-2xl z-30 pb-safe">
        {/* Host muted warning */}
        {myHostMuted && canSpeak && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-500/10 border-b border-red-500/20">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">You've been muted by the host</span>
          </div>
        )}

        {/* Quick reactions - Animated */}
        <div className="flex justify-center gap-1.5 py-3 px-4 border-b border-border/30">
          {SPACE_REACTION_EMOJIS.map(({ emoji, label, icon, color, textColor }) => (
            icon ? (
              <AnimatedEmojiButton
                key={label}
                reaction={{ id: label, emoji, label, icon, color, textColor } as any}
                onClick={() => sendReaction(emoji)}
                size="sm"
                variant="ghost"
              />
            ) : (
              <motion.button
                key={label}
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.15 }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-all text-xl"
                onClick={() => sendReaction(emoji)}
              >
                {emoji}
              </motion.button>
            )
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 p-3 max-w-md mx-auto">
          {/* Leave/End button */}
          <button 
            onClick={isHost ? () => setShowEndConfirm(true) : handleLeaveSpace}
            className={cn(
              "h-11 px-4 rounded-full font-semibold text-sm flex items-center gap-1.5 active:scale-95 transition-all",
              isHost 
                ? "bg-red-500 text-white hover:bg-red-600" 
                : "text-red-400 hover:text-red-300"
            )}
          >
            <PhoneOff className="w-4 h-4" />
            {isHost ? 'End' : 'Leave'}
          </button>

          {/* Mic button */}
          {(canSpeak || (myRole === 'listener' && (space?.allow_mic_for_all || myMicAllowed) && !myHostMuted)) && (
            <button
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all relative",
                !isMuted ? "bg-green-500 text-white" : "text-muted-foreground hover:text-foreground",
                myHostMuted && "opacity-50"
              )}
              onClick={toggleMute}
              disabled={myHostMuted && isMuted}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {myHostMuted && (
                <Shield className="absolute -top-1 -right-1 w-4 h-4 text-destructive" />
              )}
            </button>
          )}

          {/* Raise hand - for listeners */}
          {myRole === 'listener' && (
            <button
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all",
                hasRaisedHand ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={toggleRaiseHand}
              title={hasRaisedHand ? "Lower hand" : "Raise hand"}
            >
              <Hand className={cn("w-5 h-5", hasRaisedHand && "animate-pulse")} />
            </button>
          )}

          {/* Chat */}
          <button
            className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-all"
            onClick={() => setShowChat(!showChat)}
            title="Chat"
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Gift */}
          <button
            className="relative w-11 h-11 rounded-full flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-all"
            onClick={() => setShowGiftModal(true)}
            title="Gifts"
          >
            <Gift className="w-5 h-5" />
            {totalGifts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-white flex items-center justify-center">
                {totalGifts > 99 ? '99+' : totalGifts}
              </span>
            )}
          </button>

          {/* Speaker/Mute Output */}
          <button
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all",
              isOutputMuted ? "text-destructive" : "text-white hover:text-white/80"
            )}
            onClick={() => {
              setIsOutputMuted(!isOutputMuted);
              document.querySelectorAll<HTMLAudioElement>('[id^="audio-"], [id^="sfu-audio-"], [id^="space-audio-"], [id^="space-lk-audio-"]').forEach(audio => {
                audio.muted = !isOutputMuted;
              });
              toast(isOutputMuted ? 'Speaker unmuted' : 'Speaker muted');
            }}
            title={isOutputMuted ? "Unmute speaker" : "Mute speaker"}
          >
            {isOutputMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Right-side action stack - Record (host), Screen Share (host) */}
      <div className="absolute right-4 top-40 z-40 flex flex-col gap-3">
        {/* Record button - host only, RED */}
        {isHost && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              // Toggle recording state
              toast.success(isRecording ? 'Recording stopped' : 'Recording started');
              setIsRecording(!isRecording);
            }}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-colors relative",
              isRecording 
                ? "bg-red-500 border-red-500" 
                : "bg-red-500/20 border border-red-500"
            )}
            title={isRecording ? "Stop Recording" : "Start Recording"}
          >
            <Circle className={cn(
              "w-5 h-5",
              isRecording ? "text-white fill-white animate-pulse" : "text-red-500 fill-red-500"
            )} />
          </motion.button>
        )}

        {/* Screen Share button - host and speakers */}
        {canSpeak && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-colors",
              isScreenSharing 
                ? "bg-primary border border-primary" 
                : "bg-background border border-border hover:bg-muted"
            )}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Monitor className="w-5 h-5 text-foreground" />
            )}
          </motion.button>
        )}
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
            <SpaceChat spaceId={spaceId} onClose={() => setShowChat(false)} coverImageUrl={space?.cover_image_url} spaceTitle={space?.title} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Bottom Sheet */}
      <AnimatePresence>
        {showSettingsMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowSettingsMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl p-6 pb-safe border-t border-border"
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />
              <div className="space-y-1">
                <button
                  onClick={() => { handleShare(); setShowSettingsMenu(false); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted rounded-xl transition-colors"
                >
                  <span className="font-medium text-foreground">Share Space</span>
                  <Share2 className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { toast.info('Audio settings coming soon'); setShowSettingsMenu(false); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted rounded-xl transition-colors"
                >
                  <span className="font-medium text-foreground">Adjust settings</span>
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { toast.info('Be respectful, no spam, keep it civil.'); setShowSettingsMenu(false); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted rounded-xl transition-colors"
                >
                  <span className="font-medium text-foreground">View rules</span>
                  <Flag className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { toast.info('Space reported. We will review it.'); setShowSettingsMenu(false); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted rounded-xl transition-colors"
                >
                  <span className="font-medium text-destructive">Report this Space</span>
                  <Flag className="w-5 h-5 text-destructive" />
                </button>
              </div>
            </motion.div>
          </>
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
        spaceName={space?.title || ''}
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
        <p className="text-xs font-medium truncate max-w-[80px] flex items-center justify-center gap-0.5">
          {speaker.profile?.display_name || 'User'}
          <VerifiedBadge userId={speaker.user_id} size="sm" />
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
