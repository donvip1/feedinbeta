import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Radio, Users, Mic } from "lucide-react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { CreateLiveStreamModal } from "@/components/live/CreateLiveStreamModal";
import { CreateSpaceModal } from "@/components/live/CreateSpaceModal";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { SpaceCard } from "@/components/live/SpaceCard";
import { LiveStreamViewerWebRTC } from "@/components/live/LiveStreamViewerWebRTC";
import { LiveBroadcaster } from "@/components/live/LiveBroadcaster";
import { LiveSpaceRoom } from "@/components/live/LiveSpaceRoom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const Live = () => {
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStreamId, setBroadcastStreamId] = useState<string | null>(null);

  const { data: liveStreams, refetch: refetchLive } = useQuery({
    queryKey: ["live-streams", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("status", "live")
        .order("viewer_count", { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(stream => ({
          ...stream,
          profiles: profileMap.get(stream.user_id)
        }));
      }
      return data;
    },
  });

  const { data: scheduledStreams } = useQuery({
    queryKey: ["live-streams", "scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_start", { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(stream => ({
          ...stream,
          profiles: profileMap.get(stream.user_id)
        }));
      }
      return data;
    },
  });

  const { data: myStreams, refetch: refetchMyStreams } = useQuery({
    queryKey: ["live-streams", "my-streams"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", user.id)
          .single();
        
        return data.map(stream => ({
          ...stream,
          profiles: profile
        }));
      }
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('live-streams-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_streams',
        },
        () => {
          refetchLive();
          refetchMyStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStreamCreated = (streamId: string) => {
    setBroadcastStreamId(streamId);
    setIsBroadcasting(true);
    refetchMyStreams();
  };

  const handleStreamClick = (stream: any) => {
    // If it's the user's own stream and not live, open broadcaster
    if (stream.user_id === user?.id && stream.status !== 'live') {
      setBroadcastStreamId(stream.id);
      setIsBroadcasting(true);
    } else if (stream.user_id === user?.id && stream.status === 'live') {
      // Own live stream - open broadcaster to manage
      setBroadcastStreamId(stream.id);
      setIsBroadcasting(true);
    } else {
      // Other's stream - open viewer
      setSelectedStreamId(stream.id);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Radio className="w-8 h-8 text-primary" />
              Live Feeds
            </h1>
            <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Go Live
            </Button>
          </div>

          <Tabs defaultValue="live" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="live" className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Live ({liveStreams?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="my-streams">My Streams</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="mt-6">
              {liveStreams && liveStreams.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {liveStreams.map((stream) => (
                    <LiveStreamCard
                      key={stream.id}
                      stream={stream}
                      onClick={() => handleStreamClick(stream)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <Radio className="w-24 h-24 text-muted-foreground/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-red-500/20 rounded-full animate-ping" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Live Streams</h3>
                  <p className="text-muted-foreground mb-6">Be the first to go live and share your moment!</p>
                  <Button 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Start Streaming
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="mt-6">
              {scheduledStreams && scheduledStreams.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scheduledStreams.map((stream) => (
                    <LiveStreamCard
                      key={stream.id}
                      stream={stream}
                      onClick={() => handleStreamClick(stream)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Radio className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No scheduled streams</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-streams" className="mt-6">
              {myStreams && myStreams.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myStreams.map((stream) => (
                    <LiveStreamCard
                      key={stream.id}
                      stream={stream}
                      onClick={() => handleStreamClick(stream)}
                      isOwner
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Radio className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't created any streams yet</p>
                  <Button 
                    className="mt-4 bg-red-600 hover:bg-red-700"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    Create Your First Stream
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <BottomNav />
      </div>

      <CreateLiveStreamModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onStreamCreated={handleStreamCreated}
      />

      {selectedStreamId && (
        <LiveStreamViewerWebRTC
          streamId={selectedStreamId}
          onClose={() => setSelectedStreamId(null)}
        />
      )}

      {isBroadcasting && broadcastStreamId && (
        <LiveBroadcaster
          streamId={broadcastStreamId}
          onClose={() => {
            setIsBroadcasting(false);
            setBroadcastStreamId(null);
            refetchLive();
            refetchMyStreams();
          }}
        />
      )}
    </>
  );
};

export default Live;