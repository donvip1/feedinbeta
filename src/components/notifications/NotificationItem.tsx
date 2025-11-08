import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X, Check, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface NotificationItemProps {
  notification: {
    id: string;
    user_id: string;
    type: string;
    message: string | null;
    reference_id: string | null; 
    is_read: boolean;
    created_at: string;
    from_user: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      username: string | null;
    } | null;
  };
  onUpdate: () => void;
}

export const NotificationItem = ({ notification, onUpdate }: NotificationItemProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isHandled, setIsHandled] = useState(false);
  const [handledMessage, setHandledMessage] = useState('');

  const handleGeneralClick = async () => {
    // Mark as read first
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      onUpdate();
    }

    // Direct-to-DM deep links for message notifications
    if (
      ['message', 'new_message', 'chat', 'dm'].includes(notification.type) ||
      (notification.reference_id && notification.type?.includes('message'))
    ) {
      if (notification.reference_id) {
        navigate(`/messages?conversation=${notification.reference_id}`);
        return;
      }
      if (notification.from_user) {
        navigate(`/messages?user=${notification.from_user.id}`);
        return;
      }
    }

    if (notification.type === 'new_post' && notification.reference_id) {
      navigate(`/feed?post=${notification.reference_id}`);
    } else if ((notification.type === 'info' || notification.type === 'friend_request') && notification.from_user) {
      navigate(`/profile/${notification.from_user.id}`);
    }
  };

  const handleFriendRequest = async (e: React.MouseEvent, accept: boolean) => {
    e.stopPropagation();
    if (!notification.reference_id || !user || !notification.from_user) return;

    try {
      // Update the friend request status
      const { error: reqErr } = await supabase
        .from('friend_requests')
        .update({ 
          status: accept ? 'accepted' : 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.reference_id)
        .eq('receiver_id', user.id);

      if (reqErr) throw reqErr;

      if (accept) {
        setHandledMessage(`You can now message ${notification.from_user.display_name}.`);
        // Notify the sender
        await supabase.from('notifications').insert([{
          user_id: notification.from_user.id,
          from_user_id: user.id,
          type: 'info',
          title: 'Message Request Accepted',
          message: `${user.user_metadata.display_name || 'A user'} accepted your message request.`,
        }]);
      } else {
        setHandledMessage('Message request declined.');
      }
      setIsHandled(true);

      // Mark notification as read
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      toast({ title: `Message request ${accept ? 'accepted' : 'declined'}.` });
      onUpdate();

    } catch (error: any) {
      console.error('Error handling request:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setIsHandled(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from('notifications').delete().eq('id', notification.id);
      onUpdate();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const isFriendRequest = notification.type === 'friend_request';

  if (isHandled || (isFriendRequest && notification.is_read)) {
    return (
      <div className="p-4 flex items-center gap-3 bg-accent/50" onClick={handleGeneralClick}>
        <Info className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">
                {isHandled 
                    ? handledMessage 
                    : `You responded to the message request from ${notification.from_user?.display_name}.`
                }
            </p>
             <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 hover:bg-accent transition-colors ${!notification.is_read ? 'bg-accent/50' : ''}`}>
        <div className="flex items-start gap-3 cursor-pointer" onClick={handleGeneralClick}>
            <Avatar className="w-10 h-10">
                <AvatarImage src={notification.from_user?.avatar_url || ''} />
                <AvatarFallback>{notification.from_user?.display_name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{notification.message || ''}</p>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
            </div>
            {!isFriendRequest && (
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleDelete}>
                    <X className="w-4 h-4" />
                </Button>
            )}
            {!notification.is_read && (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
            )}
        </div>
        {isFriendRequest && !notification.is_read && (
            <div className="flex items-center gap-2 mt-2 pl-12">
                <Button size="sm" onClick={(e) => handleFriendRequest(e, true)} className="bg-green-500 hover:bg-green-600">
                    <Check className="w-4 h-4 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => handleFriendRequest(e, false)}>
                    <X className="w-4 h-4 mr-1" /> Decline
                </Button>
            </div>
        )}
    </div>
  );
};