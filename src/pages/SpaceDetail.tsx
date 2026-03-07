import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOptionalSpaceContext } from '@/context/SpaceContext';
import { TwitterSpaceRoom } from '@/components/live/twitter-space';
import { SpaceReplayPlayer } from '@/components/live/SpaceReplayPlayer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mic, Lock, Loader2, Users, Play, Clock, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
import { useQuery } from '@tanstack/react-query';

const ListenerCount = ({ spaceId, fallback }: { spaceId: string; fallback: number }) => {
  const { data: count } = useQuery({
    queryKey: ['space-listener-count', spaceId],
    queryFn: async () => {
      const { count } = await supabase
        .from('live_space_speakers')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .is('left_at', null);
      return count || 0;
    },
    enabled: !!spaceId,
    refetchInterval: 5000,
  });

  return (
    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
      <Users className="w-4 h-4" />
      <span>{count ?? fallback} listening</span>
    </div>
  );
};

const SpaceDetail = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const spaceContext = useOptionalSpaceContext();
  const [space, setSpace] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRoom, setShowRoom] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  const returningFromMinimize = (location.state as any)?.returningFromMinimize;

  // Check if we're returning from minimized state - run BEFORE fetch
  useEffect(() => {
    if (!spaceContext || !spaceContext.spaceState.isActive) return;
    
    const activeSpaceId = spaceContext.spaceState.spaceInfo?.id;
    
    // If returning from minimize via FloatingSpacePlayer, show room immediately
    if (returningFromMinimize) {
      if (activeSpaceId === spaceId || (space && activeSpaceId === space.id)) {
        console.log('[SpaceDetail] Returning from minimize, showing room immediately');
        setShowRoom(true);
        setLoading(false);
        return;
      }
    }
    
    // If we're actively in this space (context is active, not minimized, OR even minimized),
    // always show the room - prevents getting kicked to lobby on remounts/reloads
    if (activeSpaceId === spaceId || (space && activeSpaceId === space.id)) {
      console.log('[SpaceDetail] Active space matches, showing room directly');
      setShowRoom(true);
      setLoading(false);
    }
  }, [spaceContext?.spaceState.isActive, spaceContext?.spaceState.isMinimized, spaceId, space?.id, returningFromMinimize]);

  useEffect(() => {
    if (spaceId) {
      console.log('[SpaceDetail] Loading space:', spaceId);
      fetchSpace();
    }
  }, [spaceId]);

  // Auto-join when autoJoin state is set (from dashboard click or host creation)
  useEffect(() => {
    const autoJoin = (location.state as any)?.autoJoin;
    if (autoJoin && space && user && !showRoom) {
      console.log('[SpaceDetail] Auto-joining space');
      audioPlaybackManager.enableAudioPlayback();
      setShowRoom(true);
    }
  }, [space, user, location.state, showRoom]);

  // Set OG meta tags for social sharing
  useEffect(() => {
    if (!space) return;
    const ogImage = space.cover_image_url || `${window.location.origin}/favicon.png`;
    const ogTitle = space.title || 'Live Space on FeedIn';
    const ogDesc = space.description || `Join this live space on FeedIn`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    document.title = ogTitle;
    setMeta('og:title', ogTitle);
    setMeta('og:description', ogDesc);
    setMeta('og:image', ogImage);
    setMeta('og:url', window.location.href);
    setMeta('og:type', 'website');

    return () => { document.title = 'FeedIn'; };
  }, [space]);

  const fetchSpace = async () => {
    console.log('[SpaceDetail] Fetching space with ID:', spaceId);
    
    // Try to find by share_link or id
    let query = supabase.from('live_spaces').select('*');
    
    // Check if it's a UUID or share_link
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(spaceId || '');
    
    if (isUUID) {
      query = query.eq('id', spaceId);
    } else {
      query = query.eq('share_link', spaceId);
    }

    const { data, error } = await query.maybeSingle();

    console.log('[SpaceDetail] Space fetch result:', { data, error });

    if (error) {
      console.error('[SpaceDetail] Error fetching space:', error);
      toast.error('Error loading space');
      navigate('/live');
      return;
    }
    
    if (!data) {
      toast.error('Space not found');
      navigate('/live');
      return;
    }

    console.log('[SpaceDetail] Space loaded:', data.title, 'Status:', data.status);
    setSpace(data);

    // Fetch host profile
    const { data: hostData, error: hostError } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', data.user_id)
      .single();
    
    if (hostError) {
      console.error('[SpaceDetail] Error fetching host:', hostError);
    }
    
    if (hostData) {
      setHost(hostData);
    }

    setLoading(false);
    // Note: Auto-join is now handled by a separate useEffect
  };

  const handleJoin = () => {
    if (!user) {
      toast.error('Please sign in to join this space');
      // Store redirect in sessionStorage as backup
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    
    // CRITICAL: Enable audio playback BEFORE showing room
    // User clicking "Join Space" is a valid user interaction
    audioPlaybackManager.enableAudioPlayback();
    console.log('[SpaceDetail] 🔊 Audio playback enabled on join');
    
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

  // If we have an active space context for this space, skip lobby entirely
  const isActiveInContext = spaceContext?.spaceState.isActive && 
    (spaceContext.spaceState.spaceInfo?.id === spaceId || 
     spaceContext.spaceState.spaceInfo?.id === space?.id);

  if ((loading || authLoading) && !isActiveInContext) {
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
          navigate('/live', { state: { tab: 'Replays' } });
        }} 
      />
    );
  }

  // Show live room with new Twitter-style UI
  if (showRoom && space) {
    return (
      <TwitterSpaceRoom 
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
        {/* Cover Image Preview */}
        {space?.cover_image_url && (
          <div className="w-full rounded-2xl overflow-hidden border border-border">
            <img 
              src={space.cover_image_url} 
              alt={space.title} 
              className="w-full h-40 object-cover"
            />
          </div>
        )}

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
              {user && space?.user_id === user.id ? (
                <span className="text-sm font-medium text-primary">You're hosting this space</span>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">Hosted by</span>
                  <span className="text-sm font-medium">{host.display_name}</span>
                  <span className="text-sm text-muted-foreground">@{host.username}</span>
                </>
              )}
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
              <ListenerCount spaceId={space?.id} fallback={space?.viewer_count || 0} />
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
              {user && space?.user_id === user.id ? (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Return to Your Space
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Join Space
                </>
              )}
            </Button>
          )}

          {space?.status === 'ended' && space?.recording_url && (
            <>
              <Button onClick={handleReplay} size="lg" className="w-full">
                <Play className="w-4 h-4 mr-2" />
                Listen to Replay
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/live/space/${space?.share_link || spaceId}`;
                  if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                    try {
                      await navigator.share({
                        title: space?.title || 'Space Replay',
                        text: `Listen to this space replay: ${space?.title}`,
                        url: shareUrl,
                      });
                      return;
                    } catch (e: any) {
                      if (e?.name === 'AbortError') return;
                    }
                  }
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success('Replay link copied!');
                  } catch {
                    toast.error('Could not copy link');
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Replay
              </Button>
            </>
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
