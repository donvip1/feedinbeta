import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Bell, 
  Trash2, 
  Loader2, 
  CheckCheck,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

const NotificationHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        .limit(100);

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

  const handleClearAllHistory = async () => {
    if (!user) return;

    setClearing(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
      toast({
        title: 'History cleared',
        description: 'All notifications have been deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error clearing history',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error: any) {
      toast({
        title: 'Error deleting notification',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast({ title: 'All notifications marked as read' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
    }

    // Navigate based on type
    switch (notification.type) {
      case 'friend_request':
        navigate('/friends');
        break;
      case 'like':
      case 'comment':
      case 'reply':
      case 'refeed':
      case 'quote':
      case 'mention':
        if (notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        }
        break;
      case 'message':
        if (notification.related_id) {
          navigate('/messages', { state: { conversationId: notification.related_id } });
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
      case 'credit_received':
        navigate('/wallet');
        break;
      case 'live_gift':
      case 'live_invite':
        if (notification.related_id) {
          navigate(`/live/stream/${notification.related_id}`);
        }
        break;
      default:
        if (notification.related_type === 'post' && notification.related_id) {
          navigate(`/feed/post/${notification.related_id}`);
        } else if (notification.related_type === 'profile' && notification.related_id) {
          navigate(`/profile/${notification.related_id}`);
        }
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Notification History</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={notifications.length === 0 || clearing}
                  title="Clear all history"
                >
                  {clearing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-destructive" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Clear All Notifications?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your notifications. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllHistory}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="px-4 pb-2">
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger value="all" className="text-xs">
              All ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs">
              Read ({notifications.length - unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-140px)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' 
                ? "You're all caught up!"
                : filter === 'read'
                ? "No read notifications yet"
                : "Notifications will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                  !notification.is_read ? 'bg-primary/5' : ''
                }`}
              >
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={notification.from_user?.avatar_url || ''} />
                  <AvatarFallback>
                    {notification.from_user?.display_name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''}`}>
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  {notification.message && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
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
                  className="h-8 w-8 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(notification.id);
                  }}
                  disabled={deletingId === notification.id}
                >
                  {deletingId === notification.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default NotificationHistory;
