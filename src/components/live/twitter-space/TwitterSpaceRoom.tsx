import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOptionalSpaceContext, ConnectionStatus } from '@/context/SpaceContext';
import { useNavigation } from '@/context/NavigationContext';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import { TwitterSpaceHeader } from './TwitterSpaceHeader';
import { TwitterSpaceUserGrid } from './TwitterSpaceUserGrid';
import { TwitterSpaceControls } from './TwitterSpaceControls';
import { TwitterSpaceChat } from './TwitterSpaceChat';
import { TwitterSpaceGuests } from './TwitterSpaceGuests';
import { TwitterSpaceReactionPicker } from './TwitterSpaceReactionPicker';
import { TwitterSpaceShareMenu } from './TwitterSpaceShareMenu';
import { TwitterSpaceSettingsMenu } from './TwitterSpaceSettingsMenu';
import { LiveGiftModal } from '../LiveGiftModal';
import { SpeakerQueuePanel } from '../SpeakerQueuePanel';

interface TwitterSpaceRoomProps {
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
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
}

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
  
  // Data states
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [raisedHandsCount, setRaisedHandsCount] = useState(0);
  
  // User states
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [myRole, setMyRole] = useState<string>('listener');
  const [myHostMuted, setMyHostMuted] = useState(false);
  
  const notifiedUsersRef = useRef<Set<string>>(new Set());
  
  const canSpeak = myRole === 'host' || myRole === 'co_host' || myRole === 'speaker';
  const isHost = space?.user_id === user?.id || myRole === 'host' || myRole === 'co_host';
  
  // Connection status from SpaceContext
  const connectionStatus = spaceContext?.spaceState.connectionStatus || 'disconnected';
  const audioLevels = spaceContext?.spaceState.audioLevels || {};
  const isConnected = connectionStatus === 'connected';

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
        if (payload.new.status === 'ended' && payload.old?.status === 'live') {
          await spaceContext?.leaveSpace();
          toast.info('Space has ended');
          navigate('/live');
          return;
        }
        if (payload.new.status === 'live') {
          setSpace(payload.new);
        }
      })
      .subscribe();

    // Reactions broadcast channel
    const reactionsChannel = supabase
      .channel(`space-reactions-${spaceId}`)
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        if (payload.payload?.user_id !== user?.id) {
          handleFloatingReaction(payload.payload?.emoji);
        }
      })
      .subscribe();

    // Control channel (mute all, etc.)
    const controlChannel = supabase
      .channel(`space-control-${spaceId}`)
      .on('broadcast', { event: 'mute_all' }, (payload: any) => {
        if (payload.payload?.by !== user?.id) {
          setIsMuted(true);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(controlChannel);
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
    
    // Check if already in space
    const { data: existing } = await supabase
      .from('live_space_speakers')
      .select('*')
      .eq('space_id', spaceId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (existing) {
      setMyRole(existing.role);
      setIsMuted(existing.is_muted);
      return;
    }

    // Check if this user is the host
    const isSpaceHost = space?.user_id === user.id;
    const role = isSpaceHost ? 'host' : 'listener';

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

    setMyRole(role);
    setIsMuted(!isSpaceHost);

    // Connect audio
    if (spaceContext) {
      audioPlaybackManager.enableAudioPlayback();
      await spaceContext.connectAudio(role);
    }
  };

  const handleFloatingReaction = (emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingReactions(prev => [...prev, { id, emoji, left: 40 + Math.random() * 20 }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 4000);
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;
    
    // Show locally
    handleFloatingReaction(emoji);
    
    // Broadcast to others
    const channel = supabase.channel(`space-reactions-${spaceId}`);
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, user_id: user.id },
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
    
    if (myHostMuted && isMuted) {
      toast.error('Host has muted you. Wait for host to allow you to unmute.');
      return;
    }

    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    
    if (spaceContext) {
      spaceContext.setMuted(newMuteState);
    }
    
    // If unmuting, need to start broadcasting
    if (!newMuteState && spaceContext) {
      const success = await spaceContext.startListenerBroadcast();
      if (success) {
        toast.success('You are now speaking');
      }
    }

    await supabase
      .from('live_space_speakers')
      .update({ is_muted: newMuteState })
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

    toast.success(newHandState ? '✋ Hand raised!' : 'Hand lowered');
  };

  const handleMinimize = () => {
    if (spaceContext) {
      spaceContext.minimizeSpace();
      navigate('/feed');
    }
  };

  const handleLeave = async () => {
    if (isHost) {
      // End the space if host leaves
      await supabase
        .from('live_spaces')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', spaceId);
    }
    
    if (spaceContext) {
      await spaceContext.leaveSpace();
    }
    onClose();
  };

  const closeAllMenus = () => {
    setShowReactions(false);
    setShowShare(false);
    setShowSettings(false);
  };

  if (!space) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Guests overlay
  if (view === 'guests') {
    return (
      <TwitterSpaceGuests
        speakers={speakers}
        spaceId={spaceId}
        isHost={isHost}
        onClose={() => setView('main')}
        audioLevels={audioLevels}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <TwitterSpaceHeader
        onBack={handleMinimize}
        onSettings={() => setShowSettings(true)}
        onLeave={handleLeave}
        isHost={isHost}
        raisedHandsCount={raisedHandsCount}
        onViewQueue={() => setShowSpeakerQueue(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
        <h1 className="text-white text-xl font-bold text-center mb-8 max-w-[300px]">
          {space.title}
        </h1>
        
        <TwitterSpaceUserGrid
          speakers={speakers}
          audioLevels={audioLevels}
          hostId={space.user_id}
          onUserClick={(userId) => {
            // Could open user profile or gift modal
          }}
        />
      </div>

      {/* Floating Reactions */}
      <div className="fixed bottom-32 right-4 pointer-events-none">
        <AnimatePresence>
          {floatingReactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, scale: 1 }}
              animate={{ opacity: 1, y: -20, scale: 1.5 }}
              exit={{ opacity: 0, y: -500, scale: 0.8 }}
              transition={{ duration: 4, ease: "easeOut" }}
              className="absolute text-4xl"
              style={{ left: `${r.left}%` }}
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <TwitterSpaceControls
        isMicOn={!isMuted}
        onMicToggle={canSpeak ? handleToggleMute : handleRaiseHand}
        onGuestsClick={() => setView('guests')}
        onReactionsClick={() => setShowReactions(true)}
        onShareClick={() => setShowShare(true)}
        onChatClick={() => setShowChat(true)}
        unreadCount={unreadMessages}
        canSpeak={canSpeak}
        hasRaisedHand={hasRaisedHand}
        onGiftClick={() => setShowGiftModal(true)}
        isHost={isHost}
      />

      {/* Reaction Picker Overlay */}
      <TwitterSpaceReactionPicker
        isOpen={showReactions}
        onClose={() => setShowReactions(false)}
        onReaction={handleReaction}
      />

      {/* Share Menu */}
      <TwitterSpaceShareMenu
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        spaceId={spaceId}
        shareLink={space.share_link}
        spaceTitle={space.title}
      />

      {/* Settings Menu */}
      <TwitterSpaceSettingsMenu
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isHost={isHost}
        spaceId={spaceId}
      />

      {/* Chat Sidebar */}
      <TwitterSpaceChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        spaceId={spaceId}
        spaceTitle={space.title}
        hostName={speakers.find(s => s.user_id === space.user_id)?.profile?.display_name || 'Host'}
        startedAt={space.started_at}
        viewerCount={space.viewer_count}
      />

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={spaceId}
        hostId={space.user_id}
        viewers={speakers
          .filter(s => s.user_id !== user?.id)
          .map(s => ({
            id: s.user_id,
            display_name: s.profile?.display_name || 'User',
            username: s.profile?.username || '',
            avatar_url: s.profile?.avatar_url || '',
          }))}
        isHost={isHost}
        isSpace={true}
      />

      {/* Speaker Queue Panel */}
      {showSpeakerQueue && (
        <SpeakerQueuePanel
          spaceId={spaceId}
          isHost={isHost}
          onClose={() => setShowSpeakerQueue(false)}
        />
      )}
    </div>
  );
};
