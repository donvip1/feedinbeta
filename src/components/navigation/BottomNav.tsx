import { Home, Mail, User, Zap, Wallet, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useCallback, useContext } from 'react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { UnreadBadge } from '@/components/shared/UnreadBadge';
import { RefreshContext, RefreshContextType, RefreshPage } from '@/context/RefreshContext';
import { navigationPrefetcher } from '@/lib/navigation-prefetcher';
import { memoryCache } from '@/lib/memory-cache';
import { useNavigation } from '@/context/NavigationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { prefetchProfileCounts } from '@/hooks/useProfileCounts';
import { useDistributedNotifications } from '@/hooks/useDistributedNotifications';

interface BottomNavProps {
  currentPage?: 'feed' | 'ai' | 'default';
  hidden?: boolean;
  transparent?: boolean;
}

export const BottomNav = ({ currentPage = 'default', hidden = false, transparent = true }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { haptic } = useNativeFeatures();
  const { isSubPage, hideBottomNav, isLiveStreamPage } = useNavigation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // Use distributed notifications for categorized badge counts
  const { counts: notificationCounts, markCategoryAsRead } = useDistributedNotifications();

  // Should hide: manual hidden prop, context hideBottomNav, sub-pages, or livestream pages
  const shouldHide = hidden || hideBottomNav || isSubPage || isLiveStreamPage;

  useEffect(() => {
    if (user) {
      // INSTANT: Prefetch profile counts immediately
      prefetchProfileCounts(user.id);
      
      // Try to get avatar from memory cache first (INSTANT)
      const cachedProfile = memoryCache.get<any>(`profile:${user.id}`);
      if (cachedProfile?.avatar_url) {
        setAvatarUrl(cachedProfile.avatar_url);
      } else {
        loadAvatar();
      }
      
      loadUnreadMessages();
      
      // Prefetch all nav destinations for instant navigation
      navigationPrefetcher.setUserId(user.id);
      
      // Subscribe to new messages for INSTANT real-time updates
      const channel = supabase
        .channel(`unread-messages-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload: any) => {
            // Instantly increment if message is from another user
            if (payload.new?.sender_id !== user.id) {
              setUnreadMessageCount(prev => prev + 1);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
          },
          (payload: any) => {
            // Decrement when message is marked as read
            if (payload.new?.is_read && !payload.old?.is_read && payload.new?.sender_id !== user.id) {
              setUnreadMessageCount(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadUnreadMessages = async () => {
    if (!user) return;
    
    // Get all conversations where user is a participant
    const { data: conversations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);
    
    if (!conversations || conversations.length === 0) {
      setUnreadMessageCount(0);
      return;
    }

    const conversationIds = conversations.map(c => c.conversation_id);
    
    // Count unread messages (not sent by current user and not read)
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id)
      .eq('is_read', false);
    
    setUnreadMessageCount(count || 0);
  };

  const loadAvatar = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
    if (data) {
      setAvatarUrl(data.avatar_url);
    }
  };

  const navItems = [
    { id: 'feed', label: 'Feeds', icon: Home, path: '/feed' },
    { id: 'chats', label: 'Chats', icon: Mail, path: '/messages' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
    { id: 'learn', label: 'Learn Tech', icon: BookOpen, path: '/ai/learn' },
    { id: 'ai', label: 'FeedAI', icon: Zap, path: '/ai/copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || user?.id || ''}`, isProfile: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Get refresh context (may be null if not wrapped)
  const refreshContext = useContext(RefreshContext);

  // Calculate combined counts for each nav item - ONLY show badge on chats
  const getNavBadgeCount = (itemId: string): number => {
    switch (itemId) {
      case 'chats':
        // Combine unread messages + message-related notifications (friend requests etc)
        return unreadMessageCount + notificationCounts.messages;
      default:
        // Feed and wallet notifications now go to the bell icon only
        return 0;
    }
  };

  const handleNavClick = useCallback((path: string, itemId: string) => {
    // Trigger haptic feedback
    haptic('light');
    
    // Visual feedback
    setPressedId(itemId);
    setTimeout(() => setPressedId(null), 150);
    
    const isCurrentPage = isActive(path);
    
    // Mark category as viewed when clicking on nav item
    // Only chats still uses the distributed badge system
    if (itemId === 'chats') {
      markCategoryAsRead('messages');
    }
    
    if (isCurrentPage) {
      // Already on this page - scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Also scroll any scroll containers
      document.querySelectorAll('[data-scrollable="true"]').forEach(el => {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      // Navigate to the page
      navigate(path);
    }
    
    // Trigger silent background refresh
    if (refreshContext) {
      refreshContext.triggerRefresh(itemId as RefreshPage);
    }
  }, [haptic, navigate, isActive, refreshContext, markCategoryAsRead]);

  return (
    <AnimatePresence>
      {!shouldHide && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <TooltipProvider>
            <nav 
              className={`fixed bottom-0 left-0 right-0 z-[70] native-bottom-nav ${
                transparent ? 'bg-transparent' : 'bg-background/95 backdrop-blur-md border-t border-border/50'
              }`}
              style={{
                paddingBottom: 'env(safe-area-inset-bottom)',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
              }}
            >
        <div className="max-w-screen-xl mx-auto px-2">
          <div className="flex items-center justify-between py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const isPressed = pressedId === item.id;
              const badgeCount = getNavBadgeCount(item.id);
              
              // Dynamic colors based on transparent mode
              const textColor = transparent 
                ? (active ? 'text-white' : 'text-white/80 hover:text-white')
                : (active ? 'text-primary' : 'text-muted-foreground hover:text-foreground');
              
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <motion.div
                      whileTap={{ 
                        scale: 0.85,
                        transition: { type: "spring", stiffness: 400, damping: 17 }
                      }}
                      animate={isPressed ? {
                        y: [0, -4, 0],
                        transition: { duration: 0.3, ease: "easeOut" }
                      } : {}}
                    >
                      <Button
                        onClick={() => handleNavClick(item.path, item.id)}
                        variant="ghost"
                        size="icon"
                        className={`h-12 w-12 hover:bg-transparent transition-all duration-150 touch-feedback ${textColor}`}
                      >
                        {item.isProfile && avatarUrl ? (
                          <div className={`rounded-full transition-all duration-150 ${
                            active 
                              ? transparent 
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' 
                                : 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                              : ''
                          }`}>
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={avatarUrl} />
                              <AvatarFallback><Icon className="w-4 h-4" /></AvatarFallback>
                            </Avatar>
                          </div>
                        ) : (
                          <div className="relative">
                            <Icon 
                              size={24}
                              strokeWidth={2.5}
                              className={`transition-transform duration-150 ${active ? 'scale-110' : ''}`}
                            />
                            {badgeCount > 0 && (
                              <UnreadBadge count={badgeCount} size="sm" />
                            )}
                          </div>
                        )}
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
            </nav>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
