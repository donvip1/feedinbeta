import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Play, Clock, Users, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PastSpace {
  id: string;
  title: string;
  description: string | null;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  recording_url: string | null;
  cover_image_url: string | null;
  user_id: string;
}

interface PastSpacesProps {
  userId: string;
}

export const PastSpaces = ({ userId }: PastSpacesProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<PastSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isOwner = user?.id === userId;

  useEffect(() => {
    const fetchPastSpaces = async () => {
      const { data } = await supabase
        .from('live_spaces')
        .select('id, title, description, started_at, ended_at, viewer_count, recording_url, cover_image_url, user_id')
        .eq('user_id', userId)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(10);

      setSpaces(data || []);
      setLoading(false);
    };

    fetchPastSpaces();
  }, [userId]);

  const handleDelete = async (e: React.MouseEvent, spaceId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this recorded space permanently?')) return;
    setDeletingId(spaceId);
    try {
      await supabase.from('live_space_messages').delete().eq('space_id', spaceId);
      await supabase.from('live_space_reactions').delete().eq('space_id', spaceId);
      await supabase.from('live_space_gifts').delete().eq('space_id', spaceId);
      await supabase.from('live_space_speakers').delete().eq('space_id', spaceId);
      const { error } = await supabase.from('live_spaces').delete().eq('id', spaceId);
      if (error) throw error;
      setSpaces(prev => prev.filter(s => s.id !== spaceId));
      toast.success('Space deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || spaces.length === 0) return null;

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <Mic className="w-5 h-5 text-primary" />
        Past Spaces ({spaces.length})
      </h3>
      <div className="space-y-3">
        {spaces.map((space) => (
          <div
            key={space.id}
            onClick={() => navigate(`/live/space/${space.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left cursor-pointer"
          >
            {/* Cover or icon */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              {space.cover_image_url ? (
                <img src={space.cover_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Mic className="w-6 h-6 text-muted-foreground" />
              )}
              {space.recording_url && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{space.title}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                {space.ended_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}
                  </span>
                )}
                {getDuration(space.started_at, space.ended_at) && (
                  <span>{getDuration(space.started_at, space.ended_at)}</span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {space.viewer_count}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {space.recording_url && (
                <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                  Replay
                </div>
              )}
              {isOwner && (
                <button
                  onClick={(e) => handleDelete(e, space.id)}
                  disabled={deletingId === space.id}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className={cn("w-4 h-4 text-destructive/60", deletingId === space.id && "animate-spin")} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
