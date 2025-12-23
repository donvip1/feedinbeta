import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Radio, Users, Mic, Video, Clock, Play, Sparkles, Zap, Crown, TrendingUp, Calendar } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const Live = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [createStreamModalOpen, setCreateStreamModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStreamId, setBroadcastStreamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("live");

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
        const spaceIds = data.map(s => s.id);
        
        // Fetch profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        // Fetch active listener counts per space
        const { data: listenerCounts } = await supabase
          .from("live_space_speakers")
          .select("space_id")
          .in("space_id", spaceIds)
          .is("left_at", null);
        
        // Count listeners per space
        const countMap = new Map<string, number>();
        listenerCounts?.forEach(l => {
          countMap.set(l.space_id!, (countMap.get(l.space_id!) || 0) + 1);
        });
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(space => ({
          ...space,
          active_listeners: countMap.get(space.id) || 0,
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
      }, () => {
        // Refetch spaces when speakers change to update listener counts
        refetchLiveSpaces();
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

  // Calculate counts
  const liveCount = (liveStreams?.length || 0) + (liveSpaces?.length || 0);
  const scheduledCount = (scheduledStreams?.length || 0) + (scheduledSpaces?.length || 0);
  const myContentCount = (myStreams?.length || 0) + (mySpaces?.length || 0);

  // Render modals/overlays
  if (selectedStreamId) {
    return (
      <LiveStreamViewerWebRTC
        streamId={selectedStreamId}
        onClose={() => setSelectedStreamId(null)}
      />
    );
  }

  if (isBroadcasting && broadcastStreamId) {
    return (
      <LiveBroadcaster
        streamId={broadcastStreamId}
        onClose={() => {
          setIsBroadcasting(false);
          setBroadcastStreamId(null);
        }}
      />
    );
  }

  if (selectedSpaceId) {
    return (
      <LiveSpaceRoom
        spaceId={selectedSpaceId}
        onClose={() => setSelectedSpaceId(null)}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        {/* Hero Header with Animated Gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent opacity-60" />
          
          {/* Animated orbs */}
          <div className="absolute top-10 right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          
          <div className="relative container mx-auto px-4 py-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
                    <Radio className="w-7 h-7 text-white" />
                  </div>
                  {liveCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {liveCount}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
                    Live
                  </h1>
                  <p className="text-sm text-muted-foreground">Watch & broadcast live content</p>
                </div>
              </div>
              
              <GoLiveDropdown 
                onVideoStream={() => setCreateStreamModalOpen(true)}
                onAudioSpace={() => setCreateSpaceModalOpen(true)}
              />
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-red-400">LIVE NOW</span>
                </div>
                <p className="text-2xl font-bold">{liveCount}</p>
                <Zap className="absolute right-2 bottom-2 w-8 h-8 text-red-500/20" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">SCHEDULED</span>
                </div>
                <p className="text-2xl font-bold">{scheduledCount}</p>
                <Calendar className="absolute right-2 bottom-2 w-8 h-8 text-blue-500/20" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-3 h-3 text-purple-400" />
                  <span className="text-xs font-medium text-purple-400">YOUR CONTENT</span>
                </div>
                <p className="text-2xl font-bold">{myContentCount}</p>
                <Sparkles className="absolute right-2 bottom-2 w-8 h-8 text-purple-500/20" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-12 p-1 bg-muted/50 backdrop-blur-sm rounded-2xl mb-6">
              <TabsTrigger 
                value="live" 
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-current rounded-full animate-pulse" />
                  <span className="text-xs font-medium">Live</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="streams"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all"
              >
                <div className="flex flex-col items-center">
                  <Video className="w-4 h-4" />
                  <span className="text-[10px]">Streams</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="spaces"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all"
              >
                <div className="flex flex-col items-center">
                  <Mic className="w-4 h-4" />
                  <span className="text-[10px]">Spaces</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all"
              >
                <div className="flex flex-col items-center">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px]">Soon</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="my-content"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all"
              >
                <div className="flex flex-col items-center">
                  <Crown className="w-4 h-4" />
                  <span className="text-[10px]">Mine</span>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* LIVE TAB */}
            <TabsContent value="live" className="mt-0">
              <AnimatePresence mode="wait">
                {liveCount > 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-8"
                  >
                    {/* Live Video Streams */}
                    {liveStreams && liveStreams.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                            <Video className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-semibold text-red-400">Video Streams</span>
                            <Badge variant="secondary" className="h-5 bg-red-500/20 text-red-400">{liveStreams.length}</Badge>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {liveStreams.map((stream, index) => (
                            <motion.div
                              key={stream.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <LiveStreamCard
                                stream={stream}
                                onClick={() => handleStreamClick(stream)}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Live Audio Spaces */}
                    {liveSpaces && liveSpaces.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                            <Mic className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-semibold text-purple-400">Audio Spaces</span>
                            <Badge variant="secondary" className="h-5 bg-purple-500/20 text-purple-400">{liveSpaces.length}</Badge>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {liveSpaces.map((space, index) => (
                            <motion.div
                              key={space.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <SpaceCard
                                space={space as any}
                                onClick={() => handleSpaceClick(space)}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <div className="relative w-32 h-32 mx-auto mb-6">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-purple-500/20 rounded-full blur-2xl animate-pulse" />
                      <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50">
                        <Radio className="w-16 h-16 text-muted-foreground/50" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-red-500/30 rounded-full animate-ping" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">No Live Content</h3>
                    <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                      Be the first to go live! Start streaming video or create an audio space.
                    </p>
                    <div className="flex justify-center gap-4">
                      <Button 
                        onClick={() => setCreateStreamModalOpen(true)}
                        className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/25"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Start Stream
                      </Button>
                      <Button 
                        onClick={() => setCreateSpaceModalOpen(true)}
                        variant="outline"
                        className="border-purple-500/30 hover:bg-purple-500/10"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Start Space
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* STREAMS TAB */}
            <TabsContent value="streams" className="mt-0">
              {liveStreams && liveStreams.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveStreams.map((stream, index) => (
                    <motion.div
                      key={stream.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <LiveStreamCard
                        stream={stream}
                        onClick={() => handleStreamClick(stream)}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Video}
                  title="No Video Streams"
                  description="Start broadcasting to your audience"
                  actionLabel="Go Live"
                  onAction={() => setCreateStreamModalOpen(true)}
                  gradient="from-red-500 to-pink-500"
                />
              )}
            </TabsContent>

            {/* SPACES TAB */}
            <TabsContent value="spaces" className="mt-0 space-y-8">
              {liveSpaces && liveSpaces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold">Live Now</span>
                  </div>
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

              {endedSpaces && endedSpaces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Play className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Replays</span>
                  </div>
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
                <EmptyState
                  icon={Mic}
                  title="No Audio Spaces"
                  description="Start a conversation with your community"
                  actionLabel="Start Space"
                  onAction={() => setCreateSpaceModalOpen(true)}
                  gradient="from-purple-500 to-indigo-500"
                />
              )}
            </TabsContent>

            {/* SCHEDULED TAB */}
            <TabsContent value="scheduled" className="mt-0 space-y-8">
              {scheduledStreams && scheduledStreams.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Video className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold">Upcoming Streams</span>
                  </div>
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
                  <div className="flex items-center gap-2 mb-4">
                    <Mic className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold">Upcoming Spaces</span>
                  </div>
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
                <EmptyState
                  icon={Calendar}
                  title="No Scheduled Content"
                  description="Schedule your next stream or space"
                  actionLabel="Schedule Now"
                  onAction={() => setCreateStreamModalOpen(true)}
                  gradient="from-blue-500 to-cyan-500"
                />
              )}
            </TabsContent>

            {/* MY CONTENT TAB */}
            <TabsContent value="my-content" className="mt-0 space-y-8">
              {myStreams && myStreams.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Video className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Your Streams</span>
                  </div>
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
                  <div className="flex items-center gap-2 mb-4">
                    <Mic className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Your Spaces</span>
                  </div>
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
                <EmptyState
                  icon={Crown}
                  title="No Content Yet"
                  description="Start creating to build your audience"
                  actionLabel="Create Now"
                  onAction={() => setCreateStreamModalOpen(true)}
                  gradient="from-amber-500 to-orange-500"
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
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

      <BottomNav />
    </>
  );
};

// Empty State Component
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  gradient: string;
}

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction, gradient }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16"
  >
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div className={cn("absolute inset-0 bg-gradient-to-br rounded-full blur-2xl opacity-30", gradient)} />
      <div className="relative w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center border border-border/50">
        <Icon className="w-10 h-10 text-muted-foreground/50" />
      </div>
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-muted-foreground mb-6 max-w-xs mx-auto">{description}</p>
    <Button 
      onClick={onAction}
      className={cn("bg-gradient-to-r text-white shadow-lg", gradient)}
    >
      {actionLabel}
    </Button>
  </motion.div>
);

export default Live;
