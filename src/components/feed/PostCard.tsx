import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Eye, MoreVertical, Repeat, Gift, TrendingUp, MapPin, Maximize, Volume2, VolumeX, Play, Pause, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import CommentsModal from './CommentsModal';
import ShareModal from './ShareModal';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import CaptionText from './CaptionText';

interface PostCardProps {
  post: {
    id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    created_at: string;
    likes_count: number | null;
    comments_count: number | null;
    views_count: number | null;
    location: string | null;
    profiles?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  onLikeUpdate?: () => void;
}

export default function PostCard({ post, onLikeUpdate }: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [hasViewed, setHasViewed] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [refeedOpen, setRefeedOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const username = post.profiles?.username || 'user';

  // Record view when post is visible
  useEffect(() => {
    const recordView = async () => {
      if (!user || hasViewed) return;
      
      try {
        await supabase.from('post_views').insert({
          post_id: post.id,
          user_id: user.id,
        });
        setHasViewed(true);
      } catch (error) {
        console.error('Error recording view:', error);
      }
    };

    recordView();
  }, [user, post.id, hasViewed]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 500);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const mediaElement = post.media_type === 'video' 
      ? videoRef.current 
      : document.querySelector(`#media-${post.id}`) as HTMLElement;
    
    if (mediaElement) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        mediaElement.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    }
  };

  const handleDeletePost = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast({
        title: 'Post deleted',
        description: 'Your post has been deleted successfully',
      });

      onLikeUpdate?.();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
    setShowDeleteDialog(false);
  };

  const canDeletePost = user && (user.id === post.user_id);

  const handleLike = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like posts',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (liked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        setLikesCount(prev => prev - 1);
        setLiked(false);
      } else {
        await supabase.from('post_likes').insert({
          post_id: post.id,
          user_id: user.id,
        });
        setLikesCount(prev => prev + 1);
        setLiked(true);
      }
      onLikeUpdate?.();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  return (
    <>
      <div className="mb-4 snap-start snap-always w-full px-4 py-2"
>
        {/* Header - Outside card */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
              <AvatarImage src={post.profiles?.avatar_url || ''} />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          {canDeletePost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-muted rounded-full">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Caption - Outside card */}
        {post.content && (
          <div className="mb-2 px-1">
            <CaptionText
              text={post.content}
              showMore={showFullCaption}
              onToggleMore={() => setShowFullCaption(true)}
            />
          </div>
        )}

        {/* Location - Outside card */}
        {post.location && (
          <div className="mb-2 px-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{post.location}</p>
          </div>
        )}

        {/* Media Card */}
        <div className="bg-card rounded-lg overflow-hidden border border-border relative">
          {post.media_url && (
            <div className="w-full relative group h-[70vh]" id={`media-${post.id}`}>
              {post.media_type === 'image' ? (
                <>
                  <img
                    src={post.media_url}
                    alt="Post content"
                    className="w-full h-full object-cover"
                  />
                  {/* Fullscreen button for images */}
                  <button
                    onClick={toggleFullscreen}
                    className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={post.media_url}
                    className="w-full h-full object-cover"
                    playsInline
                    muted={isMuted}
                    onClick={togglePlayPause}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Play/Pause icon in center */}
                  {showPlayIcon && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/30 rounded-full p-6 animate-scale-in">
                        {isPlaying ? (
                          <Pause className="w-12 h-12 text-white" fill="white" />
                        ) : (
                          <Play className="w-12 h-12 text-white" fill="white" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Video controls */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                    <button
                      onClick={toggleMute}
                      className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions - Outside below card */}
        <div className="px-1 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={handleLike}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <Heart
                  className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`}
                />
              </button>
              <span className="text-sm">{likesCount}</span>

              <button
                onClick={() => setCommentsOpen(true)}
                className="p-2 hover:bg-muted rounded-full transition-colors ml-2"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <span className="text-sm">{post.comments_count || 0}</span>

              <button className="p-2 hover:bg-muted rounded-full transition-colors ml-2">
                <Eye className="w-4 h-4" />
              </button>
              <span className="text-sm">{post.views_count || 0}</span>

              <button
                onClick={() => setRefeedOpen(true)}
                className="p-2 hover:bg-muted rounded-full transition-colors ml-2"
              >
                <Repeat className="w-4 h-4" />
              </button>

              <button
                onClick={() => setGiftOpen(true)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <Gift className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShareOpen(true)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Promote button on separate line */}
          <button className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <TrendingUp className="w-4 h-4" />
            <span>Promote</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={post.id}
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
      />
      <GiftModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        postId={post.id}
        recipientId={post.user_id}
      />
      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => setRefeedOpen(false)}
        postId={post.id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
