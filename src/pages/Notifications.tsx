import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, CheckCheck, Bell, Trash2, ArrowLeft } from 'lucide-react';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Link, useNavigate } from 'react-router-dom';

interface Notification {
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
  reference_id: string | null;
  from_user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
}

export const NotificationsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [user]);

  // Realtime updates: keep the list in sync for this user
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}:page`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          from_user:profiles!notifications_from_user_id_fkey(id, display_name, avatar_url, username)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      // Map related_id to reference_id for compatibility
      const mappedData = (data || []).map(notif => ({
        ...notif,
        reference_id: notif.related_id
      }));
      setNotifications(mappedData as any || []);
    } catch (error: any) {
      toast({
        title: 'Error loading notifications',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      await loadNotifications();
      
      toast({
        title: 'All notifications marked as read',
      });
    } catch (error: any) {
      toast({
        title: 'Error marking as read',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const deleteAllNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
      
      toast({
        title: 'All notifications deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting notifications',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={markAllAsRead}
              disabled={!notifications.some(n => !n.is_read)}
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={deleteAllNotifications}
              disabled={notifications.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Link to="/notification-settings">
              <Button
                variant="ghost"
                size="icon"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <ScrollArea className="h-[calc(100vh-200px)]">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onUpdate={loadNotifications}
                />
                {index < notifications.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
