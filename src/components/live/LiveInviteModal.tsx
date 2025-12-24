import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UserPlus, Search, Clock, X, Loader2 } from "lucide-react";
import { sanitizeSearchQuery } from "@/lib/search-utils";

interface LiveInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  currentCoHostCount?: number;
  maxCoHosts?: number;
}

interface PendingInvite {
  id: string;
  invited_user_id: string;
  status: string;
  created_at: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const LiveInviteModal = ({ isOpen, onClose, streamId, currentCoHostCount = 0, maxCoHosts = 4 }: LiveInviteModalProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState<string>("");

  // Fetch stream title and pending invites
  useEffect(() => {
    if (!isOpen) return;

    const fetchStreamAndInvites = async () => {
      // Fetch stream title
      const { data: streamData } = await supabase
        .from("live_streams")
        .select("title")
        .eq("id", streamId)
        .single();
      
      if (streamData) {
        setStreamTitle(streamData.title);
      }

      // Fetch pending invites
      const { data } = await supabase
        .from("live_stream_invites")
        .select("*")
        .eq("stream_id", streamId)
        .eq("status", "pending");

      if (data && data.length > 0) {
        const userIds = data.map((i) => i.invited_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        const invitesWithProfiles = data.map((invite) => ({
          ...invite,
          profile: profileMap.get(invite.invited_user_id),
        }));

        setPendingInvites(invitesWithProfiles);
      } else {
        setPendingInvites([]);
      }
    };

    fetchStreamAndInvites();

    // Subscribe to invite updates
    const channel = supabase
      .channel(`invites-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_stream_invites",
          filter: `stream_id=eq.${streamId}`,
        },
        () => fetchStreamAndInvites()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, streamId]);

  // Search for users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const safeQuery = sanitizeSearchQuery(searchQuery);
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
        .neq("id", user?.id)
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (userId: string) => {
    if (!user) return;

    // Check co-host limit
    if (currentCoHostCount + pendingInvites.length >= maxCoHosts) {
      toast.error(`Maximum ${maxCoHosts} co-hosts allowed`);
      return;
    }

    setInviting(userId);
    try {
      // Create the invite
      const { error } = await supabase.from("live_stream_invites").insert({
        stream_id: streamId,
        host_id: user.id,
        invited_user_id: userId,
      });

      if (error) {
        if (error.message.includes("duplicate")) {
          toast.error("User already invited");
        } else {
          throw error;
        }
        return;
      }

      // Create a notification for the invited user
      await supabase.from("notifications").insert({
        user_id: userId,
        from_user_id: user.id,
        type: "live_invite",
        title: "Live Stream Invite",
        message: `invited you to join their live stream: "${streamTitle || 'Live Stream'}"`,
        related_id: streamId,
        related_type: "live_stream",
      });

      // Send broadcast for immediate popup notification
      const broadcastChannel = supabase.channel(`live-invite-${userId}`);
      await broadcastChannel.subscribe();
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'new-invite',
        payload: {
          streamId,
          hostId: user.id,
          streamTitle: streamTitle || 'Live Stream',
        },
      });
      await supabase.removeChannel(broadcastChannel);

      toast.success("Invite sent!");
      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (error: any) {
      toast.error(error.message || "Failed to send invite");
    } finally {
      setInviting(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await supabase.from("live_stream_invites").delete().eq("id", inviteId);
      toast.success("Invite cancelled");
    } catch (error) {
      toast.error("Failed to cancel invite");
    }
  };

  const canInviteMore = currentCoHostCount + pendingInvites.length < maxCoHosts;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Co-Host ({currentCoHostCount}/{maxCoHosts})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Capacity Warning */}
          {!canInviteMore && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-600">
                Maximum {maxCoHosts} co-hosts reached. Remove a co-host to invite more.
              </p>
            </div>
          )}
          {/* Search */}
          <div>
            <Label>Search by username</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <Label>Results</Label>
              <ScrollArea className="h-40 border rounded-lg p-2 mt-1">
                <div className="space-y-2">
                  {searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={profile.avatar_url} />
                          <AvatarFallback>{profile.display_name?.[0] || "U"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{profile.display_name}</p>
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleInvite(profile.id)}
                        disabled={inviting === profile.id || !canInviteMore}
                      >
                        {inviting === profile.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-1" />
                            Invite
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Invites
              </Label>
              <ScrollArea className="h-32 border rounded-lg p-2 mt-1">
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={invite.profile?.avatar_url} />
                          <AvatarFallback>{invite.profile?.display_name?.[0] || "U"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{invite.profile?.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            @{invite.profile?.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-yellow-600">
                          Pending
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleCancelInvite(invite.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};