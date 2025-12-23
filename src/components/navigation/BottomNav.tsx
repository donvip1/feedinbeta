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

interface BottomNavProps {
  currentPage?: 'feed' | 'ai' | 'default';
  hidden?: boolean;
}

export const BottomNav = ({ currentPage = 'default', hidden = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { haptic } = useNativeFeatures();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
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
              setUnreadCount(prev => prev + 1);
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
              setUnreadCount(prev => Math.max(0, prev - 1));
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
      setUnreadCount(0);
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
    
    setUnreadCount(count || 0);
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
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}`, isProfile: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Get refresh context (may be null if not wrapped)
  const refreshContext = useContext(RefreshContext);

  const handleNavClick = useCallback((path: string, itemId: string) => {
    // Trigger haptic feedback
    haptic('light');
    
    // Visual feedback
    setPressedId(itemId);
    setTimeout(() => setPressedId(null), 150);
    
    const isCurrentPage = isActive(path);
    
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
  }, [haptic, navigate, isActive, refreshContext]);

  // Hide navigation completely when hidden prop is true
  if (hidden) {
    return null;
  }

  return (
    <TooltipProvider>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[70] bg-background/95 backdrop-blur-lg border-t border-border/50 native-bottom-nav"
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
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleNavClick(item.path, item.id)}
                      variant="ghost"
                      size="icon"
                      className={`h-12 w-12 hover:bg-transparent transition-all duration-150 touch-feedback ${
                        active ? 'text-primary' : 'text-foreground/80 hover:text-foreground'
                      }`}
                      style={{
                        transform: isPressed ? 'scale(0.9)' : 'scale(1)',
                        transition: 'transform 0.1s ease-out',
                      }}
                    >
                      {item.isProfile && avatarUrl ? (
                        <div className={`rounded-full transition-all duration-150 ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
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
                          {item.id === 'chats' && unreadCount > 0 && (
                            <UnreadBadge count={unreadCount} size="sm" />
                          )}
                        </div>
                      )}
                    </Button>
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
  );
};
