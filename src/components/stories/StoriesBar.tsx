import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { StoryCircle } from './StoryCircle';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewer } from './StoryViewer';

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

export const StoriesBar = () => {
  const { user } = useAuth();
  const [userStories, setUserStories] = useState<UserStories[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      setUserStories(groupedStories);
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

  const hasMyStory = userStories.some(us => us.user_id === user?.id);

  if (loading) {
    return (
      <div className="flex gap-4 p-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-800 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 p-4">
          {/* Add Story Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-shrink-0 flex flex-col items-center gap-2"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-blue-500 flex items-center justify-center">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs text-muted-foreground">Add Story</span>
          </button>

          {/* User Stories */}
          {userStories.map((userStory) => (
            <StoryCircle
              key={userStory.user_id}
              user={userStory.user}
              hasViewed={userStory.has_viewed}
              isOwn={userStory.user_id === user?.id}
              onClick={() => setSelectedUserId(userStory.user_id)}
            />
          ))}
        </div>
      </ScrollArea>

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
