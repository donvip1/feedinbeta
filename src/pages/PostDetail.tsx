import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PostCard } from '@/components/feed/PostCard';
import { LoadingScreen } from '@/components/shared/LoadingScreen';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      // Store the current path to redirect back after auth
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/auth');
      return;
    }

    fetchPost();
  }, [user, postId, navigate]);

  const fetchPost = async () => {
    if (!postId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Post not found');
        return;
      }

      setPost(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Post Not Found</h2>
          <p className="text-muted-foreground">{error || 'This post may have been deleted or does not exist.'}</p>
          <Button onClick={() => navigate('/feed')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Post</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-6">
        <PostCard post={post} onUpdate={fetchPost} />
      </div>
    </div>
  );
};

export default PostDetail;
