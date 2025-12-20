import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Gift, Send, ArrowDownLeft, Sparkles } from 'lucide-react';
import { ReceivedGifts } from './ReceivedGifts';
import { SentGifts } from './SentGifts';
import { SendDirectGiftModal } from './SendDirectGiftModal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const GiftsTab = () => {
  const { user } = useAuth();
  const [showSendGiftModal, setShowSendGiftModal] = useState(false);

  // Fetch gift statistics
  const { data: giftStats } = useQuery({
    queryKey: ['gift-stats', user?.id],
    queryFn: async () => {
      // Get received gifts count and total
      const { data: received, error: recError } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee')
        .eq('receiver_id', user?.id);

      if (recError) throw recError;

      // Get sent gifts count and total
      const { data: sent, error: sentError } = await supabase
        .from('gift_analytics')
        .select('credit_value')
        .eq('sender_id', user?.id);

      if (sentError) throw sentError;

      const receivedCount = received?.length || 0;
      const receivedTotal = received?.reduce((sum, g) => sum + (g.credit_value - (g.platform_fee || 0)), 0) || 0;
      const sentCount = sent?.length || 0;
      const sentTotal = sent?.reduce((sum, g) => sum + g.credit_value, 0) || 0;

      return {
        receivedCount,
        receivedTotal,
        sentCount,
        sentTotal,
      };
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-5">
      {/* Gift Stats Cards - Compact on mobile */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">Received</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-green-500">
            {giftStats?.receivedCount || 0}
            <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">gifts</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            +{giftStats?.receivedTotal || 0} credits
          </p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Send className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Sent</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-primary">
            {giftStats?.sentCount || 0}
            <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">gifts</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            -{giftStats?.sentTotal || 0} credits
          </p>
        </div>
      </div>

      {/* Send Gift Button */}
      <Button 
        onClick={() => setShowSendGiftModal(true)} 
        className="w-full"
        size="default"
      >
        <Gift className="w-4 h-4 mr-2" />
        Send Gift to Someone
      </Button>

      {/* Gifts Tabs - Card with compact styling */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Gift History</h3>
          </div>
        </div>
        <div className="p-3">
          <Tabs defaultValue="received">
            <TabsList className="w-full h-10">
              <TabsTrigger value="received" className="flex-1 text-xs sm:text-sm">
                Received ({giftStats?.receivedCount || 0})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex-1 text-xs sm:text-sm">
                Sent ({giftStats?.sentCount || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="received" className="mt-3">
              <ReceivedGifts />
            </TabsContent>
            <TabsContent value="sent" className="mt-3">
              <SentGifts />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Send Gift Modal */}
      <SendDirectGiftModal 
        isOpen={showSendGiftModal} 
        onClose={() => setShowSendGiftModal(false)} 
      />
    </div>
  );
};
