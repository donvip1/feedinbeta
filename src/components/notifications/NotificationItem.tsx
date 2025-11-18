import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string | null;
    related_id: string | null;
    related_type: string | null;
    is_read: boolean;
    created_at: string;
    from_user: {
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  onUpdate: () => void;
  onClose: () => void;
}

export const NotificationItem = ({ notification, onUpdate, onClose }: NotificationItemProps) => {
  const navigate = useNavigate();

  const handleClick = async () => {
    // Mark as read
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      onUpdate();
    }

    // Navigate based on type
    if (notification.type === 'like' && notification.related_id) {
      // For likes, get the post ID and navigate to it
      navigate('/feed', { state: { postId: notification.related_id } });
    } else if ((notification.type === 'comment' || notification.type === 'reply') && notification.related_id) {
      // For comments and replies, get the comment to find the post_id
      try {
        const { data: comment } = await supabase
          .from('post_comments')
          .select('post_id')
          .eq('id', notification.related_id)
          .single();
        
        if (comment?.post_id) {
          navigate('/feed', { state: { postId: comment.post_id, commentId: notification.related_id } });
        }
      } catch (error) {
        console.error('Error fetching comment:', error);
        navigate('/feed');
      }
    } else if (notification.type === 'message' && notification.related_id) {
      // For messages, navigate to the specific conversation
      navigate('/messages', { state: { conversationId: notification.related_id } });
    } else if ((notification.type === 'follow' || notification.related_type === 'profile') && notification.related_id) {
      // For follows, navigate to the user's profile
      navigate(`/profile/${notification.related_id}`);
    } else if (notification.related_type === 'post' && notification.related_id) {
      navigate('/feed', { state: { postId: notification.related_id } });
    } else {
      // Default navigation
      navigate('/feed');
    }
    
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id);
      onUpdate();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left ${
        !notification.is_read ? 'bg-accent/50' : ''
      }`}
    >
      <Avatar className="w-10 h-10">
        <AvatarImage src={notification.from_user?.avatar_url || ''} />
        <AvatarFallback>
          {notification.from_user?.display_name?.[0] || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{notification.title}</p>
        {notification.message && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={handleDelete}
      >
        <X className="w-4 h-4" />
      </Button>

      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
      )}
    </button>
  );
};
