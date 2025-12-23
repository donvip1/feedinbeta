import { useState, useEffect } from 'react';
import { BottomNav } from "@/components/navigation/BottomNav";
import { Bookmark } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import PostCard from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';

const SavedPosts = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSavedPosts();
    }
  }, [user]);

  const loadSavedPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_posts')
        .select(`
          id,
          created_at,
          post_id,
          posts (
            id,
            user_id,
            content,
            media_url,
            media_type,
            created_at,
            likes_count,
            comments_count,
            views_count,
            location,
            profiles (
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const posts = data?.map(item => item.posts).filter(Boolean) || [];
      setSavedPosts(posts);
    } catch (error) {
      console.error('Error loading saved posts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
        <PageHeader 
          title="Saved Posts" 
          icon={<Bookmark className="w-5 h-5" />}
        />
        
        <div className="container mx-auto px-4 py-6 max-w-2xl">

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-96 w-full rounded-xl" />
              ))}
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <Bookmark className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">No saved posts yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Save posts to view them here later
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedPosts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post}
                  onLikeUpdate={loadSavedPosts}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default SavedPosts;
