import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X, Check, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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
  const { toast } = useToast();
  const { user } = useAuth();
  const [responding, setResponding] = useState(false);

  const handleFriendRequestResponse = async (e: React.MouseEvent, accept: boolean) => {
    e.stopPropagation();
    if (!user?.id || !notification.related_id) return;

    setResponding(true);
    try {
      // Find the friend request
      const { data: request, error: findError } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', notification.related_id)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .single();

      if (findError || !request) {
        toast({
          title: 'Request not found',
          description: 'This friend request may have been cancelled',
          variant: 'destructive',
        });
        // Mark notification as read and refresh
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);
        onUpdate();
        return;
      }

      // Update the friend request status
      const newStatus = accept ? 'accepted' : 'rejected';
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // If accepted, notify the sender
      if (accept) {
        await supabase
          .from('notifications')
          .insert({
            user_id: notification.related_id,
            from_user_id: user.id,
            type: 'friend_request_accepted',
            title: 'Friend request accepted',
            message: 'You can now start chatting!',
            related_id: user.id,
            related_type: 'profile'
          });
      }

      // Mark this notification as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      toast({
        title: accept ? 'Friend request accepted!' : 'Friend request declined',
        description: accept ? 'You can now chat with each other' : undefined,
      });

      onUpdate();
    } catch (error: any) {
      console.error('Error responding to friend request:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setResponding(false);
    }
  };

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
        if (notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        }
        break;
        
      case 'comment':
      case 'reply':
        if (notification.related_id) {
          // Check if related_type is 'comment' (new format) or 'post' (old format)
          if (notification.related_type === 'comment') {
            // New format: related_id is the comment ID
            try {
              const { data: comment } = await supabase
                .from('post_comments')
                .select('post_id')
                .eq('id', notification.related_id)
                .maybeSingle();
              
              if (comment?.post_id) {
                navigate(`/feed/post/${comment.post_id}?commentId=${notification.related_id}`);
              }
            } catch (error) {
              console.error('Error fetching comment:', error);
            }
          } else {
            // Old format: related_id is the post ID
            navigate(`/feed/post/${notification.related_id}`);
          }
        }
        break;
        
      case 'message':
        if (notification.related_id) {
          navigate('/messages', { state: { conversationId: notification.related_id } });
        }
        break;
        
      case 'story_reply':
      case 'story_reaction':
        if (notification.related_id) {
          navigate(`/story/${notification.related_id}`);
        }
        break;
        
      case 'follow':
      case 'friend_request_accepted':
        if (notification.related_id) {
          navigate(`/profile/${notification.related_id}`);
        }
        break;
        
      case 'gift':
      case 'gift_received':
        if (notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        }
        break;
        
      case 'live_gift':
        if (notification.related_id) {
          navigate(`/live/${notification.related_id}`);
        }
        break;
        
      case 'mention':
        if (notification.related_type === 'post' && notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        } else if (notification.related_type === 'comment' && notification.related_id) {
          try {
            const { data: comment } = await supabase
              .from('post_comments')
              .select('post_id')
              .eq('id', notification.related_id)
              .maybeSingle();
            
            if (comment?.post_id) {
              navigate(`/feed/post/${comment.post_id}?commentId=${notification.related_id}`);
            }
          } catch (error) {
            console.error('Error fetching comment for mention:', error);
          }
        }
        break;
        
      case 'refeed':
      case 'quote':
        if (notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        }
        break;
        
      case 'promotion':
      case 'promotion_reward':
        if (notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        } else {
          navigate('/promotions');
        }
        break;
        
      case 'live_invite':
        if (notification.related_id) {
          navigate(`/live/${notification.related_id}`);
        }
        break;
        
      default:
        if (notification.related_type === 'post' && notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
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

  // Special rendering for friend request notifications with inline accept/reject
  if (notification.type === 'friend_request' && !notification.is_read) {
    return (
      <div
        className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors ${
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
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">{notification.title}</p>
          </div>
          {notification.message && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {notification.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
          
          {/* Inline Accept/Reject Buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={(e) => handleFriendRequestResponse(e, true)}
              disabled={responding}
              className="bg-primary hover:bg-primary/90 h-8 px-4"
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleFriendRequestResponse(e, false)}
              disabled={responding}
              className="border-border h-8 px-4"
            >
              <X className="w-4 h-4 mr-1" />
              Decline
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={handleDelete}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

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