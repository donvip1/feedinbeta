import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PresenceStatus } from './usePresence';

interface MemberPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: string;
  currentSection?: string;
}

interface UseGroupPresenceOptions {
  groupId: string;
  memberIds: string[];
}

export const useGroupPresence = ({ groupId, memberIds }: UseGroupPresenceOptions) => {
  const { user } = useAuth();
  const [memberPresences, setMemberPresences] = useState<Map<string, MemberPresence>>(new Map());
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Calculate online count
  const onlineCount = useMemo(() => {
    let count = 0;
    memberPresences.forEach(presence => {
      if (presence.status === 'online' || presence.status === 'active' || presence.status === 'away') {
        count++;
      }
    });
    return count;
  }, [memberPresences]);

  // Get list of online member IDs
  const onlineMembers = useMemo(() => {
    const online: string[] = [];
    memberPresences.forEach((presence, id) => {
      if (presence.status === 'online' || presence.status === 'active') {
        online.push(id);
      }
    });
    return online;
  }, [memberPresences]);

  // Get status for a specific member
  const getMemberStatus = useCallback((userId: string): PresenceStatus => {
    return memberPresences.get(userId)?.status || 'offline';
  }, [memberPresences]);

  // Get last seen for a specific member
  const getMemberLastSeen = useCallback((userId: string): string | null => {
    return memberPresences.get(userId)?.lastSeen || null;
  }, [memberPresences]);

  // Check if a member is online
  const isMemberOnline = useCallback((userId: string): boolean => {
    const status = memberPresences.get(userId)?.status;
    return status === 'online' || status === 'active';
  }, [memberPresences]);

  // Subscribe to presence channel
  useEffect(() => {
    if (!user?.id || memberIds.length === 0) return;

    const channel = supabase.channel(`group-presence-${groupId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences = new Map<string, MemberPresence>();
        
        // Process presence state for all members
        Object.entries(state).forEach(([key, data]) => {
          (data as any[]).forEach((presence: any) => {
            if (memberIds.includes(presence.user_id)) {
              presences.set(presence.user_id, {
                userId: presence.user_id,
                status: presence.status || 'online',
                lastSeen: presence.last_seen || new Date().toISOString(),
                currentSection: presence.current_section,
              });
            }
          });
        });
        
        setMemberPresences(presences);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        (newPresences as any[]).forEach((presence: any) => {
          if (memberIds.includes(presence.user_id)) {
            setMemberPresences(prev => {
              const next = new Map(prev);
              next.set(presence.user_id, {
                userId: presence.user_id,
                status: presence.status || 'online',
                lastSeen: presence.last_seen || new Date().toISOString(),
                currentSection: presence.current_section,
              });
              return next;
            });
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        (leftPresences as any[]).forEach((presence: any) => {
          if (memberIds.includes(presence.user_id)) {
            setMemberPresences(prev => {
              const next = new Map(prev);
              next.set(presence.user_id, {
                userId: presence.user_id,
                status: 'offline',
                lastSeen: new Date().toISOString(),
              });
              return next;
            });
          }
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          // Track own presence
          await channel.track({
            user_id: user.id,
            status: 'online',
            last_seen: new Date().toISOString(),
            current_section: 'group_chat',
          });
        }
      });

    return () => {
      setIsSubscribed(false);
      supabase.removeChannel(channel);
    };
  }, [user?.id, groupId, memberIds.join(',')]);

  // Also listen to global presence channel for status updates
  useEffect(() => {
    if (!user?.id || memberIds.length === 0) return;

    const globalChannel = supabase.channel('online-users');
    
    const handleSync = () => {
      const state = globalChannel.presenceState();
      
      setMemberPresences(prev => {
        const next = new Map(prev);
        
        Object.entries(state).forEach(([key, data]) => {
          (data as any[]).forEach((presence: any) => {
            if (memberIds.includes(presence.user_id)) {
              next.set(presence.user_id, {
                userId: presence.user_id,
                status: presence.status || 'online',
                lastSeen: presence.last_seen || new Date().toISOString(),
                currentSection: presence.current_section,
              });
            }
          });
        });
        
        return next;
      });
    };

    globalChannel.on('presence', { event: 'sync' }, handleSync);
    
    // Trigger initial sync if channel is already subscribed
    if (globalChannel.state === 'joined') {
      handleSync();
    }

    // Cleanup not needed as we don't want to remove the global channel
    return () => {};
  }, [user?.id, memberIds.join(',')]);

  // Format online text for header
  const getOnlineText = useCallback((): string => {
    const total = memberIds.length;
    if (onlineCount === 0) {
      return `${total} members`;
    }
    return `${total} members, ${onlineCount} online`;
  }, [memberIds.length, onlineCount]);

  return {
    memberPresences,
    onlineCount,
    onlineMembers,
    isSubscribed,
    getMemberStatus,
    getMemberLastSeen,
    isMemberOnline,
    getOnlineText,
  };
};

// Format last seen time
export const formatLastSeen = (lastSeen: string): string => {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return date.toLocaleDateString();
};

// Get status color for indicator dot
export const getPresenceColor = (status: PresenceStatus): string => {
  switch (status) {
    case 'active': return 'bg-blue-500';
    case 'online': return 'bg-green-500';
    case 'away': return 'bg-yellow-500';
    default: return 'bg-slate-500';
  }
};
