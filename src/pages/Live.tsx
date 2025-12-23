import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Users, Mic, Video, Clock, Play } from "lucide-react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { CreateLiveStreamModal } from "@/components/live/CreateLiveStreamModal";
import { CreateSpaceModal } from "@/components/live/CreateSpaceModal";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { SpaceCard } from "@/components/live/SpaceCard";
import { LiveStreamViewerWebRTC } from "@/components/live/LiveStreamViewerWebRTC";
import { LiveBroadcaster } from "@/components/live/LiveBroadcaster";
import { LiveSpaceRoom } from "@/components/live/LiveSpaceRoom";
import { GoLiveDropdown } from "@/components/live/GoLiveDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const Live = () => {
  const { user } = useAuth();
  const [createStreamModalOpen, setCreateStreamModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStreamId, setBroadcastStreamId] = useState<string | null>(null);

  // ===== VIDEO STREAMS QUERIES =====
  const { data: liveStreams, refetch: refetchLiveStreams } = useQuery({
    queryKey: ["live-streams", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("status", "live")
        .order("viewer_count", { ascending: false });
      
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
      return data || [];
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
      return data || [];
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
      return data || [];
    },
  });

  // ===== AUDIO SPACES QUERIES =====
  const { data: liveSpaces, refetch: refetchLiveSpaces } = useQuery({
    queryKey: ["live-spaces", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_spaces")
        .select("*")
        .eq("status", "live")
        .order("viewer_count", { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(space => ({
          ...space,
          profiles: profileMap.get(space.user_id)
        }));
      }
      return data || [];
    },
  });

  const { data: scheduledSpaces } = useQuery({
    queryKey: ["live-spaces", "scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_spaces")
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
        return data.map(space => ({
          ...space,
          profiles: profileMap.get(space.user_id)
        }));
      }
      return data || [];
    },
  });

  const { data: mySpaces, refetch: refetchMySpaces } = useQuery({
    queryKey: ["live-spaces", "my-spaces"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("live_spaces")
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
        
        return data.map(space => ({
          ...space,
          profiles: profile
        }));
      }
      return data || [];
    },
  });

  const { data: endedSpaces } = useQuery({
    queryKey: ["live-spaces", "ended"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_spaces")
        .select("*")
        .eq("status", "ended")
        .not("recording_url", "is", null)
        .order("ended_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(space => ({
          ...space,
          profiles: profileMap.get(space.user_id)
        }));
      }
      return data || [];
    },
  });

  // ===== REALTIME SUBSCRIPTIONS =====
  useEffect(() => {
    const streamsChannel = supabase
      .channel('live-streams-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams',
      }, () => {
        refetchLiveStreams();
        refetchMyStreams();
      })
      .subscribe();

    const spacesChannel = supabase
      .channel('live-spaces-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_spaces',
      }, () => {
        refetchLiveSpaces();
        refetchMySpaces();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streamsChannel);
      supabase.removeChannel(spacesChannel);
    };
  }, []);

  // ===== HANDLERS =====
  const handleStreamCreated = (streamId: string) => {
    setBroadcastStreamId(streamId);
    setIsBroadcasting(true);
    refetchMyStreams();
  };

  const handleSpaceCreated = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    refetchMySpaces();
  };

  const handleStreamClick = (stream: any) => {
    if (stream.user_id === user?.id && stream.status !== 'live') {
      setBroadcastStreamId(stream.id);
      setIsBroadcasting(true);
    } else if (stream.user_id === user?.id && stream.status === 'live') {
      setBroadcastStreamId(stream.id);
      setIsBroadcasting(true);
    } else {
      setSelectedStreamId(stream.id);
    }
  };

  const handleSpaceClick = (space: any) => {
    if (space.status === 'live' || space.status === 'ended') {
      setSelectedSpaceId(space.id);
    }
  };

  // Calculate combined counts
  const liveCount = (liveStreams?.length || 0) + (liveSpaces?.length || 0);
  const scheduledCount = (scheduledStreams?.length || 0) + (scheduledSpaces?.length || 0);
  const myContentCount = (myStreams?.length || 0) + (mySpaces?.length || 0);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Radio className="w-8 h-8 text-primary" />
              Live
            </h1>
            <GoLiveDropdown 
              onVideoStream={() => setCreateStreamModalOpen(true)}
              onAudioSpace={() => setCreateSpaceModalOpen(true)}
            />
          </div>

          <Tabs defaultValue="live" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="live" className="flex flex-col items-center gap-1 py-2 px-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs sm:text-sm">Live</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{liveCount}</span>
              </TabsTrigger>
              <TabsTrigger value="streams" className="flex flex-col items-center gap-1 py-2 px-1">
                <Video className="w-4 h-4" />
                <span className="text-[10px] text-muted-foreground">Streams</span>
              </TabsTrigger>
              <TabsTrigger value="spaces" className="flex flex-col items-center gap-1 py-2 px-1">
                <Mic className="w-4 h-4" />
                <span className="text-[10px] text-muted-foreground">Spaces</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex flex-col items-center gap-1 py-2 px-1">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] text-muted-foreground">{scheduledCount}</span>
              </TabsTrigger>
              <TabsTrigger value="my-content" className="flex flex-col items-center gap-1 py-2 px-1">
                <Users className="w-4 h-4" />
                <span className="text-[10px] text-muted-foreground">Mine</span>
              </TabsTrigger>
            </TabsList>

            {/* LIVE TAB - Combined streams and spaces */}
            <TabsContent value="live" className="mt-6">
              {liveCount > 0 ? (
                <div className="space-y-8">
                  {/* Live Video Streams */}
                  {liveStreams && liveStreams.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Video Streams ({liveStreams.length})
                      </h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveStreams.map((stream) => (
                          <LiveStreamCard
                            key={stream.id}
                            stream={stream}
                            onClick={() => handleStreamClick(stream)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Audio Spaces */}
                  {liveSpaces && liveSpaces.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        Audio Spaces ({liveSpaces.length})
                      </h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveSpaces.map((space) => (
                          <SpaceCard
                            key={space.id}
                            space={space as any}
                            onClick={() => handleSpaceClick(space)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <Radio className="w-24 h-24 text-muted-foreground/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-red-500/20 rounded-full animate-ping" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Live Content</h3>
                  <p className="text-muted-foreground mb-6">Be the first to go live!</p>
                  <GoLiveDropdown 
                    onVideoStream={() => setCreateStreamModalOpen(true)}
                    onAudioSpace={() => setCreateSpaceModalOpen(true)}
                  />
                </div>
              )}
            </TabsContent>

            {/* STREAMS TAB - Video only */}
            <TabsContent value="streams" className="mt-6">
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
                  <Video className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No live video streams</p>
                  <Button 
                    className="mt-4 bg-red-600 hover:bg-red-700"
                    onClick={() => setCreateStreamModalOpen(true)}
                  >
                    Start Video Stream
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* SPACES TAB - Audio only */}
            <TabsContent value="spaces" className="mt-6 space-y-8">
              {/* Live Spaces */}
              {liveSpaces && liveSpaces.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Live Now
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveSpaces.map((space) => (
                      <SpaceCard
                        key={space.id}
                        space={space as any}
                        onClick={() => handleSpaceClick(space)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Replays */}
              {endedSpaces && endedSpaces.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Replays
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {endedSpaces.map((space) => (
                      <SpaceCard
                        key={space.id}
                        space={space as any}
                        onClick={() => handleSpaceClick(space)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(!liveSpaces || liveSpaces.length === 0) && (!endedSpaces || endedSpaces.length === 0) && (
                <div className="text-center py-20">
                  <Mic className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No audio spaces</p>
                  <Button 
                    className="mt-4"
                    onClick={() => setCreateSpaceModalOpen(true)}
                  >
                    Start a Space
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* SCHEDULED TAB */}
            <TabsContent value="scheduled" className="mt-6 space-y-8">
              {scheduledStreams && scheduledStreams.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Scheduled Streams
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scheduledStreams.map((stream) => (
                      <LiveStreamCard
                        key={stream.id}
                        stream={stream}
                        onClick={() => handleStreamClick(stream)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {scheduledSpaces && scheduledSpaces.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Scheduled Spaces
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scheduledSpaces.map((space) => (
                      <SpaceCard
                        key={space.id}
                        space={space as any}
                        onClick={() => handleSpaceClick(space)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {scheduledCount === 0 && (
                <div className="text-center py-20">
                  <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No scheduled content</p>
                </div>
              )}
            </TabsContent>

            {/* MY CONTENT TAB */}
            <TabsContent value="my-content" className="mt-6 space-y-8">
              {myStreams && myStreams.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    My Streams
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myStreams.map((stream) => (
                      <LiveStreamCard
                        key={stream.id}
                        stream={stream}
                        onClick={() => handleStreamClick(stream)}
                        isOwner
                      />
                    ))}
                  </div>
                </div>
              )}

              {mySpaces && mySpaces.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    My Spaces
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mySpaces.map((space) => (
                      <SpaceCard
                        key={space.id}
                        space={space as any}
                        onClick={() => handleSpaceClick(space)}
                        isOwner
                      />
                    ))}
                  </div>
                </div>
              )}

              {myContentCount === 0 && (
                <div className="text-center py-20">
                  <Radio className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't created any content yet</p>
                  <div className="mt-4">
                    <GoLiveDropdown 
                      onVideoStream={() => setCreateStreamModalOpen(true)}
                      onAudioSpace={() => setCreateSpaceModalOpen(true)}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <BottomNav />
      </div>

      {/* Modals */}
      <CreateLiveStreamModal
        isOpen={createStreamModalOpen}
        onClose={() => setCreateStreamModalOpen(false)}
        onStreamCreated={handleStreamCreated}
      />

      <CreateSpaceModal
        isOpen={createSpaceModalOpen}
        onClose={() => setCreateSpaceModalOpen(false)}
        onSpaceCreated={handleSpaceCreated}
      />

      {/* Viewers/Players */}
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
            refetchLiveStreams();
            refetchMyStreams();
          }}
        />
      )}

      {selectedSpaceId && (
        <LiveSpaceRoom
          spaceId={selectedSpaceId}
          onClose={() => {
            setSelectedSpaceId(null);
            refetchLiveSpaces();
            refetchMySpaces();
          }}
        />
      )}
    </>
  );
};

export default Live;
