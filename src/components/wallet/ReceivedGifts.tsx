import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { User, Image, Radio, Send } from 'lucide-react';

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

export const ReceivedGifts = () => {
  const { user } = useAuth();

  const { data: gifts, isLoading } = useQuery({
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

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {gifts.map((gift) => {
        const sender = gift.sender as any;
        const netAmount = gift.credit_value - (gift.platform_fee || 0);
        
        return (
          <div
            key={gift.id}
            className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
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
            <div className="text-right">
              <p className="font-bold text-green-500">+{netAmount}</p>
              <p className="text-xs text-muted-foreground">credits</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
