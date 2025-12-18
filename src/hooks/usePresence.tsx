import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useLocation } from 'react-router-dom';

export type PresenceStatus = 'online' | 'active' | 'offline';

interface PresenceData {
  user_id: string;
  status: PresenceStatus;
  current_section: string;
  last_seen: string;
}

export const usePresence = (userId?: string) => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState<PresenceStatus>('offline');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, PresenceData>>(new Map());

  // Determine current section based on route
  const getCurrentSection = useCallback(() => {
    const path = location.pathname;
    if (path.startsWith('/messages')) return 'messages';
    if (path.startsWith('/feed')) return 'feed';
    if (path.startsWith('/live')) return 'live';
    if (path.startsWith('/call')) return 'call';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/groups')) return 'groups';
    if (path.startsWith('/ai')) return 'ai';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/wallet')) return 'wallet';
    return 'app';
  }, [location.pathname]);

  // Get user's presence status
  const getUserStatus = useCallback((targetUserId: string): PresenceStatus => {
    const data = userStatuses.get(targetUserId);
    if (!data) return 'offline';
    return data.status;
  }, [userStatuses]);

  // Get user's current section
  const getUserSection = useCallback((targetUserId: string): string | null => {
    const data = userStatuses.get(targetUserId);
    if (!data) return null;
    return data.current_section;
  }, [userStatuses]);

  // Check if user is in messages section (active)
  const isUserActive = useCallback((targetUserId: string): boolean => {
    const data = userStatuses.get(targetUserId);
    if (!data) return false;
    return data.status === 'active' || data.current_section === 'messages';
  }, [userStatuses]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
        broadcast: {
          self: true, // Receive own broadcasts for immediate feedback
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = new Set<string>();
        const statuses = new Map<string, PresenceData>();
        
        Object.entries(state).forEach(([key, presences]) => {
          (presences as any[]).forEach((presence: any) => {
            const data = presence as PresenceData;
            if (data.user_id) {
              users.add(data.user_id);
              statuses.set(data.user_id, data);
            }
          });
        });
        
        setOnlineUsers(users);
        setUserStatuses(statuses);
        
        if (userId) {
          setIsOnline(users.has(userId));
          const targetStatus = statuses.get(userId);
          setStatus(targetStatus?.status || 'offline');
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[Presence] User joined:', newPresences);
        (newPresences as any[]).forEach((presence: any) => {
          const data = presence as PresenceData;
          if (data.user_id) {
            setOnlineUsers(prev => new Set([...prev, data.user_id]));
            setUserStatuses(prev => {
              const next = new Map(prev);
              next.set(data.user_id, data);
              return next;
            });
            if (userId && data.user_id === userId) {
              setIsOnline(true);
              setStatus(data.status || 'online');
            }
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[Presence] User left:', leftPresences);
        (leftPresences as any[]).forEach((presence: any) => {
          const data = presence as PresenceData;
          if (data.user_id) {
            setOnlineUsers(prev => {
              const next = new Set(prev);
              next.delete(data.user_id);
              return next;
            });
            setUserStatuses(prev => {
              const next = new Map(prev);
              next.delete(data.user_id);
              return next;
            });
            if (userId && data.user_id === userId) {
              setIsOnline(false);
              setStatus('offline');
            }
          }
        });
      })
      .subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          console.log('[Presence] Subscribed, tracking user');
          const currentSection = getCurrentSection();
          const presenceStatus: PresenceStatus = currentSection === 'messages' ? 'active' : 'online';
          
          await channel.track({
            user_id: user.id,
            status: presenceStatus,
            current_section: currentSection,
            last_seen: new Date().toISOString(),
          });
        }
      });

    // Update presence when route changes
    const updatePresence = async () => {
      const currentSection = getCurrentSection();
      const presenceStatus: PresenceStatus = currentSection === 'messages' ? 'active' : 'online';
      
      try {
        await channel.track({
          user_id: user.id,
          status: presenceStatus,
          current_section: currentSection,
          last_seen: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    updatePresence();

    // Handle visibility change (user switches tabs/apps)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
      }
    };

    // Handle online/offline network status
    const handleOnline = () => updatePresence();
    const handleOffline = async () => {
      try {
        await channel.untrack();
      } catch (error) {
        console.error('Error untracking presence:', error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Heartbeat to keep presence alive - more frequent for better responsiveness
    const heartbeatInterval = setInterval(updatePresence, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [user, userId, getCurrentSection]);

  // Re-track when location changes
  useEffect(() => {
    if (!user) return;

    const updateLocationPresence = async () => {
      const channel = supabase.channel('online-users');
      const currentSection = getCurrentSection();
      const presenceStatus: PresenceStatus = currentSection === 'messages' ? 'active' : 'online';
      
      try {
        await channel.track({
          user_id: user.id,
          status: presenceStatus,
          current_section: currentSection,
          last_seen: new Date().toISOString(),
        });
      } catch (error) {
        // Channel might not be subscribed yet
      }
    };

    updateLocationPresence();
  }, [location.pathname, user, getCurrentSection]);

  return { 
    isOnline, 
    status,
    onlineUsers,
    userStatuses,
    getUserStatus,
    getUserSection,
    isUserActive,
  };
};

// Helper function to format last seen
export const formatLastSeen = (lastSeen: string): string => {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString();
};

// Helper to get status text
export const getStatusText = (status: PresenceStatus, section?: string): string => {
  if (status === 'active' || section === 'messages') return 'Active now';
  if (status === 'online') return 'Online';
  return 'Offline';
};

// Helper to get status color class
export const getStatusColor = (status: PresenceStatus, section?: string): string => {
  if (status === 'active' || section === 'messages') return 'bg-blue-500';
  if (status === 'online') return 'bg-green-500';
  return 'bg-gray-400';
};
