import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Settings, History, Loader2, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { NotificationItem } from './NotificationItem';
import { NotificationPreferences } from './NotificationPreferences';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
  from_user_id: string | null;
  from_user: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface NotificationsPanelProps {
  onClose: () => void;
  onUpdate: () => void;
  position?: { x: number; y: number };
}

// Message-related types are excluded from general notifications
// since they have their own badge on the Messages icon
// NOTE: We now include all other types including wallet/credit notifications
const MESSAGE_NOTIFICATION_TYPES = [
  'message', 'group_message'
];

export const NotificationsPanel = ({ onClose, onUpdate, position }: NotificationsPanelProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Load ONLY unread notifications for the panel (excluding message types)
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
        .eq('is_read', false)
        .not('type', 'in', `(${MESSAGE_NOTIFICATION_TYPES.map(t => `"${t}"`).join(',')})`)
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
            // Add new notification to the top (only if unread and not a message type)
            const newNotification = payload.new as any;
            if (!newNotification.is_read && !MESSAGE_NOTIFICATION_TYPES.includes(newNotification.type)) {
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

  // Calculate panel position - anchor to top-left near the bell
  const panelStyle: React.CSSProperties = position ? {
    position: 'fixed',
    left: Math.max(16, Math.min(position.x, window.innerWidth - 340)), // Keep within bounds
    top: position.y,
    zIndex: 50,
  } : {
    position: 'fixed',
    left: 16,
    top: 64,
    zIndex: 50,
  };

  if (showPreferences) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={panelStyle}
        className="w-80 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-2xl shadow-xl overflow-hidden"
      >
        <NotificationPreferences
          onClose={() => setShowPreferences(false)}
          onBack={() => setShowPreferences(false)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={panelStyle}
      className="w-80 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Header with Close Button */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-base font-semibold">Notifications</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={markAllAsRead}
              disabled={notifications.length === 0 || markingAllRead}
              title="Mark all as read"
              className="h-7 w-7 rounded-full"
            >
              {markingAllRead ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPreferences(true)}
              title="Settings"
              className="h-7 w-7 rounded-full"
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close"
              className="h-7 w-7 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {notifications.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1 ml-10">
            {notifications.length} unread
          </p>
        )}
      </div>

      {/* Notifications List - ONLY UNREAD */}
      <ScrollArea className="h-[320px] max-h-[calc(100vh-200px)]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium text-sm">You're all caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No new notifications
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={handleViewHistory}
              className="mt-3 text-primary text-xs"
            >
              View history
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
        <div className="p-2 border-t border-border bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewHistory}
            className="w-full text-primary hover:text-primary/80 text-xs h-8"
          >
            <History className="w-3.5 h-3.5 mr-1.5" />
            View all history
          </Button>
        </div>
      )}
    </motion.div>
  );
};
