import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Radio, Mic, Users, Bell, Clock, 
  UserPlus, Hand, ChevronRight, Sparkles 
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LiveNotification {
  id: string;
  type: 'stream_live' | 'space_live' | 'scheduled_reminder' | 'invite_to_speak' | 'friend_live';
  title: string;
  message: string;
  avatarUrl?: string;
  roomId?: string;
  roomType?: 'stream' | 'space';
  createdAt: Date;
  isRead: boolean;
}

interface LiveNotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomClick?: (roomId: string, roomType: 'stream' | 'space') => void;
  liveStreams?: any[];
  liveSpaces?: any[];
}

export const LiveNotificationsPanel = ({
  isOpen,
  onClose,
  onRoomClick,
  liveStreams = [],
  liveSpaces = [],
}: LiveNotificationsPanelProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch live notifications
  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      
      try {
        // Get followed users who are live
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = following?.map(f => f.following_id) || [];
        
        // Build notifications from live streams of followed users
        const liveNotifs: LiveNotification[] = [];
        
        liveStreams.forEach(stream => {
          if (followingIds.includes(stream.user_id)) {
            liveNotifs.push({
              id: `stream-${stream.id}`,
              type: 'stream_live',
              title: stream.profiles?.display_name || stream.profiles?.username || 'Creator',
              message: `is streaming: ${stream.title}`,
              avatarUrl: stream.profiles?.avatar_url,
              roomId: stream.id,
              roomType: 'stream',
              createdAt: new Date(stream.started_at || stream.created_at),
              isRead: false,
            });
          }
        });

        liveSpaces.forEach(space => {
          if (followingIds.includes(space.user_id)) {
            liveNotifs.push({
              id: `space-${space.id}`,
              type: 'space_live',
              title: space.profiles?.display_name || space.profiles?.username || 'Creator',
              message: `started a space: ${space.title}`,
              avatarUrl: space.profiles?.avatar_url,
              roomId: space.id,
              roomType: 'space',
              createdAt: new Date(space.started_at || space.created_at),
              isRead: false,
            });
          }
        });

        // Get speak invitations (from live_space_speakers where is_invited = true)
        const { data: invites } = await supabase
          .from('live_space_speakers')
          .select(`
            id, 
            space_id, 
            created_at,
            live_spaces:space_id (
              id, title, user_id,
              profiles:user_id (display_name, username, avatar_url)
            )
          `)
          .eq('user_id', user.id)
          .eq('role', 'speaker')
          .is('left_at', null)
          .order('created_at', { ascending: false })
          .limit(5);

        invites?.forEach((invite: any) => {
          if (invite.live_spaces) {
            liveNotifs.push({
              id: `invite-${invite.id}`,
              type: 'invite_to_speak',
              title: invite.live_spaces.profiles?.display_name || 'Host',
              message: `invited you to speak in "${invite.live_spaces.title}"`,
              avatarUrl: invite.live_spaces.profiles?.avatar_url,
              roomId: invite.space_id,
              roomType: 'space',
              createdAt: new Date(invite.created_at),
              isRead: false,
            });
          }
        });

        // Sort by date (newest first)
        liveNotifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setNotifications(liveNotifs);
      } catch (error) {
        console.error('Error fetching live notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user, isOpen, liveStreams, liveSpaces]);

  const handleNotificationClick = (notif: LiveNotification) => {
    if (notif.roomId && notif.roomType && onRoomClick) {
      onRoomClick(notif.roomId, notif.roomType);
      onClose();
    }
  };

  const getNotificationIcon = (type: LiveNotification['type']) => {
    switch (type) {
      case 'stream_live':
        return <Radio className="w-4 h-4 text-red-500" />;
      case 'space_live':
        return <Mic className="w-4 h-4 text-emerald-500" />;
      case 'invite_to_speak':
        return <Hand className="w-4 h-4 text-amber-500" />;
      case 'scheduled_reminder':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'friend_live':
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-white/60" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-full max-w-sm bg-gradient-to-b from-slate-900 to-black border-l border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-white/10 p-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Live Activity</h2>
                  <p className="text-xs text-white/60">
                    {notifications.length} updates
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-white/60">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white/30" />
                </div>
                <div className="text-center">
                  <p className="text-white/80 font-medium">All caught up!</p>
                  <p className="text-sm text-white/50 mt-1">
                    Follow creators to see when they go live
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((notif, index) => (
                <motion.button
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left",
                    "bg-white/5 hover:bg-white/10 border border-white/5",
                    notif.type === 'invite_to_speak' && "border-amber-500/30 bg-amber-500/5"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={notif.avatarUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-pink-500 to-violet-600 text-white text-sm">
                        {notif.title[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                      {getNotificationIcon(notif.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-semibold">{notif.title}</span>{' '}
                      <span className="text-white/70">{notif.message}</span>
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0 mt-1" />
                </motion.button>
              ))
            )}
          </div>

          {/* Footer CTA */}
          {notifications.length > 0 && (
            <div className="sticky bottom-0 bg-gradient-to-t from-black via-black to-transparent p-4 pt-8">
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={onClose}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Find Creators to Follow
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LiveNotificationsPanel;
