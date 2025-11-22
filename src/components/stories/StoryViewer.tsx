import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, Trash2, MessageCircle, Volume2, VolumeX, Heart, Send, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { StoryViewersList } from './StoryViewersList';

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
  const { toast } = useToast();
  const [currentUserIndex, setCurrentUserIndex] = useState(
    allUserStories.findIndex(us => us.user_id === userId)
  );
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false); // Enable sound by default
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showViewersList, setShowViewersList] = useState(false);
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
      // Insert view - unique constraint ensures each user counts only once per story
      // Database trigger automatically updates views_count
      await supabase.from('story_views').insert({
        story_id: currentStory.id,
        user_id: user.id,
      });
    } catch (error) {
      // Ignore duplicate key errors - user already viewed this story
      if (error && error.code !== '23505') {
        console.error('Error marking story as viewed:', error);
      }
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
        // Send message with story context
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: chatMessage,
          media_type: 'text',
          reply_metadata: {
            type: 'story_reply',
            story_id: currentStory.id,
            story_media_url: currentStory.media_url,
            story_media_type: currentStory.media_type,
          }
        });

        toast({
          title: 'Message sent!',
        });
      }
      
      setChatMessage('');
      setShowChat(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        variant: 'destructive',
      });
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
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowViewersList(true)}
                className="text-white hover:bg-white/20"
              >
                <Eye className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                className="text-white hover:bg-white/20"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
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
          <>
            <video
              ref={videoRef}
              src={currentStory.media_url}
              autoPlay
              playsInline
              muted={isMuted}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.muted = isMuted;
                }
              }}
              className="w-full h-full object-contain"
            />
            
            {/* Mute/Unmute button for videos */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="absolute top-20 right-4 p-2.5 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition z-10"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </>
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
        <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm rounded-t-3xl max-h-[60vh] overflow-hidden flex flex-col z-20">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Comments</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowComments(false);
                  setIsPaused(false);
                }}
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

      {/* Reaction and Message bar */}
      {!isOwn && !showComments && (
        <div className="absolute bottom-4 left-0 right-0 px-4 z-10">
          {showChat ? (
            <div className="flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Send message..."
                className="flex-1 bg-transparent text-white placeholder-white/50 outline-none px-3"
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-blue-500 rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setShowComments(true);
                  setIsPaused(true);
                }}
                size="icon"
                className="bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70"
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </Button>
              <Button
                onClick={() => handleReaction('heart')}
                size="icon"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full w-12 h-12"
              >
                <Heart className="w-6 h-6" />
              </Button>
              <Button
                onClick={() => setShowChat(true)}
                size="icon"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full w-12 h-12"
              >
                <MessageCircle className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Story info for owner */}
      {isOwn && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-sm">
          👁️ {currentStory.views_count} views
        </div>
        )}
      </div>

      {/* Story Viewers List */}
      {isOwn && (
        <StoryViewersList
          storyId={currentStory.id}
          isOpen={showViewersList}
          onClose={() => setShowViewersList(false)}
        />
      )}
    </div>
  );
};
