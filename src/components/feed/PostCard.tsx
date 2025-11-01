import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Share2 } from 'lucide-react';
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
  const [isLiked, setIsLiked] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);

  // Check if user has liked this post
  useEffect(() => {
    if (user) {
      checkIfLiked();
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

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <Card className="bg-gray-900 border-gray-800 rounded-2xl overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <Avatar 
            className="w-12 h-12 cursor-pointer" 
            onClick={() => setShowProfilePreview(true)}
          >
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p 
              className="font-semibold text-white cursor-pointer hover:underline"
              onClick={() => setShowProfilePreview(true)}
            >
              {displayName}
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>{timeAgo}</span>
              <span>•</span>
              <span>{post.feed_id}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <p className="text-white mb-4 whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Media */}
        {post.media_url && (
          <div className="mb-4 rounded-xl overflow-hidden">
            {post.media_type === 'image' && (
              <img
                src={post.media_url}
                alt="Post media"
                className="w-full object-cover"
              />
            )}
            {post.media_type === 'video' && (
              <video
                src={post.media_url}
                controls
                className="w-full"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-4 pt-4 border-t border-gray-800">
          <Button
            onClick={handleLike}
            variant="ghost"
            size="sm"
            className={`flex items-center space-x-2 ${
              isLiked ? 'text-pink-500' : 'text-gray-400'
            } hover:text-pink-500`}
            disabled={isLiking}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{localLikesCount}</span>
          </Button>

          <Button
            onClick={() => setShowComments(true)}
            variant="ghost"
            size="sm"
            className="flex items-center space-x-2 text-gray-400 hover:text-blue-500"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.comments_count}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2 text-gray-400 hover:text-blue-500"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
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

          <div className="flex items-center space-x-2 text-gray-400 ml-auto">
            <Eye className="w-5 h-5" />
            <span className="text-sm">{post.views_count}</span>
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
    </Card>
  );
};