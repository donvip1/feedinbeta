import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      {/* Gift Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              Received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {giftStats?.receivedCount || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">gifts</span>
            </div>
            <p className="text-sm text-muted-foreground">
              +{giftStats?.receivedTotal || 0} credits
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Send className="w-3 h-3" />
              Sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {giftStats?.sentCount || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">gifts</span>
            </div>
            <p className="text-sm text-muted-foreground">
              -{giftStats?.sentTotal || 0} credits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Send Gift Button */}
      <Button 
        onClick={() => setShowSendGiftModal(true)} 
        className="w-full"
        size="lg"
      >
        <Gift className="w-4 h-4 mr-2" />
        Send Gift to Someone
      </Button>

      {/* Gifts Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gift History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="received">
            <TabsList className="w-full">
              <TabsTrigger value="received" className="flex-1">
                Received ({giftStats?.receivedCount || 0})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex-1">
                Sent ({giftStats?.sentCount || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="received" className="mt-4">
              <ReceivedGifts />
            </TabsContent>
            <TabsContent value="sent" className="mt-4">
              <SentGifts />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Send Gift Modal */}
      <SendDirectGiftModal 
        isOpen={showSendGiftModal} 
        onClose={() => setShowSendGiftModal(false)} 
      />
    </div>
  );
};
