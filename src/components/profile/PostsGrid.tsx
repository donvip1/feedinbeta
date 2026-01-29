import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Play, Trash2, Eye, ExternalLink } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Threshold in pixels - if touch moves more than this, it's a scroll not a tap
const TAP_THRESHOLD = 10;

export const PostsGrid = ({ userId }: PostsGridProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isOwnProfile = user?.id === userId;
  
  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isTapRef = useRef(false);

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
    if (!deletePostId || !user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ 
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq('id', deletePostId)
        .eq('user_id', user.id);

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== deletePostId));
      
      toast({
        title: "Post deleted",
        description: "Your post has been permanently removed.",
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

  // Touch handlers for tap detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isTapRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // If moved more than threshold, it's a scroll not a tap
    if (deltaX > TAP_THRESHOLD || deltaY > TAP_THRESHOLD) {
      isTapRef.current = false;
    }
  }, []);

  const handleTouchEnd = useCallback((postId: string) => {
    if (isTapRef.current && touchStartRef.current) {
      // It was a tap, open the menu
      setOpenMenuPostId(postId);
    }
    touchStartRef.current = null;
    isTapRef.current = false;
  }, []);

  // For mouse clicks (desktop), always open menu
  const handleClick = useCallback((e: React.MouseEvent, postId: string) => {
    // Prevent if it was a touch event (handled by touch handlers)
    if (touchStartRef.current !== null) return;
    setOpenMenuPostId(postId);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[480px] overflow-y-auto">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
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
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[480px] overflow-y-auto rounded-lg border border-border p-2 bg-card/30">
        {posts.map((post) => (
          <DropdownMenu 
            key={post.id} 
            open={openMenuPostId === post.id}
            onOpenChange={(open) => {
              if (!open) setOpenMenuPostId(null);
            }}
          >
            <DropdownMenuTrigger asChild>
              <div
                className="aspect-square bg-muted rounded-lg cursor-pointer hover:opacity-90 transition relative overflow-hidden group"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => handleTouchEnd(post.id)}
                onClick={(e) => handleClick(e, post.id)}
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
                      <Play className="w-8 h-8 text-white" />
                    </div>
                  </>
                )}
                {!post.media_url && post.content && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 p-3">
                    <p className="text-white text-xs text-center line-clamp-4 font-medium">
                      {post.content}
                    </p>
                  </div>
                )}
                
                {/* View count badge */}
                {post.views_count !== null && post.views_count > 0 && (
                  <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {post.views_count}
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="center" 
              className="bg-background border-border z-50 min-w-[160px]"
            >
              <DropdownMenuItem 
                onClick={() => navigate(`/feed/post/${post.id}`)}
                className="cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Post
              </DropdownMenuItem>
              {isOwnProfile && (
                <DropdownMenuItem 
                  onClick={() => setDeletePostId(post.id)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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