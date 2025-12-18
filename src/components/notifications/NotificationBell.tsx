import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { NotificationsPanel } from './NotificationsPanel';

interface NotificationBellProps {
  onPanelOpen?: () => void;
  onPanelClose?: () => void;
}

export const NotificationBell = ({ onPanelOpen, onPanelClose }: NotificationBellProps) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      subscribeToNotifications();
    }
  }, [user]);

  const loadUnreadCount = async () => {
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
  };

  const subscribeToNotifications = () => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleTogglePanel = () => {
    const newState = !showPanel;
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

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTogglePanel}
          className="relative"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {showPanel && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={handleClosePanel}
          />
          <NotificationsPanel
            onClose={handleClosePanel}
            onUpdate={loadUnreadCount}
          />
        </>
      )}
    </>
  );
};
