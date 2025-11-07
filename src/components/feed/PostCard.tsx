import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVideoAutoplay } from '@/hooks/useVideoAutoplay';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Share2, Bookmark, TrendingUp, Trash2, MoreVertical, Volume2, VolumeX, Maximize } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CommentsModal } from './CommentsModal';
import { ProfilePreviewModal } from '@/components/profile/ProfilePreviewModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  
  useVideoAutoplay(videoRef, post.media_type === 'video');
  const [isRefed, setIsRefed] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewStartTimeRef = useRef<number>(Date.now());
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

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
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const getTextSize = (text: string) => {
    const length = text.length;
    if (length <= 30) return 'text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl';
    if (length <= 60) return 'text-base sm:text-lg md:text-xl lg:text-xl xl:text-2xl';
    if (length <= 100) return 'text-sm sm:text-base md:text-lg lg:text-lg xl:text-xl';
    if (length <= 150) return 'text-xs sm:text-sm md:text-base lg:text-base xl:text-lg';
    if (length <= 250) return 'text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base';
    return 'text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base';
  };

  const getGradientBackground = () => {
    const gradients = [
      'from-purple-600 via-purple-500 to-blue-500',
      'from-pink-500 via-red-500 to-yellow-500',
      'from-green-500 via-teal-500 to-blue-500',
      'from-indigo-600 via-purple-600 to-pink-500',
      'from-orange-500 via-red-500 to-pink-500',
      'from-blue-600 via-indigo-600 to-purple-600',
    ];
    const index = parseInt(post.id.slice(0, 8), 16) % gradients.length;
    return gradients[index];
  };

  const isTextOnly = !post.media_url && post.content;

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      <div className="relative h-full flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center space-x-3">
            <Avatar 
              className="w-12 h-12 cursor-pointer hover:opacity-80 ring-2 ring-white/20" 
              onClick={() => navigate(`/profile/${post.user_id}`)}
            >
              <AvatarImage src={post.profiles?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p 
                className="font-bold text-white cursor-pointer hover:underline truncate text-lg inline-block max-w-fit"
                onClick={() => navigate(`/profile/${post.user_id}`)}
              >
                {displayName}
              </p>
              <div className="flex items-center space-x-2 text-sm">
                {post.profiles?.username && (
                  <span 
                    className="cursor-pointer hover:underline text-white/80 truncate inline-block max-w-fit"
                    onClick={() => navigate(`/profile/${post.user_id}`)}
                  >
                    @{post.profiles.username}
                  </span>
                )}
              </div>
            </div>
            
            {(user?.id === post.user_id || isAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800/60 backdrop-blur-md border-gray-700" align="end">
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-400 hover:bg-gray-700/80 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {post.media_url && (
          <div className="absolute inset-0 z-0 bg-black">
            {post.has_blur_background && (
              <div className="absolute inset-0 z-0">
                {post.media_type === 'image' && (
                  <img
                    src={post.media_url}
                    alt=""
                    className="w-full h-full object-cover blur-3xl opacity-30 scale-110"
                  />
                )}
                {post.media_type === 'video' && (
                  <video
                    src={post.media_url}
                    className="w-full h-full object-cover blur-3xl opacity-30 scale-110"
                    muted
                    loop
                    autoPlay
                  />
                )}
              </div>
            )}
            
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              {post.media_type === 'image' && (
                <img
                  src={post.media_url}
                  alt="Post media"
                  className={`${
                    post.aspect_ratio === '9:16' ? 'w-full h-full object-cover' :
                    post.aspect_ratio === '16:9' ? 'w-full h-auto max-h-full object-contain' :
                    'w-auto h-full max-w-full object-contain'
                  }`}
                />
              )}
              {post.media_type === 'video' && (
                <>
                  <video
                    ref={videoRef}
                    src={post.media_url}
                    onClick={togglePlayPause}
                    className={`${
                      post.aspect_ratio === '9:16' ? 'w-full h-full object-cover' :
                      post.aspect_ratio === '16:9' ? 'w-full h-auto max-h-full object-contain' :
                      'w-auto h-full max-w-full object-contain'
                    }`}
                    playsInline
                    loop
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Play/Pause Button in Center */}
                  {!isPlaying && (
                    <div 
                      onClick={togglePlayPause}
                      className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer"
                    >
                      <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-all">
                        <div className="w-0 h-0 border-t-[20px] border-t-transparent border-l-[30px] border-l-white border-b-[20px] border-b-transparent ml-2"></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Video Controls - Mute and Fullscreen */}
                  <div className="absolute bottom-[480px] right-4 z-20 flex flex-col gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={toggleFullScreen} 
                      className="text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm w-12 h-12 rounded-full shadow-lg"
                    >
                      <Maximize className="w-6 h-6" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={toggleMute} 
                      className="text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm w-12 h-12 rounded-full shadow-lg"
                    >
                      {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isTextOnly && post.content && post.content.length <= 150 && (
          <div className={`absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br ${getGradientBackground()} p-4 pr-16 sm:p-6 sm:pr-20 md:pr-24`}>
            <p className={`text-white ${getTextSize(post.content)} font-bold text-center leading-relaxed break-words max-w-3xl px-2 sm:px-4`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {post.content}
            </p>
          </div>
        )}

        {isTextOnly && post.content && post.content.length > 150 && (
          <div className="absolute inset-0 z-0 flex items-start justify-center bg-gray-900 p-4 pt-20 sm:p-6 sm:pt-24">
            <div className="w-full max-w-2xl bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-gray-700/50">
              <p className="text-white text-base sm:text-lg md:text-xl lg:text-2xl font-medium leading-relaxed break-words whitespace-pre-wrap">
                {post.content}
              </p>
            </div>
          </div>
        )}

        <div className={`absolute bottom-0 left-0 right-0 z-20 p-4 ${isTextOnly ? 'bg-black/40 backdrop-blur-sm' : 'bg-gradient-to-t from-black/80 via-black/50 to-transparent'}`}>
          {post.media_url && post.content && (
            <p className="text-white mb-2 whitespace-pre-wrap text-base line-clamp-3">
              {post.content}
            </p>
          )}

          <p className="text-white/60 text-xs mb-1">{timeAgo}</p>

          {post.media_type === 'video' && (
            <p className="text-white/70 text-xs mb-3 italic">
              🎵 Original Audio
            </p>
          )}

          <button
            onClick={handlePromote}
            className="text-white/80 hover:text-white text-xs font-medium transition-colors flex items-center"
          >
            Promote this post
          </button>
        </div>

        <div className="absolute right-4 bottom-32 z-30 flex flex-col items-center space-y-4">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isLiked ? 'bg-pink-500' : 'bg-white/10 backdrop-blur-sm'
            } shadow-lg`}>
              <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-white text-white' : 'text-white'}`} />
            </div>
            <span className="text-white text-[9px] font-bold">{localLikesCount}</span>
          </button>

          <button
            onClick={() => {
              setShowComments(true);
              if (!hasViewed) {
                const elapsed = Math.floor((Date.now() - viewStartTimeRef.current) / 1000);
                trackView(elapsed, true);
                if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
              }
            }}
            className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <MessageCircle className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="text-white text-[9px] font-bold">{post.comments_count}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95">
                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Share2 className="w-[18px] h-[18px] text-white" />
                </div>
                <span className="text-white text-[9px] font-bold">Share</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800/60 backdrop-blur-md border-gray-700" align="end">
              <DropdownMenuItem onClick={() => handleShare('refeed')} className="text-white hover:bg-gray-700/80">
                {isRefed ? '✓ ReFEEDed' : '🔄 ReFEED Post'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('whatsapp')} className="text-white hover:bg-gray-700/80">
                Share to WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('facebook')} className="text-white hover:bg-gray-700/80">
                Share to Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('twitter')} className="text-white hover:bg-gray-700/80">
                Share to Twitter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')} className="text-white hover:bg-gray-700/80">
                Copy Link
              </DropdownMenuItem>
              {post.media_url && (
                <DropdownMenuItem onClick={() => handleShare('download')} className="text-white hover:bg-gray-700/80">
                  Download Media
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={handleSave}
            className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isSaved ? 'bg-yellow-500' : 'bg-white/10 backdrop-blur-sm'
            } shadow-lg`}>
              <Bookmark className={`w-[18px] h-[18px] ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
            </div>
            <span className="text-white text-[9px] font-bold">Save</span>
          </button>

          <div className="flex flex-col items-center space-y-0.5">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Eye className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="text-white text-[9px] font-bold">{post.views_count}</span>
          </div>
        </div>
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

      <ProfilePreviewModal
        open={showProfilePreview}
        onClose={() => setShowProfilePreview(false)}
        userId={post.user_id}
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