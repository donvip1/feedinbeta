import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const NotificationBadge = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadUnreadCount();

    // Subscribe to badge updates
    const channel = supabase
      .channel('notification-badges')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_badges'
        },
        (payload) => {
          if (payload.new && 'unread_count' in payload.new) {
            setUnreadCount(payload.new.unread_count as number);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notification_badges')
      .select('unread_count')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setUnreadCount(data.unread_count);
    }
  };

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative p-2 hover:bg-accent rounded-full transition-colors"
    >
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};