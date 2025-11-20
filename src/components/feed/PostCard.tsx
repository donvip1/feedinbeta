import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Eye, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    <div className="bg-card rounded-lg overflow-hidden border border-border mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
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
          <p className="text-sm">{post.content}</p>
        </div>
      )}

      {/* Location */}
      {post.location && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground">📍 {post.location}</p>
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
      <div className="flex items-center justify-between p-3 border-t border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
          >
            <Heart
              className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : ''}`}
            />
            <span className="text-sm">{likesCount}</span>
          </button>

          <button
            onClick={() => navigate(`/post/${post.id}`)}
            className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{post.comments_count || 0}</span>
          </button>

          <button className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
            <Eye className="w-5 h-5" />
            <span className="text-sm">{post.views_count || 0}</span>
          </button>
        </div>

        <button className="hover:text-primary transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
