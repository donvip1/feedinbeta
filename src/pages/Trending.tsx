import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/navigation/BottomNav';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';

const TrendingContent = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('status', 'active')
        .order('likes_count', { ascending: false })
        .order('views_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card rounded-lg p-4 border">
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trending posts yet</p>
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
};

const Trending = () => {
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => navigate('/feed')}
                  variant="ghost"
                  size="icon"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Trending
                </h1>
              </div>
            </div>
          </div>
        </header>

        <TrendingContent />
      </div>
      <BottomNav />
    </>
  );
};

export default Trending;
