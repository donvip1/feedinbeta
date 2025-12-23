import { useState, useEffect } from 'react';
import { X, Mic, MicOff, Hand, Users, MessageCircle, Gift, Share2, Settings, Crown, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SpaceChat } from './SpaceChat';
import { SpaceInviteModal } from './SpaceInviteModal';
import { LiveGiftModal } from './LiveGiftModal';
import { cn } from '@/lib/utils';

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
}

export const LiveSpaceRoom = ({ spaceId, onClose }: LiveSpaceRoomProps) => {
  const { user } = useAuth();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [myRole, setMyRole] = useState<string>('listener');
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  useEffect(() => {
    fetchSpaceData();
    joinSpace();

    // Subscribe to realtime updates
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
      }, (payload) => {
        const newReaction = {
          id: payload.new.id,
          emoji: payload.new.reaction_type,
          x: Math.random() * 80 + 10,
        };
        setReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();

    return () => {
      leaveSpace();
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

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
      // Fetch profiles
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

      // Find my role
      const mySpeaker = enrichedSpeakers.find(s => s.user_id === user?.id);
      if (mySpeaker) {
        setMyRole(mySpeaker.role);
        setIsMuted(mySpeaker.is_muted);
        setHasRaisedHand(mySpeaker.has_raised_hand);
      }
    }
  };

  const joinSpace = async () => {
    if (!user) return;

    // Check if already in space
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
      });

      // Update viewer count
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

    // Update viewer count
    if (space) {
      await supabase
        .from('live_spaces')
        .update({ viewer_count: Math.max(0, (space.viewer_count || 1) - 1) })
        .eq('id', spaceId);
    }
  };

  const toggleMute = async () => {
    if (!user || myRole === 'listener') return;

    const newMuteState = !isMuted;
    setIsMuted(newMuteState);

    await supabase
      .from('live_space_speakers')
      .update({ is_muted: newMuteState })
      .eq('space_id', spaceId)
      .eq('user_id', user.id);
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

    toast.success(newHandState ? 'Hand raised!' : 'Hand lowered');
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

    toast.success('Space ended');
    onClose();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/space/${space?.share_link}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: space?.title || 'Live Space',
          text: `Join my live space: ${space?.title}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const hosts = speakers.filter(s => s.role === 'host' || s.role === 'co_host');
  const activeSpeakers = speakers.filter(s => s.role === 'speaker');
  const listeners = speakers.filter(s => s.role === 'listener');
  const raisedHands = listeners.filter(s => s.has_raised_hand);

  const isHost = space?.user_id === user?.id || myRole === 'host' || myRole === 'co_host';

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Floating reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute bottom-20 text-3xl animate-bounce"
            style={{ left: `${reaction.x}%` }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{space?.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {space?.topic_category && (
                <Badge variant="secondary" className="text-xs">
                  {space.topic_category}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {speakers.length} listening
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {/* Hosts section */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Hosts</p>
          <div className="flex flex-wrap gap-4">
            {hosts.map((speaker) => (
              <div key={speaker.id} className="flex flex-col items-center">
                <div className="relative">
                  <Avatar className={cn(
                    "w-16 h-16 ring-2",
                    !speaker.is_muted ? "ring-primary animate-pulse" : "ring-border"
                  )}>
                    <AvatarImage src={speaker.profile?.avatar_url || ''} />
                    <AvatarFallback>{speaker.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                    {speaker.role === 'host' && <Crown className="w-4 h-4 text-amber-500" />}
                    {speaker.is_muted ? (
                      <MicOff className="w-4 h-4 text-red-500" />
                    ) : (
                      <Mic className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
                <span className="text-xs mt-1 text-center truncate max-w-[80px]">
                  {speaker.profile?.display_name || 'User'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Speakers section */}
        {activeSpeakers.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Speakers</p>
            <div className="flex flex-wrap gap-4">
              {activeSpeakers.map((speaker) => (
                <div key={speaker.id} className="flex flex-col items-center">
                  <div className="relative">
                    <Avatar className={cn(
                      "w-14 h-14 ring-2",
                      !speaker.is_muted ? "ring-primary" : "ring-border"
                    )}>
                      <AvatarImage src={speaker.profile?.avatar_url || ''} />
                      <AvatarFallback>{speaker.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    {speaker.is_muted && (
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                        <MicOff className="w-3 h-3 text-red-500" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs mt-1 text-center truncate max-w-[70px]">
                    {speaker.profile?.display_name || 'User'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raised hands (for hosts to see) */}
        {isHost && raisedHands.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
              <Hand className="w-4 h-4 text-amber-500" />
              Raised Hands ({raisedHands.length})
            </p>
            <div className="flex flex-wrap gap-3">
              {raisedHands.map((speaker) => (
                <div key={speaker.id} className="flex items-center gap-2 bg-amber-500/10 rounded-full px-3 py-1">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={speaker.profile?.avatar_url || ''} />
                    <AvatarFallback>{speaker.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{speaker.profile?.display_name}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs"
                    onClick={async () => {
                      await supabase
                        .from('live_space_speakers')
                        .update({ role: 'speaker', has_raised_hand: false })
                        .eq('id', speaker.id);
                      toast.success(`${speaker.profile?.display_name} is now a speaker`);
                    }}
                  >
                    Invite to speak
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listeners section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Listeners ({listeners.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {listeners.slice(0, 20).map((listener) => (
              <Avatar key={listener.id} className="w-10 h-10">
                <AvatarImage src={listener.profile?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {listener.profile?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            ))}
            {listeners.length > 20 && (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs">
                +{listeners.length - 20}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
        {/* Quick reactions */}
        <div className="flex justify-center gap-2 mb-4">
          {['❤️', '🔥', '👏', '😂', '🎉', '💯'].map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="text-xl p-2"
              onClick={() => sendReaction(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button 
            variant={isHost ? "destructive" : "outline"} 
            onClick={isHost ? endSpace : onClose}
            className="flex-1"
          >
            {isHost ? 'End Space' : 'Leave'}
          </Button>

          <div className="flex gap-2">
            {myRole === 'listener' ? (
              <Button
                variant={hasRaisedHand ? "default" : "outline"}
                size="icon"
                onClick={toggleRaiseHand}
              >
                <Hand className={cn("w-5 h-5", hasRaisedHand && "text-amber-500")} />
              </Button>
            ) : (
              <Button
                variant={isMuted ? "outline" : "default"}
                size="icon"
                onClick={toggleMute}
                className={!isMuted ? "bg-green-500 hover:bg-green-600" : ""}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={() => setShowChat(!showChat)}>
              <MessageCircle className="w-5 h-5" />
            </Button>

            <Button variant="outline" size="icon" onClick={() => setShowGiftModal(true)}>
              <Gift className="w-5 h-5" />
            </Button>

            <Button variant="outline" size="icon" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>

            {isHost && (
              <Button variant="outline" size="icon" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chat drawer */}
      {showChat && (
        <SpaceChat spaceId={spaceId} onClose={() => setShowChat(false)} />
      )}

      {/* Invite modal */}
      <SpaceInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        spaceId={spaceId}
      />

      {/* Gift modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={spaceId}
        hostId={space?.user_id || ''}
        viewers={speakers.filter(s => s.user_id !== user?.id).map(s => ({
          id: s.user_id,
          display_name: s.profile?.display_name || 'User',
          username: s.profile?.username || '',
          avatar_url: s.profile?.avatar_url || '',
        }))}
        isHost={isHost}
      />
    </div>
  );
};
