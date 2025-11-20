import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/navigation/BottomNav';
import { FloatingActionButton } from '@/components/navigation/FloatingActionButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Search, TrendingUp, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import TikTokPortraitPostFlow from '@/components/post/TikTokPortraitPostFlow';
import PostCreationSelector from '@/components/post/PostCreationSelector';
import TextPostCreator from '@/components/post/TextPostCreator';
import PostCard from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';

const Feed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'following' | 'forYou'>('forYou');
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [postStep, setPostStep] = useState<'selector' | 'camera' | 'gallery' | 'story' | 'text' | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastScrollY = useRef(0);

  // Fetch posts
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ['feed-posts', activeTab],
    queryFn: async () => {
      let query = supabase
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
        .order('created_at', { ascending: false })
        .limit(20);

      if (activeTab === 'following' && user) {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = following?.map(f => f.following_id) || [];
        if (followingIds.length > 0) {
          query = query.in('user_id', followingIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    localStorage.setItem('currentUserId', user.id);
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      // Hide nav when user is interacting or scrolling
      if (isInteracting) {
        setShowNav(false);
        return;
      }

      setShowNav(false);
      
      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Show nav after user stops scrolling
      scrollTimeout.current = setTimeout(() => {
        if (!isInteracting) {
          setShowNav(true);
        }
      }, 150);

      lastScrollY.current = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [isInteracting]);

  const handleInteractionStart = () => {
    setIsInteracting(true);
    setShowNav(false);
  };

  const handleInteractionEnd = () => {
    setIsInteracting(false);
    setShowNav(true);
  };

  const handleCreatePost = () => {
    setPostStep('selector');
  };

  const handlePostSubmit = () => {
    setPostStep(null);
    refetch();
  };

  const handleGallerySelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        // Handle gallery upload - you can expand this
        toast({
          title: 'Gallery selected',
          description: 'Gallery upload functionality to be expanded',
        });
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 py-2 max-w-2xl mx-auto">
          <NotificationBell />
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('following')}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'following'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('forYou')}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'forYou'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              For You
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/trending')}
            >
              <TrendingUp className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast({ title: 'Search removed' })}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/live')}
              className="relative"
            >
              <Radio className="w-5 h-5 text-red-500" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={feedContainerRef}
        className="max-w-2xl mx-auto snap-y snap-mandatory overflow-y-scroll h-[calc(100vh-8rem)] scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-64 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <>
            {posts.map((post) => {
              // Styled text posts and media posts should be full height
              // Plain text posts without background should be compact
              const isStyledText = post.media_type === 'text_styled' && post.media_url && post.content;
              const isMedia = post.media_url && post.media_type !== 'text_styled';
              const isPlainText = !post.media_url && post.content;
              
              const wrapperClass = (isStyledText || isMedia)
                ? "snap-start snap-always h-[calc(100vh-8rem)] flex items-start" 
                : "snap-start mb-4";
              
              return (
                <div key={post.id} className={wrapperClass}>
                  <PostCard
                    post={post}
                    allPosts={posts}
                    onLikeUpdate={() => refetch()}
                    onCommentsOpenChange={setIsCommentsOpen}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                  />
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
            <p className="text-muted-foreground mb-2">No posts yet</p>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'following' 
                ? 'Follow some users to see their posts here' 
                : 'Be the first to create a post!'}
            </p>
          </div>
        )}
      </div>

      <BottomNav hidden={isCommentsOpen || !showNav || postStep !== null} />
      
      {/* Quick Action Button - positioned below feed cards */}
      <FloatingActionButton 
        onClick={handleCreatePost}
        hidden={isCommentsOpen || !showNav || postStep !== null}
      />

      {postStep === 'selector' && (
        <PostCreationSelector
          onCameraSelect={() => setPostStep('camera')}
          onGallerySelect={() => {
            setPostStep(null);
            handleGallerySelect();
          }}
          onStorySelect={() => setPostStep('story')}
          onTextSelect={() => setPostStep('text')}
          onClose={() => setPostStep(null)}
        />
      )}

      {postStep === 'camera' && (
        <TikTokPortraitPostFlow
          onClose={() => setPostStep(null)}
          onSubmit={handlePostSubmit}
        />
      )}
      {postStep === 'story' && (
        <CreateStoryModal
          open={true}
          onClose={() => setPostStep(null)}
          onSuccess={() => {
            setPostStep(null);
            toast({
              title: 'Story created!',
              description: 'Your story has been shared.',
            });
          }}
        />
      )}
      {postStep === 'text' && (
        <TextPostCreator
          onClose={() => setPostStep(null)}
          onSubmit={handlePostSubmit}
        />
      )}
    </div>
  );
};

export default Feed;
