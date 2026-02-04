import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Megaphone, UserPlus, Crown, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

interface Viewer {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
}

interface ViewerListPanelProps {
  viewers: Viewer[];
  viewerCount: number;
  streamId: string;
  onInviteToSpeak: (userId: string) => void;
  coHosts: string[];
  maxCoHosts?: number;
  onGiftViewer?: (viewer: Viewer) => void;
}

export const ViewerListPanel = ({
  viewers,
  viewerCount,
  streamId,
  onInviteToSpeak,
  coHosts,
  maxCoHosts = 4,
  onGiftViewer,
}: ViewerListPanelProps) => {
  const [shoutingOut, setShoutingOut] = useState<string | null>(null);

  const handleShoutOut = async (viewer: Viewer) => {
    setShoutingOut(viewer.id);
    try {
      // Send shoutout as a special comment
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("live_stream_comments").insert({
        stream_id: streamId,
        user_id: user.id,
        content: `🎉 Shoutout to @${viewer.username}! Welcome to the stream! 🎉`,
      });

      toast.success(`Shouted out ${viewer.display_name}!`);
    } catch (error) {
      toast.error("Failed to send shoutout");
    } finally {
      setShoutingOut(null);
    }
  };

  const canInviteMore = coHosts.length < maxCoHosts;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-purple-500/80 hover:bg-purple-600"
        >
          <Users className="w-5 h-5 text-white" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Viewers ({viewerCount})
          </SheetTitle>
        </SheetHeader>

        <div className="p-4">
          {/* Co-hosts Section */}
          {coHosts.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                Co-hosts ({coHosts.length}/{maxCoHosts})
              </p>
              <div className="flex flex-wrap gap-2">
                {viewers
                  .filter((v) => coHosts.includes(v.id))
                  .map((coHost) => (
                    <div
                      key={coHost.id}
                      className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={coHost.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {coHost.display_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{coHost.display_name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Capacity Notice */}
          {!canInviteMore && (
            <div className="mb-4 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-600">
                Maximum {maxCoHosts} co-hosts reached. Remove a co-host to invite more.
              </p>
            </div>
          )}

          {/* Viewers List */}
          <p className="text-sm font-semibold text-muted-foreground mb-2">
            All Viewers
          </p>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2">
              {viewers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No viewers yet
                </p>
              ) : (
                viewers.map((viewer) => {
                  const isCoHost = coHosts.includes(viewer.id);
                  return (
                    <div
                      key={viewer.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg",
                        isCoHost ? "bg-yellow-500/10" : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={viewer.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {viewer.display_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1">
                            {viewer.display_name}
                            {isCoHost && (
                              <Crown className="w-3 h-3 text-yellow-500" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{viewer.username}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Gift button */}
                        {onGiftViewer && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => onGiftViewer(viewer)}
                            title="Send gift"
                          >
                            <Gift className="w-4 h-4 text-amber-500" />
                          </Button>
                        )}

                        {/* Shout out button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleShoutOut(viewer)}
                          disabled={shoutingOut === viewer.id}
                          title="Shout out"
                        >
                          <Megaphone className="w-4 h-4 text-primary" />
                        </Button>

                        {/* Invite to speak button */}
                        {!isCoHost && canInviteMore && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => onInviteToSpeak(viewer.id)}
                            title="Invite to speak"
                          >
                            <UserPlus className="w-4 h-4 text-green-500" />
                          </Button>
                        )}

                        {isCoHost && (
                          <Badge variant="secondary" className="text-[10px]">
                            Speaking
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
