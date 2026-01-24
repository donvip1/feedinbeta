import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ImmersivePostCard from '@/components/feed/ImmersivePostCard';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PostDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { postId: id } = useParams<{ postId: string }>();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [globalMuted, setGlobalMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToPost = useRef(false);

  // First, get the clicked post to know the user_id
  const { data: clickedPost, isLoading: isLoadingPost } = useQuery({
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

  // Then fetch ALL posts from that user
  const { data: userPosts, isLoading: isLoadingUserPosts } = useQuery({
    queryKey: ['user-posts-feed', clickedPost?.user_id],
    queryFn: async () => {
      if (!clickedPost?.user_id) throw new Error('No user ID');
      
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
        .eq('user_id', clickedPost.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clickedPost?.user_id,
  });

  // Find the index of the clicked post to scroll to it
  const clickedPostIndex = useMemo(() => {
    if (!userPosts || !id) return 0;
    const index = userPosts.findIndex(p => p.id === id);
    return index >= 0 ? index : 0;
  }, [userPosts, id]);

  // Scroll to the clicked post when posts are loaded
  useEffect(() => {
    if (userPosts && userPosts.length > 0 && containerRef.current && !hasScrolledToPost.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const postHeight = window.innerHeight;
        containerRef.current?.scrollTo({
          top: clickedPostIndex * postHeight,
          behavior: 'instant'
        });
        hasScrolledToPost.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [userPosts, clickedPostIndex]);

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/welcome');
    }
  }, [user, navigate]);

  const handleBack = () => {
    // Use replace: true to remove PostDetail from history stack
    // This way, when user clicks back from Profile, they go to Feed (not back to PostDetail)
    if (clickedPost?.profiles?.username) {
      navigate(`/profile/${clickedPost.profiles.username}`, { replace: true });
    } else if (clickedPost?.user_id) {
      navigate(`/profile/${clickedPost.user_id}`, { replace: true });
    } else {
      navigate('/feed', { replace: true });
    }
  };

  const toggleGlobalMute = () => {
    setGlobalMuted(prev => !prev);
  };

  const isLoading = isLoadingPost || isLoadingUserPosts;
  const posts = userPosts || [];
  const profileName = clickedPost?.profiles?.display_name || clickedPost?.profiles?.username || 'User';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!clickedPost || posts.length === 0) {
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
      {/* Fixed Back Button - Always visible */}
      <div className={cn(
        "fixed top-4 left-4 z-[60] transition-opacity duration-200",
        isImmersiveMode ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* User's Posts Header - Hidden in immersive mode */}
      {!isImmersiveMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
          <div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm">
            <span className="text-white text-sm font-medium">{profileName}'s Posts</span>
          </div>
        </div>
      )}

      {/* Immersive mode close button */}
      {isImmersiveMode && (
        <div className="fixed top-4 left-4 z-[60]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsImmersiveMode(false)}
            className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Scrollable Feed Container - Same as main Feed.tsx */}
      <div
        ref={containerRef}
        className={cn(
          "w-full mx-auto snap-y snap-mandatory overflow-y-scroll scroll-smooth native-scroll-container relative",
          isImmersiveMode ? "h-[100dvh] fixed inset-0 z-50 bg-black" : "h-[100dvh]"
        )}
        data-scrollable="true"
      >
        {posts.map((post, index) => {
          const uniqueKey = `${post.id}-${index}`;
          
          return (
            <div key={uniqueKey} className="snap-start snap-always">
              <ImmersivePostCard
                post={post}
                isPromoted={false}
                onCommentsOpenChange={setIsCommentsOpen}
                onInteractionStart={() => {}}
                onInteractionEnd={() => {}}
                onView={() => {}}
                allPosts={posts}
                onMarkAsViewed={() => {}}
                globalMuted={globalMuted}
                onGlobalMuteToggle={toggleGlobalMute}
                onImmersiveModeChange={setIsImmersiveMode}
                isGlobalImmersive={isImmersiveMode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PostDetail;
