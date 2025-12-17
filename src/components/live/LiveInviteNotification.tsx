import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Video, Check, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

    // Subscribe to new invites
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
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
        navigate(`/live?join=${invite.stream_id}`);
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
    <Dialog open={true} onOpenChange={() => handleRespond(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <Video className="w-5 h-5 text-red-500 animate-pulse" />
            Live Stream Invite
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center py-4">
          <Avatar className="w-16 h-16 mb-3">
            <AvatarImage src={invite.host?.avatar_url} />
            <AvatarFallback>{invite.host?.display_name?.[0] || "H"}</AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-lg">{invite.host?.display_name}</h3>
          <p className="text-sm text-muted-foreground">@{invite.host?.username}</p>
          <p className="mt-3 text-sm">
            invites you to join their live stream
          </p>
          <p className="font-medium text-primary mt-1">"{invite.stream?.title}"</p>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={() => handleRespond(false)}
            disabled={responding}
          >
            <X className="w-4 h-4 mr-2" />
            Decline
          </Button>
          <Button
            onClick={() => handleRespond(true)}
            disabled={responding}
            className="bg-red-600 hover:bg-red-700"
          >
            {responding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Join Live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
