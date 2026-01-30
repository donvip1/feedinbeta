import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { User, Image, Radio, Send, ChevronRight, RefreshCw, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  sparkle: '✨',
  custom: '🎁',
};

export const ReceivedGifts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const { data: gifts, isLoading, refetch } = useQuery({
    queryKey: ['received-gifts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_analytics')
        .select(`
          *,
          sender:profiles!gift_analytics_sender_id_fkey(
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Real-time subscription for received gifts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('received-gifts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gift_analytics',
          filter: `receiver_id=eq.${user.id}`,
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

  const handleConvertGift = async (giftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConvertingId(giftId);
    
    try {
      const { data, error } = await supabase.rpc('convert_gift', { p_gift_id: giftId });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; credits_added?: number };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to convert gift');
      }
      
      toast.success(`Gift converted! +${result.credits_added} credits added`);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unconverted-gifts'] });
    } catch (error: any) {
      console.error('Error converting gift:', error);
      toast.error(error.message || 'Failed to convert gift');
    } finally {
      setConvertingId(null);
    }
  };

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
        <p>No gifts received yet</p>
        <p className="text-sm">Gifts you receive will appear here</p>
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
        const sender = gift.sender as any;
        const netAmount = gift.credit_value - (gift.platform_fee || 0);
        const clickable = isClickable(gift);
        const isConverted = gift.is_converted === true;
        const isConverting = convertingId === gift.id;
        
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
                <AvatarImage src={sender?.avatar_url} />
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {sender?.display_name || sender?.username || 'Anonymous'}
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
              {isConverted ? (
                <div className="text-right">
                  <div className="flex items-center gap-1 text-green-500">
                    <Check className="w-3 h-3" />
                    <span className="font-bold">+{netAmount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">converted</p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-bold text-yellow-500">{netAmount}</p>
                    <p className="text-xs text-muted-foreground">credits</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleConvertGift(gift.id, e)}
                    disabled={isConverting}
                    className="h-7 px-2 text-xs border-green-500/50 text-green-500 hover:bg-green-500/10"
                  >
                    {isConverting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Convert
                      </>
                    )}
                  </Button>
                </div>
              )}
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
