import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/feed/PostCard';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';

const HashtagSearch = () => {
  const navigate = useNavigate();
  const { hashtag } = useParams();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hashtag) {
      loadHashtagPosts();
    }
  }, [hashtag]);

  const loadHashtagPosts = async () => {
    if (!hashtag) return;

    setLoading(true);
    try {
      // First get the hashtag ID
      const { data: hashtagData } = await supabase
        .from('hashtags')
        .select('id')
        .eq('name', hashtag.toLowerCase())
        .single();

      if (!hashtagData) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Get posts with this hashtag
      const { data: postHashtags } = await supabase
        .from('post_hashtags')
        .select('post_id')
        .eq('hashtag_id', hashtagData.id);

      const postIds = postHashtags?.map(ph => ph.post_id) || [];

      if (postIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .in('id', postIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setPosts(postsData || []);
    } catch (error) {
      console.error('Error loading hashtag posts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">#{hashtag}</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-4 max-w-2xl">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-96 w-full rounded-lg" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts found with this hashtag</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default HashtagSearch;
