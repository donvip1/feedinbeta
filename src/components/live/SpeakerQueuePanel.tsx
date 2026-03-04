import { useState, useEffect } from 'react';
import { Hand, Check, X, Clock, Crown, Mic } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SpeakerQueuePanelProps {
  spaceId: string;
  isHost: boolean;
  onClose: () => void;
  onSpeakerUpdate?: () => void;
}

interface QueuedSpeaker {
  id: string;
  user_id: string;
  has_raised_hand: boolean;
  hand_raised_at: string;
  role: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const SpeakerQueuePanel = ({ spaceId, isHost, onClose, onSpeakerUpdate }: SpeakerQueuePanelProps) => {
  const [queue, setQueue] = useState<QueuedSpeaker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
    
    const channel = supabase
      .channel(`speaker-queue-${spaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${spaceId}`,
      }, () => fetchQueue())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  const fetchQueue = async () => {
    const { data: speakers } = await supabase
      .from('live_space_speakers')
      .select('*')
      .eq('space_id', spaceId)
      .eq('has_raised_hand', true)
      .is('left_at', null)
      .order('hand_raised_at', { ascending: true });

    if (speakers && speakers.length > 0) {
      const userIds = speakers.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setQueue(speakers.map(s => ({
        ...s,
        profile: profileMap.get(s.user_id),
      })));
    } else {
      setQueue([]);
    }
    setLoading(false);
  };

  const promoteToSpeaker = async (speaker: QueuedSpeaker) => {
    try {
      // DB update first, then wait for propagation before broadcasting
      const { error } = await supabase
        .from('live_space_speakers')
        .update({ 
          role: 'speaker', 
          has_raised_hand: false,
          hand_raised_at: null,
          mic_allowed: true,
        })
        .eq('id', speaker.id);

      if (error) throw error;

      // Small delay to ensure realtime listeners pick up the DB change
      await new Promise(resolve => setTimeout(resolve, 300));

      // Send promotion notification via broadcast channel
      const promotionChannel = supabase.channel(`speaker-promotion-${speaker.user_id}`);
      await promotionChannel.send({
        type: 'broadcast',
        event: 'promoted-to-speaker',
        payload: {
          user_id: speaker.user_id,
          space_id: spaceId,
          role: 'speaker',
        },
      });
      supabase.removeChannel(promotionChannel);

      toast.success(`${speaker.profile?.display_name || 'User'} is now a speaker!`);
      onSpeakerUpdate?.();
    } catch (error) {
      toast.error('Failed to promote speaker');
    }
  };

  const declineRequest = async (speaker: QueuedSpeaker) => {
    try {
      await supabase
        .from('live_space_speakers')
        .update({ 
          has_raised_hand: false,
          hand_raised_at: null 
        })
        .eq('id', speaker.id);

      toast.info(`Request from ${speaker.profile?.display_name || 'User'} declined`);
      onSpeakerUpdate?.();
    } catch (error) {
      toast.error('Failed to decline request');
    }
  };

  const promoteToCoHost = async (speaker: QueuedSpeaker) => {
    try {
      const { error } = await supabase
        .from('live_space_speakers')
        .update({ 
          role: 'co_host', 
          has_raised_hand: false,
          hand_raised_at: null,
          mic_allowed: true,
        })
        .eq('id', speaker.id);

      if (error) throw error;

      await new Promise(resolve => setTimeout(resolve, 300));

      // Send promotion notification via broadcast channel
      const promotionChannel = supabase.channel(`speaker-promotion-${speaker.user_id}`);
      await promotionChannel.send({
        type: 'broadcast',
        event: 'promoted-to-speaker',
        payload: {
          user_id: speaker.user_id,
          space_id: spaceId,
          role: 'co_host',
        },
      });
      supabase.removeChannel(promotionChannel);

      toast.success(`${speaker.profile?.display_name || 'User'} is now a co-host!`);
      onSpeakerUpdate?.();
    } catch (error) {
      toast.error('Failed to promote to co-host');
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t rounded-t-3xl max-h-[70vh] animate-in slide-in-from-bottom">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hand className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold">Speaker Queue</h3>
            <Badge variant="secondary">{queue.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[50vh] p-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : queue.length === 0 ? (
          <div className="text-center py-8">
            <Hand className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No raised hands yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Listeners can raise their hand to request to speak
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((speaker, index) => (
              <div 
                key={speaker.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={speaker.profile?.avatar_url || ''} />
                    <AvatarFallback>{speaker.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{speaker.profile?.display_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {speaker.hand_raised_at 
                      ? formatDistanceToNow(new Date(speaker.hand_raised_at), { addSuffix: true })
                      : 'Just now'}
                  </p>
                </div>

                {isHost && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => declineRequest(speaker)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => promoteToSpeaker(speaker)}
                      className="h-8 gap-1 bg-green-500 hover:bg-green-600"
                    >
                      <Mic className="w-3 h-3" />
                      Speaker
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promoteToCoHost(speaker)}
                      className="h-8 gap-1"
                    >
                      <Crown className="w-3 h-3 text-amber-500" />
                      Co-host
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
