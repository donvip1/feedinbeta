import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { StoryViewer } from '@/components/stories/StoryViewer';

const StoryDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allUserStories, setAllUserStories] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/welcome');
      return;
    }
    if (storyId) {
      loadStory();
    }
  }, [user, storyId, navigate]);

  const loadStory = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('id', storyId)
        .maybeSingle();

      if (error) throw error;
      setStory(data);
      
      // Create user stories format expected by StoryViewer
      if (data) {
        const userStories = [{
          user_id: data.user_id,
          user: {
            display_name: data.profiles?.display_name || 'User',
            username: data.profiles?.username || 'user',
            avatar_url: data.profiles?.avatar_url
          },
          stories: [data],
          has_viewed: false
        }];
        setAllUserStories(userStories);
      }
    } catch (error) {
      console.error('Error loading story:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="w-full max-w-md h-[80vh] rounded-xl" />
      </div>
    );
  }

  if (!story || allUserStories.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Story Not Found</h2>
          <p className="text-muted-foreground">This story may have expired or doesn't exist.</p>
          <Button onClick={() => navigate('/feed')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StoryViewer
      userId={story.user_id}
      allUserStories={allUserStories}
      onClose={() => navigate(-1)}
      onStoryChange={() => {}}
    />
  );
};

export default StoryDetail;
