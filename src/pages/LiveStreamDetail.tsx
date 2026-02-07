import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Loader2, Video, Users, Play, Lock, Clock } from 'lucide-react';
import { TwitterStreamRoom } from '@/components/live/twitter-space';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const LiveStreamDetail = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { streamId } = useParams<{ streamId: string }>();
  const [stream, setStream] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRoom, setShowRoom] = useState(false);
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

  // Check if we're returning from minimized state
  useEffect(() => {
    if (streamContext && streamContext.streamState.isActive && !streamContext.streamState.isMinimized) {
      const activeStreamId = streamContext.streamState.streamInfo?.id;
      if (activeStreamId === streamId || (stream && activeStreamId === stream.id)) {
        console.log('[LiveStreamDetail] Already in this stream, showing room directly');
        setShowRoom(true);
        setLoading(false);
      }
    }
  }, [streamContext?.streamState.isActive, streamContext?.streamState.isMinimized, streamId, stream?.id]);

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

      setStream(streamData);
      setHost(profileData);
    } catch (error) {
      console.error('Error loading stream:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (!user) {
      toast.error('Please sign in to join this stream');
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setShowRoom(true);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
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

  // Show live room with new Twitter-style UI
  if (showRoom && stream) {
    return (
      <TwitterStreamRoom 
        streamId={stream.id} 
        onClose={() => {
          setShowRoom(false);
          navigate('/live');
        }} 
      />
    );
  }

  // Check if user is the host
  const isHost = user?.id === stream.user_id;

  // Preview page for streams (similar to SpaceDetail)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Host Avatar */}
        <div className="relative mx-auto w-fit">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            {host?.avatar_url ? (
              <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                <AvatarImage src={host.avatar_url} />
                <AvatarFallback>{host.display_name?.[0] || 'H'}</AvatarFallback>
              </Avatar>
            ) : (
              <Video className="w-10 h-10 text-primary" />
            )}
          </div>
          {stream?.status === 'live' && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
            </span>
          )}
        </div>

        {/* Stream Info */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{stream?.title}</h1>
          {stream?.description && (
            <p className="text-muted-foreground text-sm">{stream.description}</p>
          )}
          
          {/* Host info */}
          {host && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Hosted by</span>
              <span className="text-sm font-medium">{host.display_name}</span>
              <span className="text-sm text-muted-foreground">@{host.username}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {stream?.category && (
            <Badge variant="secondary">{stream.category}</Badge>
          )}
          {stream?.room_type && (
            <Badge variant="outline">{stream.room_type.replace('_', ' ')}</Badge>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          {stream?.status === 'live' ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-medium">Live Now</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{stream?.viewer_count || 0} watching</span>
              </div>
            </>
          ) : stream?.status === 'scheduled' ? (
            <div className="space-y-1">
              <Badge variant="outline" className="text-blue-500 border-blue-500">
                <Clock className="w-3 h-3 mr-1" />
                Scheduled
              </Badge>
              {stream?.scheduled_start && (
                <p className="text-sm text-muted-foreground">
                  Starts {formatDistanceToNow(new Date(stream.scheduled_start), { addSuffix: true })}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-muted-foreground">This stream has ended</p>
              {stream?.ended_at && (
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(stream.ended_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {stream?.status === 'live' && (
            <Button onClick={handleJoin} size="lg" className="w-full">
              <Video className="w-4 h-4 mr-2" />
              {isHost ? 'Return to Stream' : 'Join Stream'}
            </Button>
          )}

          {stream?.status === 'ended' && (
            <p className="text-sm text-muted-foreground">Stream has ended</p>
          )}

          <Button variant="ghost" onClick={() => navigate('/live')} className="w-full">
            Back to Live
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamDetail;
