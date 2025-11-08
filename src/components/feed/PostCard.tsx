import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { CommentsModal } from './CommentsModal';
import { PostCardHeader } from './PostCardHeader';
import { PostCardMedia } from './PostCardMedia';
import { PostCardActions } from './PostCardActions';
import { PostCardContent } from './PostCardContent';
import { PostCardMenu } from './PostCardMenu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PostCardProps {
  post: {
    id: string;
    feed_id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    aspect_ratio?: string;
    has_blur_background?: boolean;
    likes_count: number;
    comments_count: number;
    views_count: number;
    created_at: string;
    music_title?: string | null;
    music_artist?: string | null;
    music_url?: string | null;
    is_original_audio?: boolean;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onUpdate: () => void;
}

export const PostCard = ({ post, onUpdate }: PostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewStartTimeRef = useRef<number>(Date.now());
  
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRefed, setIsRefed] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  // Simple video autoplay
  useEffect(() => {
    if (post.media_type === 'video' && videoRef.current) {
      const video = videoRef.current;
      const playVideo = () => {
        video.play().catch(() => {
          // Autoplay was prevented, user needs to interact
        });
      };
      playVideo();
    }
  }, [post.media_type]);

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .single();
      
      setIsAdmin(data?.role === 'admin' || data?.role === 'moderator');
    } catch (error) {
      // Not admin
    }
  };

  useEffect(() => {
    if (user) {
      checkIfLiked();
      checkIfSaved();
      checkIfRefed();
      checkIfViewed();
      startViewTimer();
    }

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
    };
  }, [user]);

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user?.id)
        .single();

      setIsLiked(!!data);
    } catch (error) {
      // Not liked or error
    }
  };

  const checkIfSaved = async () => {
    try {
      const { data } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user?.id)
        .single();

      setIsSaved(!!data);
    } catch (error) {
      // Not saved or error
    }
  };

  const checkIfRefed = async () => {
    try {
      const { data } = await supabase
        .from('refeeds')
        .select('id')
        .eq('original_post_id', post.id)
        .eq('refed_by_user_id', user?.id)
        .single();

      setIsRefed(!!data);
    } catch (error) {
      // Not refed or error
    }
  };

  const checkIfViewed = async () => {
    try {
      const { data } = await supabase
        .from('post_views')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user?.id)
        .single();

      setHasViewed(!!data);
    } catch (error) {
      // Not viewed or error
    }
  };

  const startViewTimer = () => {
    if (hasViewed) return;

    viewStartTimeRef.current = Date.now();
    
    viewTimerRef.current = setTimeout(async () => {
      await trackView(5);
    }, 5000);
  };

  const trackView = async (duration: number = 0, engaged: boolean = false) => {
    if (hasViewed) return;

    try {
      await supabase.from('post_views').insert({
        post_id: post.id,
        user_id: user?.id,
        view_duration: duration,
        engaged: engaged,
      });
      setHasViewed(true);
    } catch (error) {
      // View tracking is non-critical, ignore unique constraint errors
    }
  };

  const handleLike = async () => {
    if (!user || isLiking) return;

    setIsLiking(true);
    const newIsLiked = !isLiked;
    const newLikesCount = newIsLiked ? localLikesCount + 1 : localLikesCount - 1;

    setIsLiked(newIsLiked);
    setLocalLikesCount(newLikesCount);

    if (!hasViewed) {
      const elapsed = Math.floor((Date.now() - viewStartTimeRef.current) / 1000);
      await trackView(elapsed, true);
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    }

    try {
      if (newIsLiked) {
        const { error } = await supabase.from('post_likes').insert({
          post_id: post.id,
          user_id: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating like:', error);
      setIsLiked(!newIsLiked);
      setLocalLikesCount(localLikesCount);
      toast({
        title: 'Unable to update reaction',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    try {
      if (newIsSaved) {
        const { error } = await supabase.from('saved_posts').insert({
          post_id: post.id,
          user_id: user.id,
        });
        if (error) throw error;
        toast({ title: 'Post saved' });
      } else {
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Post removed from saved' });
      }
    } catch (error: any) {
      setIsSaved(!newIsSaved);
      toast({
        title: 'Unable to save post',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRefeed = async () => {
    if (!user) return;

    if (!hasViewed) {
      const elapsed = Math.floor((Date.now() - viewStartTimeRef.current) / 1000);
      await trackView(elapsed, true);
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    }

    try {
      if (isRefed) {
        await supabase
          .from('refeeds')
          .delete()
          .eq('original_post_id', post.id)
          .eq('refed_by_user_id', user.id);
        setIsRefed(false);
        toast({ title: 'ReFEED removed' });
      } else {
        await supabase.from('refeeds').insert({
          original_post_id: post.id,
          refed_by_user_id: user.id,
        });
        setIsRefed(true);
        toast({ title: 'Post ReFEEDed to your profile!' });
      }
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Unable to ReFEED',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async (platform: string) => {
    if (platform === 'refeed') {
      handleRefeed();
      return;
    }

    if (!hasViewed) {
      const elapsed = Math.floor((Date.now() - viewStartTimeRef.current) / 1000);
      await trackView(elapsed, true);
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    }

    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareText = `Check out this post on FeedIn: ${post.content?.substring(0, 100) || ''}`;

    try {
      if (platform === 'copy') {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied to clipboard' });
      } else if (platform === 'download' && post.media_url) {
        const response = await fetch(post.media_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedin-${post.feed_id}.${post.media_type === 'video' ? 'mp4' : 'jpg'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: 'Media downloaded' });
      } else {
        const urls: Record<string, string> = {
          whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
        };

        if (urls[platform]) {
          window.open(urls[platform], '_blank');
        }
      }
    } catch (error) {
      toast({
        title: 'Error sharing',
        description: 'Failed to share post',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'deleted' })
        .eq('id', post.id);

      if (error) throw error;

      toast({ title: 'Post deleted successfully' });
      setShowDeleteDialog(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Error deleting post',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePromote = () => {
    navigate(`/promote/${post.id}`);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) { /* Safari */
        (videoRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any).msRequestFullscreen) { /* IE11 */
        (videoRef.current as any).msRequestFullscreen();
      }
    }
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';

  const canDelete = user?.id === post.user_id || isAdmin;

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      <div className="relative h-full flex flex-col">
        <PostCardHeader
          userId={post.user_id}
          avatarUrl={post.profiles?.avatar_url || null}
          displayName={displayName}
          username={post.profiles?.username || null}
          createdAt={post.created_at}
          musicTitle={post.music_title}
          musicArtist={post.music_artist}
          isOriginalAudio={post.is_original_audio}
          onUserClick={() => navigate(`/profile/${post.user_id}`)}
          onMusicClick={() => {
            if (post.is_original_audio) {
              navigate(`/profile/${post.user_id}`);
            } else {
              toast({
                title: "Music",
                description: `${post.music_title} by ${post.music_artist}`,
              });
            }
          }}
        />

        <PostCardMedia
          mediaUrl={post.media_url}
          mediaType={post.media_type}
          content={post.content}
          aspectRatio={post.aspect_ratio}
          hasBlurBackground={post.has_blur_background}
          videoRef={videoRef}
          isMuted={isMuted}
          onVideoClick={togglePlayPause}
        />

        <PostCardContent content={post.content} hasMedia={!!post.media_url} />

        <PostCardActions
          isLiked={isLiked}
          isSaved={isSaved}
          isRefed={isRefed}
          likesCount={localLikesCount}
          commentsCount={post.comments_count}
          viewsCount={post.views_count}
          hasVideo={post.media_type === 'video'}
          isMuted={isMuted}
          onLike={handleLike}
          onComment={() => {
            setShowComments(true);
            if (!hasViewed) {
              const elapsed = Math.floor((Date.now() - viewStartTimeRef.current) / 1000);
              trackView(elapsed, true);
              if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
            }
          }}
          onShare={() => handleShare('refeed')}
          onSave={handleSave}
          onPromote={handlePromote}
          onToggleMute={toggleMute}
          onToggleFullScreen={toggleFullScreen}
        />

        <PostCardMenu
          canDelete={canDelete}
          onDelete={() => setShowDeleteDialog(true)}
          onShare={handleShare}
        />
      </div>

      <CommentsModal
        open={showComments}
        onClose={() => {
          setShowComments(false);
          onUpdate();
        }}
        postId={post.id}
        postOwnerId={post.user_id}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Post?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete this post. All likes, comments, views, and shares will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};