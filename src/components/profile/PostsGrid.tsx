import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Play, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
  content: string | null;
  views_count: number | null;
}

interface PostsGridProps {
  userId: string;
}

export const PostsGrid = ({ userId }: PostsGridProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    loadPosts();
  }, [userId]);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, content, views_count')
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

  const handleDeletePost = async () => {
    if (!deletePostId) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'deleted' })
        .eq('id', deletePostId);

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== deletePostId));
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletePostId(null);
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
    <>
      <div className="grid grid-cols-5 gap-1 max-h-[360px] overflow-y-auto rounded-lg border border-border p-2 bg-card/30">
        {posts.map((post) => (
          <div
            key={post.id}
            className="aspect-square bg-muted rounded cursor-pointer hover:opacity-80 transition relative overflow-hidden group"
          >
            <div onClick={() => navigate(`/feed/post/${post.id}`)}>
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
              
              {/* View count badge */}
              {post.views_count !== null && post.views_count > 0 && (
                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Eye className="w-2.5 h-2.5" />
                  {post.views_count}
                </div>
              )}
            </div>

            {/* Delete Button - Only for own profile */}
            {isOwnProfile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletePostId(post.id);
                }}
                className="absolute top-1 right-1 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
