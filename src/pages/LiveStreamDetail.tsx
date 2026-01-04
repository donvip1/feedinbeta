import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Radio } from 'lucide-react';
import { SimpleViewer } from '@/components/live/SimpleViewer';

const LiveStreamDetail = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { streamId } = useParams<{ streamId: string }>();
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      // Query from live_streams_public view - accessible to all users
      const { data, error } = await supabase
        .from('live_streams_public')
        .select('*, profiles:user_id (id, display_name, username, avatar_url)')
        .eq('id', streamId)
        .maybeSingle();

      if (error) throw error;
      setStream(data);
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

  return (
    <SimpleViewer
      streamId={streamId!}
      onClose={() => navigate('/live')}
    />
  );
};

export default LiveStreamDetail;
