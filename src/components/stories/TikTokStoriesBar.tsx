import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewer } from './StoryViewer';
import { motion, AnimatePresence } from 'framer-motion';
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

interface TikTokStoryCircleProps {
  user: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  hasViewed: boolean;
  isOwn: boolean;
  hasLiveIndicator?: boolean;
  onClick: () => void;
  delay?: number;
}

const TikTokStoryCircle = ({ 
  user, 
  hasViewed, 
  isOwn, 
  hasLiveIndicator = false,
  onClick,
  delay = 0
}: TikTokStoryCircleProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: delay * 0.05 }}
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
    >
      <div className="relative">
        {/* Gradient ring for unviewed / gray for viewed */}
        <div
          className={cn(
            "w-[68px] h-[68px] rounded-full p-[3px] transition-all duration-300",
            hasViewed
              ? "bg-muted-foreground/30"
              : "bg-gradient-to-tr from-pink-500 via-rose-500 to-orange-400 shadow-pink"
          )}
        >
          <div className="w-full h-full rounded-full bg-background p-[2px]">
            <Avatar className="w-full h-full">
              <AvatarImage 
                src={user.avatar_url || ''} 
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-500 text-white text-lg font-semibold">
                {user.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        
        {/* Live indicator badge */}
        {hasLiveIndicator && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-md">
            <span className="text-[9px] font-bold text-white uppercase tracking-wide">Live</span>
          </div>
        )}
      </div>
      
      <span className="text-[11px] text-muted-foreground max-w-[68px] truncate text-center group-hover:text-foreground transition-colors">
        {isOwn ? 'Your Story' : (user.display_name?.split(' ')[0] || 'User')}
      </span>
    </motion.button>
  );
};

interface CreateStoryButtonProps {
  onClick: () => void;
}

const CreateStoryButton = ({ onClick }: CreateStoryButtonProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
    >
      <div className="relative">
        <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 p-[3px] shadow-pink group-hover:shadow-glow transition-all duration-300">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        
        {/* "What's up?" bubble */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-2.5 py-1 bg-card border border-border rounded-full shadow-sm"
          >
            <span className="text-[10px] text-muted-foreground">What's up?</span>
          </motion.div>
        </div>
      </div>
      
      <span className="text-[11px] text-primary font-medium">Create</span>
    </motion.button>
  );
};

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
    subscribeToStories();
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

  // Touch/swipe handlers for horizontal scroll
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
      <div className="flex gap-3 px-4 py-3 overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-[68px] h-[68px] rounded-full bg-muted animate-pulse" />
            <div className="w-12 h-2 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
      >
        {/* Create Story Button - Always first */}
        <CreateStoryButton onClick={() => setShowCreateModal(true)} />

        {/* User Stories */}
        <AnimatePresence>
          {userStories.map((userStory, index) => (
            <TikTokStoryCircle
              key={userStory.user_id}
              user={userStory.user}
              hasViewed={userStory.has_viewed}
              isOwn={userStory.user_id === user?.id}
              onClick={() => setSelectedUserId(userStory.user_id)}
              delay={index}
            />
          ))}
        </AnimatePresence>
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
