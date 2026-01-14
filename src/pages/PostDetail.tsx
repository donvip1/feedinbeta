import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ImmersivePostCard from '@/components/feed/ImmersivePostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

const PostDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { postId: id } = useParams<{ postId: string }>();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('No post ID provided');
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url
          ),
          original_post:original_post_id (
            id,
            user_id,
            content,
            media_url,
            media_type,
            media_urls,
            media_types,
            created_at,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Post not found');
      return data;
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/welcome');
    }
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Post Not Found</h2>
          <p className="text-muted-foreground">This post may have been deleted or doesn't exist.</p>
          <Button onClick={() => navigate('/feed')}>
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Fullscreen immersive post - no back button needed, users can use device back gestures */}
      <div className="h-screen w-full">
        <ImmersivePostCard
          post={post}
          allPosts={[post]}
          onLikeUpdate={() => {}}
          onCommentsOpenChange={setIsCommentsOpen}
          onInteractionStart={() => {}}
          onInteractionEnd={() => {}}
        />
      </div>
    </div>
  );
};

export default PostDetail;
