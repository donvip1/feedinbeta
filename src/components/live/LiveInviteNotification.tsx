import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Video, Check, X, Loader2, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface Invite {
  id: string;
  stream_id: string;
  host_id: string;
  status: string;
  stream?: {
    title: string;
    status: string;
  };
  host?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const LiveInviteNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check for pending invites
    const checkInvites = async () => {
      const { data } = await supabase
        .from("live_stream_invites")
        .select("*")
        .eq("invited_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const inviteData = data[0];
        
        // Fetch stream and host info
        const [streamRes, hostRes] = await Promise.all([
          supabase
            .from("live_streams")
            .select("title, status")
            .eq("id", inviteData.stream_id)
            .single(),
          supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("id", inviteData.host_id)
            .single(),
        ]);

        setInvite({
          ...inviteData,
          stream: streamRes.data || undefined,
          host: hostRes.data || undefined,
        });
      }
    };

    checkInvites();

    // Subscribe to new invites via database changes
    const dbChannel = supabase
      .channel(`my-invites-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_stream_invites",
          filter: `invited_user_id=eq.${user.id}`,
        },
        () => checkInvites()
      )
      .subscribe();

    // Subscribe to broadcast channel for immediate popup
    const broadcastChannel = supabase
      .channel(`live-invite-${user.id}`)
      .on('broadcast', { event: 'new-invite' }, (payload) => {
        console.log("[LiveInvite] Received broadcast invite:", payload);
        checkInvites();
        
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}

        // Show toast as backup
        toast(`🔴 Live invite from ${payload.payload?.hostName || 'someone'}!`, {
          description: `Join: ${payload.payload?.streamTitle || 'Live Stream'}`,
          duration: 5000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [user]);

  const handleRespond = async (accept: boolean) => {
    if (!invite) return;

    setResponding(true);
    try {
      const { error } = await supabase
        .from("live_stream_invites")
        .update({
          status: accept ? "accepted" : "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (error) throw error;

      if (accept) {
        toast.success("Joining live stream...");
        navigate(`/live/stream/${invite.stream_id}`);
      } else {
        toast.info("Invite declined");
      }

      setInvite(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  if (!invite || invite.stream?.status !== "live") return null;

  return (
    <AnimatePresence>
      <Dialog open={true} onOpenChange={() => handleRespond(false)}>
        <DialogContent className="max-w-sm border-red-500/50 bg-gradient-to-b from-background to-red-950/20">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Video className="w-6 h-6 text-red-500" />
                </motion.div>
                <span className="text-red-500 font-bold">LIVE</span> Stream Invite
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center text-center py-6">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 0 0 rgba(239, 68, 68, 0.4)',
                    '0 0 0 20px rgba(239, 68, 68, 0)',
                  ]
                }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="rounded-full"
              >
                <Avatar className="w-20 h-20 border-4 border-red-500">
                  <AvatarImage src={invite.host?.avatar_url} />
                  <AvatarFallback className="text-2xl bg-red-500/20">
                    {invite.host?.display_name?.[0] || "H"}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              
              <h3 className="font-bold text-xl mt-4">{invite.host?.display_name}</h3>
              <p className="text-sm text-muted-foreground">@{invite.host?.username}</p>
              
              <div className="mt-4 bg-muted/50 rounded-lg p-3 w-full">
                <p className="text-sm text-muted-foreground">
                  invites you to join their live stream
                </p>
                <p className="font-semibold text-primary text-lg mt-1">
                  "{invite.stream?.title}"
                </p>
              </div>
            </div>

            <DialogFooter className="flex gap-3 sm:justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRespond(false)}
                disabled={responding}
                className="flex-1"
              >
                <X className="w-5 h-5 mr-2" />
                Decline
              </Button>
              <Button
                size="lg"
                onClick={() => handleRespond(true)}
                disabled={responding}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {responding ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 mr-2" />
                )}
                Join Live
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  );
};