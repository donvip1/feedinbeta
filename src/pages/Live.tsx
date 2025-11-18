import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Radio } from "lucide-react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { CreateLiveStreamModal } from "@/components/live/CreateLiveStreamModal";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { LiveStreamViewer } from "@/components/live/LiveStreamViewer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Live = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  const { data: liveStreams, refetch: refetchLive } = useQuery({
    queryKey: ["live-streams", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*, profiles!user_id(*)")
        .eq("status", "live")
        .order("viewer_count", { ascending: false });
      
      if (error) throw error;
      return data as any;
    },
  });

  const { data: scheduledStreams } = useQuery({
    queryKey: ["live-streams", "scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*, profiles!user_id(*)")
        .eq("status", "scheduled")
        .order("scheduled_start", { ascending: true });
      
      if (error) throw error;
      return data as any;
    },
  });

  const { data: myStreams } = useQuery({
    queryKey: ["live-streams", "my-streams"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("live_streams")
        .select("*, profiles!user_id(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as any;
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Radio className="w-8 h-8 text-primary" />
              Live Feeds
            </h1>
            <Button size="sm" className="gap-2" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Go Live
            </Button>
          </div>

          <Tabs defaultValue="live" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="live">
                Live Now ({liveStreams?.length || 0})
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
                      onClick={() => setSelectedStreamId(stream.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Radio className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No live streams at the moment</p>
                  <Button 
                    className="mt-4"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    Be the first to go live!
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
                      onClick={() => setSelectedStreamId(stream.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
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
                      onClick={() => setSelectedStreamId(stream.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-muted-foreground">You haven't created any streams yet</p>
                  <Button 
                    className="mt-4"
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
        onStreamCreated={(streamId) => {
          setSelectedStreamId(streamId);
          refetchLive();
        }}
      />

      {selectedStreamId && (
        <LiveStreamViewer
          streamId={selectedStreamId}
          onClose={() => setSelectedStreamId(null)}
        />
      )}
    </>
  );
};

export default Live;