import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Eye } from 'lucide-react';

interface StoryViewersListProps {
  storyId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const StoryViewersList = ({ storyId, isOpen, onClose }: StoryViewersListProps) => {
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadViewers();
    }
  }, [isOpen, storyId]);

  const loadViewers = async () => {
    try {
      const { data, error } = await supabase
        .from('story_views')
        .select(`
          *,
          viewer:profiles!story_views_user_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false });

      if (error) throw error;
      setViewers(data || []);
    } catch (error) {
      console.error('Error loading viewers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b">
            <Eye className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Viewed by {viewers.length}</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : viewers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No views yet</p>
            ) : (
              viewers.map((view) => (
                <div key={view.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={view.viewer?.avatar_url || ''} />
                      <AvatarFallback>{view.viewer?.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{view.viewer?.display_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">@{view.viewer?.username || 'user'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(view.viewed_at), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
