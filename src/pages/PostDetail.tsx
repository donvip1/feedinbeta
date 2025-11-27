import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/feed/PostCard';
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
      <div className="min-h-screen bg-background pb-16">
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Post</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <PostCard
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
