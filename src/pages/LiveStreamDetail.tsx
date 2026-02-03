import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Radio } from 'lucide-react';
import { UnifiedRoom } from '@/components/live/unified';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';

const LiveStreamDetail = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { streamId } = useParams<{ streamId: string }>();
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const streamContext = useOptionalLiveStreamContext();

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    if (!user) {
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    if (streamId) {
      loadStream();
    }
  }, [user, authLoading, streamId, navigate]);

  const loadStream = async () => {
    try {
      // Fetch from live_streams table directly (not the view)
      const { data: streamData, error: streamError } = await supabase
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle();

      if (streamError) {
        console.error('Error loading stream:', streamError);
        setLoading(false);
        return;
      }

      if (!streamData) {
        console.log('Stream not found');
        setLoading(false);
        return;
      }

      // Then fetch the profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', streamData.user_id)
        .maybeSingle();

      // Combine the data
      setStream({
        ...streamData,
        profiles: profileData
      });
    } catch (error) {
      console.error('Error loading stream:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Radio className="w-16 h-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">Stream Not Found</h2>
          <p className="text-muted-foreground">This stream may have ended or doesn't exist.</p>
          <Button onClick={() => navigate('/live')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Browse Live Streams
          </Button>
        </div>
      </div>
    );
  }

  if (stream.status !== 'live') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Radio className="w-16 h-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">Stream Ended</h2>
          <p className="text-muted-foreground">This live stream has ended.</p>
          <Button onClick={() => navigate('/live')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Browse Live Streams
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is the host
  const isHost = user?.id === stream.user_id;

  // Build room data for UnifiedRoom
  const roomData = {
    id: stream.id,
    host: {
      id: stream.user_id,
      name: stream.profiles?.display_name || stream.profiles?.username || 'Host',
      handle: stream.profiles?.username ? `@${stream.profiles.username}` : undefined,
      avatar: stream.profiles?.avatar_url || '',
      level: 42, // Could be fetched from user data
    },
    type: (stream.room_type || 'video_broadcast') as 'video_broadcast' | 'audio_space' | 'pk_battle',
    title: stream.title || 'Live Stream',
    description: stream.description,
    viewers: stream.viewer_count || 0,
    status: stream.status as 'scheduled' | 'live' | 'ended',
    startedAt: stream.started_at,
  };

  return (
    <UnifiedRoom
      room={roomData}
      isHost={isHost}
      onClose={() => navigate('/live')}
      onMinimize={() => {
        if (streamContext) {
          streamContext.minimizeStream();
        }
        navigate('/live');
      }}
      onMaximize={() => {
        if (streamContext) {
          streamContext.maximizeStream();
        }
      }}
    />
  );
};

export default LiveStreamDetail;
