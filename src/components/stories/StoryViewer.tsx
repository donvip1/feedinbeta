import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, Trash2, Volume2, VolumeX, Send, Eye, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { StoryViewersList } from './StoryViewersList';
import { DEFAULT_EMOJIS } from '@/components/shared/EmojiReactions';
import { motion, AnimatePresence } from 'framer-motion';

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

// Using system-wide DEFAULT_EMOJIS

export const StoryViewer = ({ userId, allUserStories, onClose, onStoryChange }: StoryViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentUserIndex, setCurrentUserIndex] = useState(
    allUserStories.findIndex(us => us.user_id === userId)
  );
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showViewersList, setShowViewersList] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const progressInterval = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const reactionTimeoutRef = useRef<NodeJS.Timeout>();

  const currentUserStories = allUserStories[currentUserIndex];
  const currentStory = currentUserStories?.stories[currentStoryIndex];
  const isOwn = currentStory?.user_id === user?.id;

  useEffect(() => {
    const video = videoRef.current;
    if (video && currentStory?.media_type === 'video') {
      video.muted = isMuted;
    }
  }, [isMuted, currentStory]);

  useEffect(() => {
    if (currentStory) {
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

  const markAsViewed = async () => {
    if (!user || !currentStory) return;

    try {
      await supabase.from('story_views').insert({
        story_id: currentStory.id,
        user_id: user.id,
      });
    } catch (error: any) {
      if (error?.code !== '23505') {
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

  const handleReaction = async (emoji: string) => {
    if (!user || !currentStory) return;

    try {
      // Show visual feedback
      setSentReaction(emoji);
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
      reactionTimeoutRef.current = setTimeout(() => {
        setSentReaction(null);
      }, 1500);

      // Save reaction to database
      await supabase.from('story_reactions').upsert({
        story_id: currentStory.id,
        user_id: user.id,
        reaction_type: emoji,
      });

      // Send as DM to story owner
      await sendReactionAsDM(emoji);
      
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const sendReactionAsDM = async (emoji: string) => {
    if (!user || !currentStory || isOwn) return;

    try {
      // Find or create conversation
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      let conversationId: string | null = null;

      if (participants && participants.length > 0) {
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
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({})
          .select('id')
          .single();

        if (newConv) {
          conversationId = newConv.id;
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
          content: emoji,
          media_type: 'text',
          reply_metadata: {
            type: 'story_reaction',
            story_id: currentStory.id,
            story_media_url: currentStory.media_url,
            story_media_type: currentStory.media_type,
          }
        });
      }
    } catch (error) {
      console.error('Error sending reaction as DM:', error);
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

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        nextStory();
      } else {
        previousStory();
      }
    }
    
    setIsPaused(false);
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !user || !currentStory) return;

    try {
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      let conversationId: string | null = null;

      if (participants && participants.length > 0) {
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
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({})
          .select('id')
          .single();

        if (newConv) {
          conversationId = newConv.id;
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
          content: replyMessage,
          media_type: 'text',
          reply_metadata: {
            type: 'story_reply',
            story_id: currentStory.id,
            story_media_url: currentStory.media_url,
            story_media_type: currentStory.media_type,
          }
        });

        toast({ title: 'Reply sent!' });
      }
      
      setReplyMessage('');
      setShowReplyInput(false);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Error sending reply',
        variant: 'destructive',
      });
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Main story container - Telegram style */}
      <div className="relative w-full h-full max-w-lg mx-auto">
        
        {/* Progress bars - Telegram thin style */}
        <div className="absolute top-0 left-0 right-0 flex gap-[2px] p-2 z-20">
          {currentUserStories.stories.map((_, index) => (
            <div key={index} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
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

        {/* Header - Telegram style */}
        <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-3 z-20">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-9 h-9 ring-2 ring-white/20">
              <AvatarImage src={currentUserStories.user.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm">
                {currentUserStories.user.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-white font-medium text-sm leading-tight">
                {currentUserStories.user.display_name || 'Unknown'}
              </span>
              <span className="text-white/60 text-xs">
                {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {currentStory.media_type === 'video' && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            )}
            {isOwn && (
              <>
                <button
                  onClick={() => setShowViewersList(true)}
                  className="p-2 rounded-full hover:bg-white/10 transition"
                >
                  <Eye className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-full hover:bg-white/10 transition"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Story content */}
        <div
          className="relative w-full h-full"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {currentStory.media_type === 'image' ? (
            <img
              src={currentStory.media_url}
              alt="Story"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentStory.media_url}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              className="w-full h-full object-cover"
            />
          )}

          {/* Gradient overlays for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

          {/* Navigation touch areas */}
          <button
            onClick={previousStory}
            className="absolute left-0 top-0 bottom-0 w-1/3"
            disabled={currentUserIndex === 0 && currentStoryIndex === 0}
          />
          <button
            onClick={nextStory}
            className="absolute right-0 top-0 bottom-0 w-1/3"
          />
        </div>

        {/* Reaction animation overlay */}
        {sentReaction && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="floating-emoji text-8xl">{sentReaction}</div>
          </div>
        )}

        {/* Bottom section - Telegram style */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          {isOwn ? (
            // Owner view - show views count
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
                <Eye className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">{currentStory.views_count} views</span>
              </div>
            </div>
          ) : (
            // Viewer - show emoji reactions and reply input
            <div className="space-y-3">
              {/* Emoji reaction bar - Animated Telegram style */}
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    className="flex justify-center"
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                  >
                    <div className="flex gap-1 bg-black/70 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-lg">
                      {DEFAULT_EMOJIS.map((emoji, index) => (
                        <motion.button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(emoji)}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: index * 0.03, type: 'spring', stiffness: 500 }}
                          whileHover={{ scale: 1.3, y: -3 }}
                          whileTap={{ scale: 0.8 }}
                          className="text-2xl p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        >
                          {emoji}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reply input - Telegram style */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onFocus={() => {
                      setShowReplyInput(true);
                      setIsPaused(true);
                    }}
                    onBlur={() => {
                      if (!replyMessage) {
                        setIsPaused(false);
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="Reply to story..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-full pr-12 focus:bg-white/15"
                  />
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xl hover:scale-110 transition"
                  >
                    😊
                  </button>
                </div>
                
                {replyMessage && (
                  <Button
                    onClick={handleSendReply}
                    size="icon"
                    className="bg-blue-500 hover:bg-blue-600 rounded-full shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation arrows for desktop */}
        <button
          onClick={previousStory}
          disabled={currentUserIndex === 0 && currentStoryIndex === 0}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center bg-black/30 hover:bg-black/50 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed z-20"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={nextStory}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center bg-black/30 hover:bg-black/50 rounded-full transition z-20"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
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
