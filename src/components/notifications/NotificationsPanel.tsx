import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, CheckCheck, Bell, Loader2 } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { NotificationPreferences } from './NotificationPreferences';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  related_type: string | null;
  from_user_id: string | null;
  is_read: boolean;
  created_at: string;
  from_user: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface NotificationsPanelProps {
  onClose: () => void;
  onUpdate: () => void;
}

export const NotificationsPanel = ({ onClose, onUpdate }: NotificationsPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          from_user:profiles!notifications_from_user_id_fkey(display_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data as any || []);
    } catch (error: any) {
      toast({
        title: 'Error loading notifications',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Subscribe to real-time notification changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-panel:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Add new notification to the top
            const newNotification = payload.new as any;
            // Fetch the from_user profile
            supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', newNotification.from_user_id)
              .single()
              .then(({ data: profile }) => {
                setNotifications(prev => [{
                  ...newNotification,
                  from_user: profile || null
                }, ...prev]);
              });
          } else if (payload.eventType === 'UPDATE') {
            // Update existing notification
            setNotifications(prev => prev.map(n => 
              n.id === payload.new.id 
                ? { ...n, ...payload.new as Notification }
                : n
            ));
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted notification
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          }
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onUpdate]);

  const markAllAsRead = async () => {
    if (!user || markingAllRead) return;

    setMarkingAllRead(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state immediately
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      onUpdate();
      
      toast({
        title: 'All notifications marked as read',
      });
    } catch (error: any) {
      toast({
        title: 'Error marking as read',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationUpdate = useCallback(() => {
    loadNotifications();
    onUpdate();
  }, [loadNotifications, onUpdate]);

  if (showPreferences) {
    return (
      <NotificationPreferences
        onClose={() => setShowPreferences(false)}
        onBack={() => setShowPreferences(false)}
      />
    );
  }

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={markAllAsRead}
              disabled={!hasUnread || markingAllRead}
              title="Mark all as read"
            >
              {markingAllRead ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPreferences(true)}
              title="Notification settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {hasUnread && (
          <p className="text-xs text-muted-foreground">
            {notifications.filter(n => !n.is_read).length} unread
          </p>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="h-[500px] max-h-[calc(100vh-200px)]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              When you get likes, comments, or messages, they'll show up here
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onUpdate={handleNotificationUpdate}
                  onClose={onClose}
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
