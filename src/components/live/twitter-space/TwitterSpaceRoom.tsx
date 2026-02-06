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
} from 'lucide-react';

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

  // Fetch replies
  useEffect(() => {
    const fetchReplies = async () => {
      const { data } = await supabase
        .from('live_space_messages')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setReplies(
          data.reverse().map((msg) => ({
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
    
    if (myHostMuted && isMicOn) {
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

  const handleReplySubmit = async () => {
    if (!user || !replyText.trim()) return;

    const content = replyingTo 
      ? `@${replyingTo.handle.replace('@', '')} ${replyText}` 
      : replyText;

    await supabase.from('live_space_messages').insert({
      space_id: spaceId,
      user_id: user.id,
      content,
    });

    setReplyText('');
    setReplyingTo(null);
    toast.success('Reply sent!');
  };
  
  // Handle like toggle
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
  
  // Handle reply to specific message
  const handleReplyToMessage = (reply: Reply) => {
    setReplyingTo({ id: reply.id, user: reply.user, handle: reply.handle });
  };
  
  // Navigate to user profile
  const navigateToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
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
    const filteredSpeakers = speakers.filter(s => {
      if (activeGuestTab === 'All') return true;
      if (activeGuestTab === 'Co-hosts') return s.role === 'co_host';
      if (activeGuestTab === 'Speakers') return s.role === 'speaker';
      if (activeGuestTab === 'Listening') return s.role === 'listener';
      return true;
    });

    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
        {/* Guest Header */}
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
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
                    <button
                      key={speaker.id}
                      onClick={() => navigateToProfile(speaker.user_id)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
                    >
                      <img
                        src={speaker.profile?.avatar_url || ''}
                        alt={speaker.profile?.display_name}
                        className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{speaker.profile?.display_name}</p>
                        <p className="text-zinc-500 text-sm">@{speaker.profile?.username}</p>
                      </div>
                    </button>
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
                    <button
                      key={speaker.id}
                      onClick={() => navigateToProfile(speaker.user_id)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 cursor-pointer w-full text-left"
                    >
                      <img
                        src={speaker.profile?.avatar_url || ''}
                        alt={speaker.profile?.display_name}
                        className="w-12 h-12 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{speaker.profile?.display_name}</p>
                        <p className="text-zinc-500 text-sm">@{speaker.profile?.username}</p>
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
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <button onClick={handleMinimize} className="p-2">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-bold text-base flex-1 text-center truncate">{space?.title}</h1>
        <button onClick={() => setShowSettings(true)} className="p-2">
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
        <h2 className="text-white text-2xl font-bold text-center mb-8">
          {space?.title}
        </h2>

        {/* User Grid */}
        <div className="grid grid-cols-3 gap-4 max-w-[320px]">
          {speakers.slice(0, 12).map((speaker) => {
            const speaking = (audioLevels[speaker.user_id] || 0) > 10;
            const isHostUser = speaker.user_id === space.user_id;
            
            return (
              <button
                key={speaker.id}
                onClick={() => navigateToProfile(speaker.user_id)}
                className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-zinc-900/50 transition-colors"
              >
                <div className="relative">
                  {/* Speaking ring */}
                  {speaking && (
                    <div className="absolute inset-0 rounded-full ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-950 animate-pulse" />
                  )}
                  
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700">
                    {speaker.profile?.avatar_url ? (
                      <img 
                        src={speaker.profile.avatar_url} 
                        alt={speaker.profile.display_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xl font-semibold">
                        {speaker.profile?.display_name?.[0] || 'U'}
                      </div>
                    )}
                  </div>
                  
                  {/* Muted indicator */}
                  {speaker.is_muted && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-950">
                      <MicOff className="w-3 h-3 text-zinc-400" />
                    </div>
                  )}
                </div>

                {/* Name and role */}
                <div className="text-center max-w-full">
                  <div className="flex items-center justify-center gap-1 max-w-full">
                    <span className="text-white text-xs font-medium truncate max-w-[60px]">
                      {speaker.profile?.display_name?.split(' ')[0] || 'User'}
                    </span>
                    {speaker.profile?.is_verified && (
                      <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    )}
                  </div>
                  <span className={`text-[10px] ${isHostUser ? 'text-purple-400' : 'text-zinc-500'}`}>
                    {isHostUser ? 'Host' : speaker.role === 'co_host' ? 'Co-host' : speaker.role === 'speaker' ? 'Speaker' : 'Listener'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
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

      {/* BOTTOM CONTROLS */}
      <div className="px-4 py-4 pb-safe bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800/50">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Mic / Request Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleToggleMute}
              className={`w-14 h-14 rounded-full border border-zinc-800 flex items-center justify-center transition-all ${
                isMicOn ? 'bg-purple-600 border-transparent' : 'bg-transparent'
              }`}
            >
              {isMicOn ? (
                <Mic className="w-6 h-6 text-white" />
              ) : (
                <MicOff className="w-6 h-6 text-zinc-400" />
              )}
            </button>
            <span className="text-xs text-zinc-500">
              {isMicOn ? 'Mute' : canSpeak ? 'Unmute' : 'Request'}
            </span>
          </div>

          {/* Center Icons */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('guests')}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Users className="w-6 h-6" />
            </button>

            <button
              onClick={() => setShowReactions(true)}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Heart className="w-6 h-6" />
            </button>

            <button
              onClick={() => setShowShare(true)}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>

          {/* Chat Button with Badge */}
          <button
            onClick={() => setShowChat(true)}
            className="relative px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center gap-2 transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-white" />
            {unreadMessages > 0 && (
              <span className="bg-white text-purple-600 text-xs px-1.5 py-0.5 font-bold rounded-full">
                {unreadMessages}
              </span>
            )}
          </button>
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
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
            <div className="space-y-3">
              <button
                onClick={() => {
                  toast.success('Space link copied!');
                  navigator.clipboard.writeText(window.location.href);
                  setShowShare(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Copy Link</span>
                <LinkIcon className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: space?.title,
                      url: window.location.href,
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
                  toast.info('Audio settings coming soon');
                  setShowSettings(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Adjust settings</span>
                <Settings className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  toast.info('Thank you for your feedback!');
                  setShowSettings(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">Share feedback</span>
                <MessageSquare className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  toast.info('Be respectful, no spam, keep it civil.');
                  setShowSettings(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-white font-medium">View rules</span>
                <FileText className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => {
                  toast.info('Space reported. We will review it.');
                  setShowSettings(false);
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

            {/* Space Info */}
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

            {/* Replies Feed */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
              <h3 className="text-zinc-400 text-sm font-semibold mb-4">
                {replies.length > 0 ? `${replies.length} replies` : 'No replies yet'}
              </h3>
              <div className="space-y-4">
                {replies.map(reply => (
                  <div key={reply.id} className="pb-4 border-b border-zinc-800">
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToProfile(reply.user_id);
                        }}
                        className="flex-shrink-0"
                      >
                        <img
                          src={reply.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.user}`}
                          alt={reply.user}
                          className="w-10 h-10 rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToProfile(reply.user_id);
                            }}
                            className="text-white font-semibold hover:underline"
                          >
                            {reply.user}
                          </button>
                          <span className="text-zinc-500 text-sm">{reply.handle}</span>
                          <span className="text-zinc-500 text-sm">· {reply.time}</span>
                        </div>
                        <p className="text-zinc-300 text-sm mt-2 break-words">{reply.text}</p>
                        <div className="flex gap-6 mt-3 text-zinc-500 text-xs">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplyToMessage(reply);
                            }}
                            className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>Reply</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLikeMessage(reply.id);
                            }}
                            className={`flex items-center gap-1 transition-colors ${
                              reply.liked_by_me ? 'text-red-500' : 'hover:text-red-400'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${reply.liked_by_me ? 'fill-current' : ''}`} />
                            <span>{reply.likes > 0 ? reply.likes : 'Like'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
        />
      )}

      {showSpeakerQueue && (
        <SpeakerQueuePanel
          spaceId={spaceId}
          onClose={() => setShowSpeakerQueue(false)}
          isHost={isHost}
        />
      )}

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