import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ReactionPicker } from '@/components/feed/ReactionPicker';
import { formatDistanceToNow } from 'date-fns';

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

interface StoryViewerProps {
  userId: string;
  allUserStories: UserStories[];
  onClose: () => void;
  onStoryChange: () => void;
}

export const StoryViewer = ({ userId, allUserStories, onClose, onStoryChange }: StoryViewerProps) => {
  const { user } = useAuth();
  const [currentUserIndex, setCurrentUserIndex] = useState(
    allUserStories.findIndex(us => us.user_id === userId)
  );
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentUserStories = allUserStories[currentUserIndex];
  const currentStory = currentUserStories?.stories[currentStoryIndex];
  const isOwn = currentStory?.user_id === user?.id;

  useEffect(() => {
    if (currentStory && user) {
      markAsViewed();
    }
  }, [currentStory?.id, user]);

  useEffect(() => {
    if (!isPaused && currentStory) {
      const duration = currentStory.media_type === 'video' ? 15000 : 5000;
      const interval = 50;
      const increment = (interval / duration) * 100;

      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            nextStory();
            return 0;
          }
          return prev + increment;
        });
      }, interval);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPaused, currentStory, currentStoryIndex, currentUserIndex]);

  const markAsViewed = async () => {
    if (!user || !currentStory) return;

    try {
      await supabase.from('story_views').insert({
        story_id: currentStory.id,
        user_id: user.id,
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const nextStory = () => {
    if (currentStoryIndex < currentUserStories.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (currentUserIndex < allUserStories.length - 1) {
      setCurrentUserIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex(prev => prev - 1);
      const prevUserStories = allUserStories[currentUserIndex - 1];
      setCurrentStoryIndex(prevUserStories.stories.length - 1);
      setProgress(0);
    }
  };

  const handleReaction = async (reaction: string) => {
    if (!user || !currentStory) return;

    try {
      await supabase.from('story_reactions').upsert({
        story_id: currentStory.id,
        user_id: user.id,
        reaction_type: reaction,
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;

    try {
      await supabase.from('stories').delete().eq('id', currentStory.id);
      onStoryChange();
      nextStory();
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md h-[85vh] max-h-[800px] bg-black rounded-2xl overflow-hidden">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        {currentUserStories.stories.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width: `${
                  index < currentStoryIndex
                    ? 100
                    : index === currentStoryIndex
                    ? progress
                    : 0
                }%`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarImage src={currentUserStories.user.avatar_url || ''} />
            <AvatarFallback>{currentUserStories.user.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-semibold text-sm">
              {currentUserStories.user.display_name || 'Unknown'}
            </p>
            <p className="text-white/70 text-xs">
              {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwn && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              className="text-white hover:bg-white/20"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Story content */}
      <div
        className="relative w-full max-w-md h-full flex items-center justify-center"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {currentStory.media_type === 'image' ? (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        )}

        {/* Navigation areas */}
        <button
          onClick={previousStory}
          className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-4"
          disabled={currentUserIndex === 0 && currentStoryIndex === 0}
        >
          <ChevronLeft className="w-8 h-8 text-white/50" />
        </button>
        <button
          onClick={nextStory}
          className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-4"
        >
          <ChevronRight className="w-8 h-8 text-white/50" />
        </button>
      </div>

      {/* Reaction bar */}
      {!isOwn && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ReactionPicker onSelect={handleReaction}>
            <Button
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              React
            </Button>
          </ReactionPicker>
        </div>
      )}

      {/* Story info for owner */}
      {isOwn && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-sm">
          👁️ {currentStory.views_count} views
        </div>
      )}
      </div>
    </div>
  );
};
