import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mic, Radio, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SpaceInvite {
  id: string;
  space_id: string;
  inviter_id: string;
  status: string;
  created_at: string;
  space?: {
    id: string;
    title: string;
    status: string;
  };
  inviter?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const SpaceInviteNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<SpaceInvite | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fetch pending invites on mount
    const fetchPendingInvites = async () => {
      const { data, error } = await supabase
        .from('live_space_invitations')
        .select('*')
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return;

      const inviteData = data[0];
      
      // Fetch space and inviter details
      const [spaceResult, inviterResult] = await Promise.all([
        supabase
          .from('live_spaces')
          .select('id, title, status')
          .eq('id', inviteData.space_id)
          .single(),
        supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', inviteData.inviter_id)
          .single(),
      ]);

      // Only show if space is still live
      if (spaceResult.data?.status === 'live') {
        setInvite({
          ...inviteData,
          space: spaceResult.data,
          inviter: inviterResult.data || undefined,
        });
      }
    };

    fetchPendingInvites();

    // Subscribe to new invites
    const channel = supabase
      .channel(`space-invites-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_invitations',
        filter: `invitee_id=eq.${user.id}`,
      }, async (payload: any) => {
        console.log('[SpaceInviteNotification] New invite received:', payload.new);
        
        const inviteData = payload.new;
        
        // Fetch space and inviter details
        const [spaceResult, inviterResult] = await Promise.all([
          supabase
            .from('live_spaces')
            .select('id, title, status')
            .eq('id', inviteData.space_id)
            .single(),
          supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', inviteData.inviter_id)
            .single(),
        ]);

        // Only show if space is live
        if (spaceResult.data?.status === 'live') {
          setInvite({
            ...inviteData,
            space: spaceResult.data,
            inviter: inviterResult.data || undefined,
          });
          
          // Show toast notification
          toast.info(`${inviterResult.data?.display_name || 'Someone'} invited you to speak in a live space!`);
        }
      })
      .subscribe();

    // Also listen for broadcast invites (faster delivery)
    const broadcastChannel = supabase
      .channel(`space-invite-broadcast-${user.id}`)
      .on('broadcast', { event: 'space-invite' }, async (payload: any) => {
        console.log('[SpaceInviteNotification] Broadcast invite received:', payload);
        
        if (payload.payload?.invitee_id === user.id) {
          // Refetch invite data
          fetchPendingInvites();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [user]);

  const handleResponse = async (accept: boolean) => {
    if (!invite || !user) return;

    setResponding(true);
    try {
      // Update invite status
      await supabase
        .from('live_space_invitations')
        .update({
          status: accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (accept) {
        // Update speaker role to speaker
        await supabase
          .from('live_space_speakers')
          .upsert({
            space_id: invite.space_id,
            user_id: user.id,
            role: 'speaker',
            is_muted: true, // Start muted
            has_raised_hand: false,
            host_muted: false,
            mic_allowed: true,
            joined_at: new Date().toISOString(),
            left_at: null,
          }, {
            onConflict: 'space_id,user_id',
          });

        toast.success('Joined as speaker!');
        navigate(`/space/${invite.space_id}`);
      } else {
        toast.info('Invitation declined');
      }

      setInvite(null);
    } catch (error) {
      console.error('[SpaceInviteNotification] Error responding:', error);
      toast.error('Failed to respond to invitation');
    } finally {
      setResponding(false);
    }
  };

  if (!invite) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleResponse(false)}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-gradient-to-b from-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center text-center py-4"
        >
          {/* Animated radio icon */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4"
          >
            <Radio className="w-8 h-8 text-primary animate-pulse" />
          </motion.div>

          {/* Inviter avatar */}
          <Avatar className="w-16 h-16 ring-4 ring-primary/30 mb-3">
            <AvatarImage src={invite.inviter?.avatar_url} />
            <AvatarFallback className="bg-primary/20 text-primary text-xl">
              {invite.inviter?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>

          <h3 className="text-lg font-bold mb-1">Speaker Invitation</h3>
          <p className="text-muted-foreground text-sm mb-4">
            <span className="text-foreground font-medium">{invite.inviter?.display_name || 'Someone'}</span>
            {' '}invited you to speak in
          </p>

          <div className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 mb-6">
            <div className="flex items-center gap-2 justify-center">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </Badge>
              <span className="font-semibold">{invite.space?.title || 'Live Space'}</span>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleResponse(false)}
              disabled={responding}
            >
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={() => handleResponse(true)}
              disabled={responding}
            >
              <Mic className="w-4 h-4 mr-2" />
              Join as Speaker
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
