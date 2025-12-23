import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LiveSpaceRoom } from '@/components/live/LiveSpaceRoom';
import { Button } from '@/components/ui/button';
import { Mic, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SpaceDetail = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [space, setSpace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRoom, setShowRoom] = useState(false);

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
    setLoading(false);

    // Auto-join if space is live
    if (data.status === 'live' && user) {
      setShowRoom(true);
    }
  };

  const handleJoin = () => {
    if (!user) {
      toast.error('Please sign in to join this space');
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setShowRoom(true);
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
        <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
          <Mic className="w-10 h-10 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">{space?.title}</h1>
          {space?.description && (
            <p className="text-muted-foreground">{space.description}</p>
          )}
        </div>

        {space?.is_private && (
          <div className="flex items-center justify-center gap-2 text-amber-500">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Private Space</span>
          </div>
        )}

        <div className="space-y-2">
          {space?.status === 'live' ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-medium">Live Now</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {space?.viewer_count || 0} people listening
              </p>
            </>
          ) : space?.status === 'scheduled' ? (
            <p className="text-blue-500">Scheduled</p>
          ) : (
            <p className="text-muted-foreground">This space has ended</p>
          )}
        </div>

        {space?.status === 'live' && (
          <Button onClick={handleJoin} size="lg" className="w-full bg-primary">
            Join Space
          </Button>
        )}

        {space?.status === 'ended' && space?.recording_url && (
          <Button onClick={handleJoin} size="lg" variant="outline" className="w-full">
            Listen to Replay
          </Button>
        )}

        <Button variant="ghost" onClick={() => navigate('/live')}>
          Back to Live
        </Button>
      </div>
    </div>
  );
};

export default SpaceDetail;
