import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Eye, MoreVertical, Repeat, Gift, TrendingUp, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
      <div className="bg-card rounded-lg overflow-hidden border border-border mb-4">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
              <AvatarImage src={post.profiles?.avatar_url || ''} />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                @{username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-muted rounded-full">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Caption */}
        {post.content && (
          <div className="px-3 pb-2">
            <CaptionText
              text={post.content}
              showMore={showFullCaption}
              onToggleMore={() => setShowFullCaption(true)}
            />
          </div>
        )}

        {/* Location */}
        {post.location && (
          <div className="px-3 pb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{post.location}</p>
          </div>
        )}

        {/* Media */}
        {post.media_url && (
          <div className="w-full">
            {post.media_type === 'image' ? (
              <img
                src={post.media_url}
                alt="Post content"
                className="w-full object-cover max-h-96"
              />
            ) : (
              <video
                src={post.media_url}
                className="w-full max-h-96"
                controls
                playsInline
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-3 py-2 border-t border-border">
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
    </>
  );
}
