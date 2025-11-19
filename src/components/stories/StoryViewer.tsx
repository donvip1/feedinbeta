import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, Trash2, MessageCircle, Volume2, VolumeX, Heart } from 'lucide-react';
import { ReactionPicker } from '@/components/feed/ReactionPicker';
import { Input } from '@/components/ui/input';
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
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const progressInterval = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const currentUserStories = allUserStories[currentUserIndex];
  const currentStory = currentUserStories?.stories[currentStoryIndex];
  const isOwn = currentStory?.user_id === user?.id;

  useEffect(() => {
    const video = videoRef.current;
    if (video && currentStory.media_type === 'video') {
      video.muted = isMuted;
    }
  }, [isMuted, currentStory]);

  useEffect(() => {
    if (currentStory) {
      loadComments();
      markAsViewed();
    }
  }, [currentStory]);

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

  const loadComments = async () => {
    if (!currentStory) return;

    try {
      const { data, error } = await supabase
        .from('story_comments')
        .select(`
          *,
          profiles:user_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('story_id', currentStory.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!user || !currentStory || !newComment.trim()) return;

    try {
      await supabase.from('story_comments').insert({
        story_id: currentStory.id,
        user_id: user.id,
        content: newComment.trim(),
      });

      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;

    // Check if horizontal swipe is more significant than vertical
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swiped left - next story
        nextStory();
      } else {
        // Swiped right - previous story
        previousStory();
      }
    }
    
    setIsPaused(false);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !user || !currentStory) return;

    try {
      // Find or create conversation with participants
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      let conversationId: string | null = null;

      if (participants && participants.length > 0) {
        // Check if any conversation includes both users
        for (const p of participants) {
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('*')
            .eq('conversation_id', p.conversation_id)
            .eq('user_id', currentStory.user_id)
            .single();

          if (otherParticipant) {
            conversationId = p.conversation_id;
            break;
          }
        }
      }

      if (!conversationId) {
        // Create new conversation
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({})
          .select('id')
          .single();

        if (newConv) {
          conversationId = newConv.id;
          // Add both participants
          await supabase.from('conversation_participants').insert([
            { conversation_id: conversationId, user_id: user.id },
            { conversation_id: conversationId, user_id: currentStory.user_id },
          ]);
        }
      }

      if (conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: chatMessage,
          media_type: 'text',
        });
      }
      
      setChatMessage('');
      setShowChat(false);
    } catch (error) {
      console.error('Error sending message:', error);
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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

      {/* Comments Section */}
      {showComments && (
        <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm rounded-t-3xl max-h-[60vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Comments</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowComments(false)}
              >
                Close
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.profiles?.avatar_url || ''} />
                  <AvatarFallback>{comment.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{comment.profiles?.display_name}</p>
                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a comment..."
                className="flex-1"
              />
              <Button onClick={handleAddComment} size="sm">
                Post
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reaction bar - Icon only */}
      {!isOwn && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <ReactionPicker onSelect={handleReaction}>
            <Button
              size="icon"
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full w-12 h-12"
            >
              <Heart className="w-6 h-6" />
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
