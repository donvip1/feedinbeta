import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Share2, Bookmark, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CommentsModal } from './CommentsModal';
import { ProfilePreviewModal } from '@/components/profile/ProfilePreviewModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PostCardProps {
  post: {
    id: string;
    feed_id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
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
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);

  // Check if user has liked this post and saved it
  useEffect(() => {
    if (user) {
      checkIfLiked();
      checkIfSaved();
      trackView();
    }
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

  const trackView = async () => {
    try {
      await supabase.from('post_views').insert({
        post_id: post.id,
        user_id: user?.id,
      });
    } catch (error) {
      // View tracking is non-critical
    }
  };

  const handleLike = async () => {
    if (!user || isLiking) return;

    setIsLiking(true);
    const newIsLiked = !isLiked;
    const newLikesCount = newIsLiked ? localLikesCount + 1 : localLikesCount - 1;

    // Optimistic update
    setIsLiked(newIsLiked);
    setLocalLikesCount(newLikesCount);

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
      // Revert on error
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

  const handleShare = async (platform: string) => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareText = `Check out this post on FeedIn: ${post.content?.substring(0, 100) || ''}`;

    try {
      if (platform === 'copy') {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied to clipboard' });
      } else if (platform === 'download' && post.media_url) {
        // Download with watermark
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
        // Share to social platforms
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

  const handlePromote = () => {
    // Navigate to promotion page with post ID
    navigate(`/promote/${post.id}`);
  };

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      {/* Main Content Area */}
      <div className="relative h-full flex flex-col">
        {/* Header - Always visible at top */}
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
                className="font-bold text-white cursor-pointer hover:underline truncate text-lg"
                onClick={() => navigate(`/profile/${post.user_id}`)}
              >
                {displayName}
              </p>
              <div className="flex items-center space-x-2 text-sm">
                {post.profiles?.username && (
                  <span 
                    className="cursor-pointer hover:underline text-white/80 truncate"
                    onClick={() => navigate(`/profile/${post.user_id}`)}
                  >
                    @{post.profiles.username}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Media - Centered and contained */}
        {post.media_url && (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
            {post.media_type === 'image' && (
              <img
                src={post.media_url}
                alt="Post media"
                className="max-w-full max-h-full object-contain"
              />
            )}
            {post.media_type === 'video' && (
              <video
                src={post.media_url}
                controls
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        )}

        {/* Text-only post - Centered */}
        {!post.media_url && post.content && (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
            <p className="text-white text-2xl text-center whitespace-pre-wrap max-w-2xl">
              {post.content}
            </p>
          </div>
        )}

        {/* Content and Actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          {/* Content - Only show if there's media */}
          {post.media_url && post.content && (
            <p className="text-white mb-2 whitespace-pre-wrap text-base line-clamp-3">
              {post.content}
            </p>
          )}

          {/* Time */}
          <p className="text-white/60 text-xs mb-1">{timeAgo}</p>

          {/* Music Title - Placeholder for future implementation */}
          {post.media_type === 'video' && (
            <p className="text-white/70 text-xs mb-3 italic">
              🎵 Original Audio
            </p>
          )}

          {/* Promote Link */}
          <button
            onClick={handlePromote}
            className="text-white/80 hover:text-white text-xs font-medium transition-colors flex items-center"
          >
            Promote this post
          </button>
        </div>

        {/* TikTok-style Vertical Action Buttons - Right Side (40% smaller) */}
        <div className="absolute right-3 bottom-32 z-30 flex flex-col items-center space-y-4">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
              isLiked ? 'bg-pink-500' : 'bg-white/10 backdrop-blur-sm'
            } shadow-lg`}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-white text-white' : 'text-white'}`} />
            </div>
            <span className="text-white text-[10px] font-bold">{localLikesCount}</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95"
          >
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-bold">{post.comments_count}</span>
          </button>

          {/* Share Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95">
                <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold">Share</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700" align="end">
              <DropdownMenuItem onClick={() => handleShare('whatsapp')} className="text-white hover:bg-gray-700">
                Share to WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('facebook')} className="text-white hover:bg-gray-700">
                Share to Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('twitter')} className="text-white hover:bg-gray-700">
                Share to Twitter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')} className="text-white hover:bg-gray-700">
                Copy Link
              </DropdownMenuItem>
              {post.media_url && (
                <DropdownMenuItem onClick={() => handleShare('download')} className="text-white hover:bg-gray-700">
                  Download Media
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save/Bookmark Button */}
          <button
            onClick={handleSave}
            className="flex flex-col items-center space-y-0.5 transform transition-transform hover:scale-110 active:scale-95"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
              isSaved ? 'bg-yellow-500' : 'bg-white/10 backdrop-blur-sm'
            } shadow-lg`}>
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
            </div>
            <span className="text-white text-[10px] font-bold">Save</span>
          </button>

          {/* Views Counter */}
          <div className="flex flex-col items-center space-y-0.5">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-bold">{post.views_count}</span>
          </div>
        </div>
      </div>

      {/* Comments Modal */}
      <CommentsModal
        open={showComments}
        onClose={() => {
          setShowComments(false);
          onUpdate();
        }}
        postId={post.id}
        postOwnerId={post.user_id}
      />

      {/* Profile Preview Modal */}
      <ProfilePreviewModal
        open={showProfilePreview}
        onClose={() => setShowProfilePreview(false)}
        userId={post.user_id}
      />
    </div>
  );
};