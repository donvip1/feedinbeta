import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Bell, Heart, MessageCircle, UserPlus, Megaphone } from 'lucide-react';

interface NotificationPayload {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  related_type: string | null;
  from_user_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationToastManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`realtime-notifications:${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        async (payload) => {
          const notification = payload.new as NotificationPayload;
          
          // Fetch sender details if available
          let senderName = 'Someone';
          if (notification.from_user_id) {
            const { data } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', notification.from_user_id)
              .single();
            if (data?.display_name) {
              senderName = data.display_name;
            }
          }

          // Determine icon based on notification type
          const getIcon = () => {
            if (notification.type.includes('like')) return '❤️';
            if (notification.type.includes('comment')) return '💬';
            if (notification.type.includes('follow') || notification.type === 'friend_request') return '👤';
            if (notification.type.includes('message')) return '✉️';
            return '🔔';
          };

          // For message notifications, don't show full toast
          if (notification.type.includes('message')) {
            // Direct navigation without showing notification
            if (notification.related_id) {
              // Mark as read silently
              supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notification.id);
            }
          } else {
            // Show toast for non-message notifications
            toast({
              title: notification.title || 'New Notification',
              description: notification.message || `${senderName} interacted with your content`,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => handleNotificationClick(notification)
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleNotificationClick = (notification: NotificationPayload) => {
    // Mark as read
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)
      .then(() => {
        // Navigate based on notification type
        if (notification.type === 'new_post' && notification.related_id) {
          navigate(`/feed?post=${notification.related_id}`);
        } else if (notification.type.includes('comment') && notification.related_id) {
          navigate(`/feed?post=${notification.related_id}`);
        } else if (notification.type.includes('like') && notification.related_id) {
          navigate(`/feed?post=${notification.related_id}`);
        } else if (notification.type.includes('message')) {
          navigate('/messages');
        } else if (notification.from_user_id) {
          navigate(`/profile/${notification.from_user_id}`);
        } else {
          navigate('/notifications');
        }
      });
  };

  return null;
};
