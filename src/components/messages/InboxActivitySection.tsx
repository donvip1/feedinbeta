import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface FriendRequest {
  id: string;
  sender_id: string;
  created_at: string;
  sender: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface InboxActivitySectionProps {
  totalUnreadCount?: number;
  onMarkAllRead?: () => void;
}

export const InboxActivitySection = ({ 
  totalUnreadCount = 0,
  onMarkAllRead,
}: InboxActivitySectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, sender_id, created_at, sender:profiles!friend_requests_sender_id_fkey(id, display_name, username, avatar_url)')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRequests((data as any) || []);
    } catch (err) {
      console.error('Error loading friend requests:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Realtime subscription for friend requests
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`inbox-friend-requests:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadRequests]);

  const handleAccept = async (requestId: string) => {
    setProcessingIds(prev => new Set(prev).add(requestId));
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast({ title: 'Friend request accepted!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleDecline = async (requestId: string) => {
    setProcessingIds(prev => new Set(prev).add(requestId));
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  return (
    <div className="px-2 py-1">
      {/* Friend Requests Section */}
      {!loading && requests.length > 0 && (
        <>
          <div className="px-4 py-2 flex justify-between items-center">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Friend Requests
            </h4>
            <button
              onClick={() => navigate('/friends')}
              className="text-[10px] text-primary font-bold hover:underline"
            >
              See all
            </button>
          </div>

          {requests.map((req) => {
            const sender = req.sender;
            const isProcessing = processingIds.has(req.id);
            const displayName = sender?.display_name || sender?.username || 'User';
            const initials = displayName.charAt(0).toUpperCase();

            return (
              <div
                key={req.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <button
                  onClick={() => navigate(`/user/${sender?.username || sender?.id}`)}
                  className="shrink-0"
                >
                  <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                    <AvatarImage src={sender?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>

                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/user/${sender?.username || sender?.id}`)}
                    className="text-left"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground">wants to be your friend</p>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(req.id)}
                    disabled={isProcessing}
                    className="h-8 px-3 rounded-full text-xs font-semibold"
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Accept'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDecline(req.id)}
                    disabled={isProcessing}
                    className="h-8 w-8 rounded-full p-0"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div className="h-px bg-border/50 my-2 mx-3" />
        </>
      )}
      
      {/* Section Label */}
      <div className="px-4 py-2 flex justify-between items-center">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Direct Messages
        </h4>
        {totalUnreadCount > 0 && (
          <button 
            onClick={onMarkAllRead}
            className="text-[10px] text-primary font-bold hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>
    </div>
  );
};

export default InboxActivitySection;
