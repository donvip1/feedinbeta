import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { User, Image, Radio, Send, ChevronRight } from 'lucide-react';

const giftEmojis: Record<string, string> = {
  heart: '❤️',
  star: '⭐',
  fire: '🔥',
  clap: '👏',
  rocket: '🚀',
  diamond: '💎',
  crown: '👑',
  rose: '🌹',
  gift: '🎁',
  money: '💰',
};

export const SentGifts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: gifts, isLoading, refetch } = useQuery({
    queryKey: ['sent-gifts', user?.id],
    queryFn: async () => {
      // First get gift analytics
      const { data: giftData, error } = await supabase
        .from('gift_analytics')
        .select('*')
        .eq('sender_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Get unique receiver IDs
      const receiverIds = [...new Set(giftData?.map(g => g.receiver_id) || [])];
      
      // Fetch receiver profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', receiverIds);

      // Map profiles to gifts
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return giftData?.map(gift => ({
        ...gift,
        receiver: profileMap.get(gift.receiver_id) || null,
      }));
    },
    enabled: !!user,
  });

  // Real-time subscription for sent gifts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('sent-gifts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_analytics',
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (!gifts || gifts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No gifts sent yet</p>
        <p className="text-sm">Gifts you send will appear here</p>
      </div>
    );
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'post': return <Image className="w-3 h-3" />;
      case 'live': return <Radio className="w-3 h-3" />;
      case 'direct': return <Send className="w-3 h-3" />;
      default: return null;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'post': return 'Post';
      case 'live': return 'Live';
      case 'direct': return 'Direct';
      default: return sourceType;
    }
  };

  const handleGiftClick = (gift: any) => {
    if (gift.source_type === 'post' && gift.source_id) {
      navigate(`/feed/post/${gift.source_id}`);
    } else if (gift.source_type === 'live' && gift.source_id) {
      navigate(`/live/stream/${gift.source_id}`);
    }
  };

  const isClickable = (gift: any) => {
    return (gift.source_type === 'post' || gift.source_type === 'live') && gift.source_id;
  };

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {gifts.map((gift) => {
        const receiver = gift.receiver as any;
        const clickable = isClickable(gift);
        
        return (
          <div
            key={gift.id}
            onClick={() => clickable && handleGiftClick(gift)}
            className={`flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors ${clickable ? 'cursor-pointer' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {giftEmojis[gift.gift_type] || '🎁'}
              </div>
              <Avatar className="w-8 h-8">
                <AvatarImage src={receiver?.avatar_url} />
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  To: {receiver?.display_name || receiver?.username || 'Unknown'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(gift.created_at), 'MMM d, h:mm a')}</span>
                  <Badge variant="outline" className="text-xs px-1 py-0 flex items-center gap-1">
                    {getSourceIcon(gift.source_type)}
                    {getSourceLabel(gift.source_type)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-bold text-red-500">-{gift.credit_value}</p>
                <p className="text-xs text-muted-foreground">credits</p>
              </div>
              {clickable && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
