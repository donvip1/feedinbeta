import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, CheckCheck, Bell, Loader2, History, Trash2 } from 'lucide-react';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Load ONLY unread notifications for the panel
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
        .eq('is_read', false) // Only fetch unread
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
            // Add new notification to the top (only if unread)
            const newNotification = payload.new as any;
            if (!newNotification.is_read) {
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
            }
          } else if (payload.eventType === 'UPDATE') {
            // If marked as read, remove from panel
            const updated = payload.new as any;
            if (updated.is_read) {
              setNotifications(prev => prev.filter(n => n.id !== updated.id));
            } else {
              // Update existing notification
              setNotifications(prev => prev.map(n => 
                n.id === updated.id 
                  ? { ...n, ...updated }
                  : n
              ));
            }
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

      // Clear local state - all marked as read means empty panel
      setNotifications([]);
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

  const handleViewHistory = () => {
    onClose();
    navigate('/notifications/history');
  };

  if (showPreferences) {
    return (
      <NotificationPreferences
        onClose={() => setShowPreferences(false)}
        onBack={() => setShowPreferences(false)}
      />
    );
  }

  return (
    <div className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewHistory}
              title="View history"
              className="h-8 w-8"
            >
              <History className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={markAllAsRead}
              disabled={notifications.length === 0 || markingAllRead}
              title="Mark all as read"
              className="h-8 w-8"
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
              className="h-8 w-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {notifications.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {notifications.length} unread notification{notifications.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Notifications List - ONLY UNREAD */}
      <ScrollArea className="h-[400px] max-h-[calc(100vh-250px)]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground font-medium">You're all caught up!</p>
            <p className="text-xs text-muted-foreground mt-2">
              No new notifications
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={handleViewHistory}
              className="mt-4 text-primary"
            >
              View notification history
            </Button>
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

      {/* Footer - View History Link */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewHistory}
            className="w-full text-primary hover:text-primary/80"
          >
            <History className="w-4 h-4 mr-2" />
            View all notification history
          </Button>
        </div>
      )}
    </div>
  );
};
