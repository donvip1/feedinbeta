import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreateLiveStreamModal } from "@/components/live/CreateLiveStreamModal";
import { CreateSpaceModal } from "@/components/live/CreateSpaceModal";
import { UnifiedLiveRoom } from "@/components/live/UnifiedLiveRoom";
import { LiveDashboard } from "@/components/live/LiveDashboard";
import { GoLiveModal } from "@/components/live/GoLiveModal";
import { SpaceContentManager } from "@/components/live/SpaceContentManager";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { RoomInfo, ParticipantRole } from "@/context/UnifiedLiveContext";

interface SelectedRoom {
  roomInfo: RoomInfo;
  role: ParticipantRole;
}

const Live = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [createStreamModalOpen, setCreateStreamModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [showContentManager, setShowContentManager] = useState(false);

  // ===== VIDEO STREAMS QUERIES =====
  const { data: liveStreams, refetch: refetchLiveStreams, isLoading: loadingLiveStreams } = useQuery({
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
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
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
    enabled: !!user,
  });

  // ===== AUDIO SPACES QUERIES =====
  const { data: liveSpaces, refetch: refetchLiveSpaces, isLoading: loadingLiveSpaces } = useQuery({
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
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const { data: listenerCounts } = await supabase
          .from("live_space_speakers")
          .select("space_id")
          .in("space_id", spaceIds)
          .is("left_at", null);
        
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
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  const { data: joinedSpaceIds } = useQuery({
    queryKey: ["joined-spaces", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("live_space_speakers")
        .select("space_id")
        .eq("user_id", user.id)
        .is("left_at", null);
      return data?.map(s => s.space_id) || [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 5000,
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
    enabled: !!user,
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
        refetchLiveSpaces();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streamsChannel);
      supabase.removeChannel(spacesChannel);
    };
  }, [refetchLiveStreams, refetchMyStreams, refetchLiveSpaces, refetchMySpaces]);

  // ===== HANDLERS =====
  const handleStreamCreated = (streamId: string) => {
    // Find the newly created stream and open it
    refetchMyStreams().then(({ data }) => {
      const stream = data?.find((s: any) => s.id === streamId);
      if (stream) {
        openRoom(stream, 'video_broadcast', 'host');
      }
    });
  };

  const handleSpaceCreated = (spaceId: string) => {
    refetchMySpaces().then(({ data }) => {
      const space = data?.find((s: any) => s.id === spaceId);
      if (space) {
        openRoom(space, 'audio_space', 'host');
      }
    });
  };

  const openRoom = (item: any, type: 'video_broadcast' | 'audio_space', role: ParticipantRole) => {
    const roomInfo: RoomInfo = {
      id: item.id,
      title: item.title,
      type,
      hostId: item.user_id,
      hostName: item.profiles?.display_name || item.profiles?.username || 'Host',
      hostAvatar: item.profiles?.avatar_url || '',
      startedAt: item.started_at,
    };
    setSelectedRoom({ roomInfo, role });
  };

  const handleStreamClick = (stream: any) => {
    const isMyStream = stream.user_id === user?.id;
    openRoom(stream, 'video_broadcast', isMyStream ? 'host' : 'viewer');
  };

  const handleSpaceClick = (space: any) => {
    if (space.status === 'live' || space.status === 'ended') {
      // Navigate to SpaceDetail which uses the new TwitterSpaceRoom UI
      navigate(`/live/space/${space.id}`);
    }
  };

  // Render unified room if selected
  if (selectedRoom) {
    return (
      <UnifiedLiveRoom
        roomInfo={selectedRoom.roomInfo}
        role={selectedRoom.role}
        onClose={() => setSelectedRoom(null)}
      />
    );
  }

  return (
    <>
      {/* Modern Live Dashboard */}
      <LiveDashboard
        liveStreams={liveStreams}
        liveSpaces={liveSpaces}
        scheduledStreams={scheduledStreams}
        scheduledSpaces={scheduledSpaces}
        myStreams={myStreams}
        mySpaces={mySpaces}
        user={user}
        onStreamClick={handleStreamClick}
        onSpaceClick={handleSpaceClick}
        onGoLive={() => setShowGoLiveModal(true)}
        onVideoStream={() => setCreateStreamModalOpen(true)}
        onAudioSpace={() => setCreateSpaceModalOpen(true)}
        isLoading={loadingLiveStreams || loadingLiveSpaces}
        myActiveStream={myStreams?.find((s: any) => s.status === 'live')}
        myActiveSpace={mySpaces?.find((s: any) => s.status === 'live')}
      />

      {/* Go Live Modal */}
      <GoLiveModal
        open={showGoLiveModal}
        onClose={() => setShowGoLiveModal(false)}
        onVideoStream={() => setCreateStreamModalOpen(true)}
        onAudioSpace={() => setCreateSpaceModalOpen(true)}
      />

      {/* Create Modals */}
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

      <SpaceContentManager
        isOpen={showContentManager}
        onClose={() => setShowContentManager(false)}
        onDeleted={() => {
          refetchMySpaces();
        }}
      />
    </>
  );
};

export default Live;
