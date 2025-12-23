import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LiveSpaceRoom } from '@/components/live/LiveSpaceRoom';
import { SpaceReplayPlayer } from '@/components/live/SpaceReplayPlayer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mic, Lock, Loader2, Users, Play, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const SpaceDetail = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [space, setSpace] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRoom, setShowRoom] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  useEffect(() => {
    if (spaceId) {
      fetchSpace();
    }
  }, [spaceId]);

  const fetchSpace = async () => {
    // Try to find by share_link or id
    let query = supabase.from('live_spaces').select('*');
    
    // Check if it's a UUID or share_link
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(spaceId || '');
    
    if (isUUID) {
      query = query.eq('id', spaceId);
    } else {
      query = query.eq('share_link', spaceId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      toast.error('Space not found');
      navigate('/live');
      return;
    }

    setSpace(data);

    // Fetch host profile
    const { data: hostData } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', data.user_id)
      .single();
    
    if (hostData) {
      setHost(hostData);
    }

    setLoading(false);

    // Auto-join if space is live and user is authenticated
    if (data.status === 'live' && user) {
      setShowRoom(true);
    }
  };

  const handleJoin = () => {
    if (!user) {
      toast.error('Please sign in to join this space');
      // Store redirect in sessionStorage as backup
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setShowRoom(true);
  };

  const handleReplay = () => {
    if (!user) {
      toast.error('Please sign in to listen to this replay');
      // Store redirect in sessionStorage as backup
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setShowReplay(true);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading space...</p>
        </div>
      </div>
    );
  }

  // Show replay player
  if (showReplay && space) {
    return (
      <SpaceReplayPlayer 
        spaceId={space.id} 
        onClose={() => {
          setShowReplay(false);
          navigate('/live');
        }} 
      />
    );
  }

  // Show live room
  if (showRoom && space) {
    return (
      <LiveSpaceRoom 
        spaceId={space.id} 
        onClose={() => {
          setShowRoom(false);
          navigate('/live');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon or Host Avatar */}
        <div className="relative mx-auto w-fit">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            {host?.avatar_url ? (
              <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                <AvatarImage src={host.avatar_url} />
                <AvatarFallback>{host.display_name?.[0] || 'H'}</AvatarFallback>
              </Avatar>
            ) : (
              <Mic className="w-10 h-10 text-primary" />
            )}
          </div>
          {space?.status === 'live' && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
            </span>
          )}
        </div>

        {/* Space Info */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{space?.title}</h1>
          {space?.description && (
            <p className="text-muted-foreground text-sm">{space.description}</p>
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

        {/* Badges and Meta */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {space?.topic_category && (
            <Badge variant="secondary">{space.topic_category}</Badge>
          )}
          {space?.is_private && (
            <Badge variant="outline" className="text-amber-500 border-amber-500">
              <Lock className="w-3 h-3 mr-1" />
              Private
            </Badge>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          {space?.status === 'live' ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-medium">Live Now</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{space?.viewer_count || 0} listening</span>
              </div>
            </>
          ) : space?.status === 'scheduled' ? (
            <div className="space-y-1">
              <Badge variant="outline" className="text-blue-500 border-blue-500">
                <Clock className="w-3 h-3 mr-1" />
                Scheduled
              </Badge>
              {space?.scheduled_start && (
                <p className="text-sm text-muted-foreground">
                  Starts {formatDistanceToNow(new Date(space.scheduled_start), { addSuffix: true })}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-muted-foreground">This space has ended</p>
              {space?.ended_at && (
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}
                </p>
              )}
              {space?.peak_viewers && (
                <p className="text-sm text-muted-foreground">
                  {space.peak_viewers} peak listeners
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {space?.status === 'live' && (
            <Button onClick={handleJoin} size="lg" className="w-full">
              <Mic className="w-4 h-4 mr-2" />
              Join Space
            </Button>
          )}

          {space?.status === 'ended' && space?.recording_url && (
            <Button onClick={handleReplay} size="lg" className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Listen to Replay
            </Button>
          )}

          {space?.status === 'ended' && !space?.recording_url && (
            <p className="text-sm text-muted-foreground">No recording available</p>
          )}

          <Button variant="ghost" onClick={() => navigate('/live')} className="w-full">
            Back to Live
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpaceDetail;
