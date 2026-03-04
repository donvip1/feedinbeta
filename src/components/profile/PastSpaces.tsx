import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Play, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PastSpace {
  id: string;
  title: string;
  description: string | null;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  recording_url: string | null;
  cover_image_url: string | null;
}

interface PastSpacesProps {
  userId: string;
}

export const PastSpaces = ({ userId }: PastSpacesProps) => {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<PastSpace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPastSpaces = async () => {
      const { data } = await supabase
        .from('live_spaces')
        .select('id, title, description, started_at, ended_at, viewer_count, recording_url, cover_image_url')
        .eq('user_id', userId)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(10);

      setSpaces(data || []);
      setLoading(false);
    };

    fetchPastSpaces();
  }, [userId]);

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
          <button
            key={space.id}
            onClick={() => navigate(`/live/space/${space.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
          >
            {/* Cover or icon */}
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
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

            {space.recording_url && (
              <div className="flex-shrink-0 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                Replay
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
