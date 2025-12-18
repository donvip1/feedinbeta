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
    // Mark as read immediately
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      onUpdate();
    }

    // Navigate directly to the exact content based on type
    switch (notification.type) {
      case 'friend_request':
        navigate('/friends');
        break;
        
      case 'like':
        // Navigate directly to the post
        if (notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        }
        break;
        
      case 'comment':
      case 'reply':
        // Navigate to the post with the comment - fetch post_id from comment
        if (notification.related_id) {
          try {
            const { data: comment } = await supabase
              .from('post_comments')
              .select('post_id')
              .eq('id', notification.related_id)
              .single();
            
            if (comment?.post_id) {
              navigate(`/post/${comment.post_id}`, { 
                state: { openComments: true, highlightComment: notification.related_id } 
              });
            }
          } catch (error) {
            console.error('Error fetching comment:', error);
          }
        }
        break;
        
      case 'message':
        // Navigate directly to the conversation
        if (notification.related_id) {
          navigate('/messages', { state: { conversationId: notification.related_id } });
        }
        break;
        
      case 'story_reply':
      case 'story_reaction':
        // Navigate to the story
        if (notification.related_id) {
          navigate(`/story/${notification.related_id}`);
        }
        break;
        
      case 'follow':
        // Navigate to the user's profile who followed
        if (notification.related_id) {
          navigate(`/profile/${notification.related_id}`);
        }
        break;
        
      case 'gift':
      case 'gift_received':
        // Navigate to the post where gift was sent
        if (notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        }
        break;
        
      case 'live_gift':
        // Navigate to live stream
        if (notification.related_id) {
          navigate(`/live/${notification.related_id}`);
        }
        break;
        
      case 'mention':
        // Navigate to the post or comment where mentioned
        if (notification.related_type === 'post' && notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        } else if (notification.related_type === 'comment' && notification.related_id) {
          try {
            const { data: comment } = await supabase
              .from('post_comments')
              .select('post_id')
              .eq('id', notification.related_id)
              .single();
            
            if (comment?.post_id) {
              navigate(`/post/${comment.post_id}`, { 
                state: { openComments: true, highlightComment: notification.related_id } 
              });
            }
          } catch (error) {
            console.error('Error fetching comment for mention:', error);
          }
        }
        break;
        
      case 'refeed':
      case 'quote':
        // Navigate to the refeed/quote post
        if (notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        }
        break;
        
      case 'promotion':
      case 'promotion_reward':
        // Navigate to the promoted post
        if (notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        } else {
          navigate('/promotions');
        }
        break;
        
      case 'live_invite':
        // Navigate to live stream
        if (notification.related_id) {
          navigate(`/live/${notification.related_id}`);
        }
        break;
        
      default:
        // Fallback: if related_type is post, navigate to post
        if (notification.related_type === 'post' && notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        } else if (notification.related_type === 'profile' && notification.related_id) {
          navigate(`/profile/${notification.related_id}`);
        } else {
          navigate('/feed');
        }
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
        !notification.is_read ? 'bg-accent/50 font-semibold' : ''
      }`}
    >
      <Avatar className="w-10 h-10">
        <AvatarImage src={notification.from_user?.avatar_url || ''} />
        <AvatarFallback>
          {notification.from_user?.display_name?.[0] || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''}`}>{notification.title}</p>
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
