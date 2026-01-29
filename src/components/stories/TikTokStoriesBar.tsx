import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewer } from './StoryViewer';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface UserStories {
  user_id: string;
  user: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  stories: Story[];
  has_viewed: boolean;
}

// TikTok-style Story Circle with gradient ring
const TikTokStoryCircle = ({ 
  label, 
  isCreate, 
  image,
  hasViewed = false,
  onClick
}: { 
  label: string; 
  isCreate?: boolean; 
  image?: string;
  hasViewed?: boolean;
  onClick?: () => void;
}) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 shrink-0 select-none active:scale-95 transition-transform"
  >
    <div className={cn(
      "p-[2.5px] rounded-full shadow-sm transition-transform",
      isCreate 
        ? "border-2 border-primary border-dashed" 
        : hasViewed
          ? "bg-muted-foreground/40"
          : "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
    )}>
      <div className="w-[60px] h-[60px] rounded-full border-2 border-background bg-muted overflow-hidden relative">
        {isCreate ? (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <Plus className="w-6 h-6 text-primary" />
          </div>
        ) : (
          <Avatar className="w-full h-full">
            <AvatarImage 
              src={image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${label}`} 
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-500 text-white">
              {label?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
    <span className="text-[10px] font-bold text-muted-foreground truncate w-14 text-center">
      {label}
    </span>
  </button>
);

export const TikTokStoriesBar = () => {
  const { user } = useAuth();
  const [userStories, setUserStories] = useState<UserStories[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    loadStories();
    const unsubscribe = subscribeToStories();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const loadStories = async () => {
    if (!user) return;

    try {
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*, user:profiles!stories_user_id_fkey(display_name, username, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', user.id);

      const viewedStoryIds = new Set(views?.map(v => v.story_id) || []);

      const groupedStories = stories?.reduce((acc, story) => {
        const existing = acc.find(us => us.user_id === story.user_id);
        const storyData = {
          id: story.id,
          user_id: story.user_id,
          media_url: story.media_url,
          media_type: story.media_type,
          created_at: story.created_at,
          expires_at: story.expires_at,
          views_count: story.views_count,
          profiles: {
            display_name: story.user?.display_name || null,
            username: story.user?.username || null,
            avatar_url: story.user?.avatar_url || null,
          },
        };

        if (existing) {
          existing.stories.push(storyData);
          existing.has_viewed = existing.has_viewed && viewedStoryIds.has(story.id);
        } else {
          acc.push({
            user_id: story.user_id,
            user: {
              display_name: story.user?.display_name || null,
              username: story.user?.username || null,
              avatar_url: story.user?.avatar_url || null,
            },
            stories: [storyData],
            has_viewed: viewedStoryIds.has(story.id),
          });
        }
        return acc;
      }, [] as UserStories[]) || [];

      // Sort: own story first, then unviewed, then viewed
      const sortedStories = groupedStories.sort((a, b) => {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
        if (!a.has_viewed && b.has_viewed) return -1;
        if (a.has_viewed && !b.has_viewed) return 1;
        return 0;
      });

      setUserStories(sortedStories);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToStories = () => {
    const channel = supabase
      .channel('stories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories',
        },
        () => {
          loadStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const x = e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  if (loading) {
    return (
      <div className="relative w-full overflow-hidden border-b border-border/50 mb-1">
        <div className="flex gap-4 py-2 overflow-x-auto scrollbar-hide">
          <div className="pl-4 shrink-0" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-[60px] h-[60px] rounded-full bg-muted animate-pulse" />
              <div className="w-10 h-2 bg-muted rounded animate-pulse" />
            </div>
          ))}
          <div className="pr-4 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stories Section with improved padding & scrollability */}
      <div className="relative w-full overflow-hidden border-b border-border/50 mb-1">
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 py-2 overflow-x-auto scrollbar-hide scroll-smooth touch-pan-x cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{ 
            scrollBehavior: isDragging ? 'auto' : 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Left Margin Spacer */}
          <div className="pl-4 shrink-0" />
          
          {/* Create Story Button */}
          <TikTokStoryCircle 
            label="Create" 
            isCreate 
            onClick={() => setShowCreateModal(true)}
          />
          
          {/* User Stories */}
          {userStories.map((userStory) => (
            <TikTokStoryCircle
              key={userStory.user_id}
              label={userStory.user_id === user?.id 
                ? 'Your Story' 
                : (userStory.user.display_name?.split(' ')[0] || 'User')
              }
              image={userStory.user.avatar_url || undefined}
              hasViewed={userStory.has_viewed}
              onClick={() => setSelectedUserId(userStory.user_id)}
            />
          ))}
          
          {/* Right Margin Spacer - Fixes the cutting off issue */}
          <div className="pr-4 shrink-0" />
        </div>
      </div>

      <CreateStoryModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadStories();
        }}
      />

      {selectedUserId && (
        <StoryViewer
          userId={selectedUserId}
          allUserStories={userStories}
          onClose={() => setSelectedUserId(null)}
          onStoryChange={loadStories}
        />
      )}
    </>
  );
};

export default TikTokStoriesBar;
