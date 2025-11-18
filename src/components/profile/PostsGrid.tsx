import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
  content: string | null;
}

interface PostsGridProps {
  userId: string;
}

export const PostsGrid = ({ userId }: PostsGridProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPosts();
  }, [userId]);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, content')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-1 max-h-[360px] overflow-y-auto">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No posts yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-1 max-h-[360px] overflow-y-auto rounded-lg border border-border p-2 bg-card/30">
      {posts.map((post) => (
        <div
          key={post.id}
          onClick={() => navigate('/feed', { state: { postId: post.id } })}
          className="aspect-square bg-muted rounded cursor-pointer hover:opacity-80 transition relative overflow-hidden group"
        >
          {post.media_url && post.media_type === 'image' && (
            <img 
              src={post.media_url} 
              alt="Post" 
              className="w-full h-full object-cover"
            />
          )}
          {post.media_url && post.media_type === 'video' && (
            <>
              <video 
                src={post.media_url} 
                className="w-full h-full object-cover"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition">
                <Play className="w-6 h-6 text-white" />
              </div>
            </>
          )}
          {!post.media_url && post.content && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 p-2">
              <p className="text-white text-[10px] text-center line-clamp-4 font-medium">
                {post.content}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
