import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NotificationsPanel } from './NotificationsPanel';
import { notificationSounds } from '@/lib/notification-sounds';

interface NotificationBellProps {
  onPanelOpen?: () => void;
  onPanelClose?: () => void;
}

export const NotificationBell = ({ onPanelOpen, onPanelClose }: NotificationBellProps) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const bellRef = useRef<HTMLButtonElement>(null);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    loadUnreadCount();

    // Subscribe to real-time notification updates for instant badge sync
    const channel = supabase
      .channel(`notifications-bell:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          // New notification arrived - increment count
          setUnreadCount(prev => prev + 1);
          
          // Play appropriate sound based on notification type
          const notificationType = payload.new?.type;
          if (notificationType) {
            notificationSounds.playForNotification(notificationType);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          // Notification updated - refresh count if read status changed
          if (payload.new?.is_read !== payload.old?.is_read) {
            loadUnreadCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Notification deleted - refresh count
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadUnreadCount]);

  const handleTogglePanel = (e: React.MouseEvent) => {
    const newState = !showPanel;
    
    if (newState && bellRef.current) {
      // Get bell button position for panel placement
      const rect = bellRef.current.getBoundingClientRect();
      setPanelPosition({
        x: rect.left,
        y: rect.bottom + 8 // 8px gap below the bell
      });
    }
    
    setShowPanel(newState);
    if (newState) {
      onPanelOpen?.();
    } else {
      onPanelClose?.();
    }
  };

  const handleClosePanel = () => {
    setShowPanel(false);
    onPanelClose?.();
  };

  const handleUpdate = useCallback(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  return (
    <>
      <div className="relative">
        <Button
          ref={bellRef}
          variant="ghost"
          size="icon"
          onClick={handleTogglePanel}
          className="relative"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {showPanel && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" 
            onClick={handleClosePanel}
          />
          <NotificationsPanel
            onClose={handleClosePanel}
            onUpdate={handleUpdate}
            position={panelPosition}
          />
        </>
      )}
    </>
  );
};
