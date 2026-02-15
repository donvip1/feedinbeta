import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Gift, Send, ArrowDownLeft, Sparkles, RefreshCw, Loader2, CheckSquare, X } from 'lucide-react';
import { ReceivedGifts } from './ReceivedGifts';
import { SentGifts } from './SentGifts';
import { SendDirectGiftModal } from './SendDirectGiftModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const GiftsTab = () => {
  const { user } = useAuth();
  const [showSendGiftModal, setShowSendGiftModal] = useState(false);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [isConvertingSelected, setIsConvertingSelected] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedGiftIds, setSelectedGiftIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch gift statistics
  const { data: giftStats, refetch: refetchStats } = useQuery({
    queryKey: ['gift-stats', user?.id],
    queryFn: async () => {
      // Get received gifts count and total
      const { data: received, error: recError } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee, is_converted')
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

  // Fetch unconverted gifts statistics
  const { data: unconvertedStats, refetch: refetchUnconverted } = useQuery({
    queryKey: ['unconverted-gifts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee')
        .eq('receiver_id', user?.id)
        .or('is_converted.eq.false,is_converted.is.null');

      if (error) throw error;

      const count = data?.length || 0;
      const totalValue = data?.reduce((sum, g) => sum + (g.credit_value - (g.platform_fee || 0)), 0) || 0;

      return { count, totalValue };
    },
    enabled: !!user,
  });

  // Handle convert all gifts
  const handleConvertAll = async () => {
    setIsConvertingAll(true);
    
    try {
      const { data, error } = await supabase.rpc('convert_all_gifts');
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; gifts_converted?: number; credits_added?: number };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to convert gifts');
      }
      
      toast.success(`Converted ${result.gifts_converted} gifts! +${result.credits_added} credits added`);
      
      // Refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unconverted-gifts'] });
    } catch (error: any) {
      console.error('Error converting all gifts:', error);
      toast.error(error.message || 'Failed to convert gifts');
    } finally {
      setIsConvertingAll(false);
    }
  };

  // Handle convert selected gifts
  const handleConvertSelected = async () => {
    if (selectedGiftIds.size === 0) return;
    setIsConvertingSelected(true);
    
    try {
      let converted = 0;
      let totalCredits = 0;
      
      for (const giftId of selectedGiftIds) {
        const { data, error } = await supabase.rpc('convert_gift', { p_gift_id: giftId });
        if (error) throw error;
        const result = data as { success: boolean; error?: string; credits_added?: number };
        if (result.success) {
          converted++;
          totalCredits += result.credits_added || 0;
        }
      }
      
      toast.success(`Converted ${converted} gifts! +${totalCredits} credits added`);
      setSelectedGiftIds(new Set());
      setSelectionMode(false);
      
      queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unconverted-gifts'] });
    } catch (error: any) {
      console.error('Error converting selected gifts:', error);
      toast.error(error.message || 'Failed to convert gifts');
    } finally {
      setIsConvertingSelected(false);
    }
  };

  const toggleGiftSelection = (id: string) => {
    setSelectedGiftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Real-time subscription for gift updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('gifts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gift_analytics',
        },
        (payload) => {
          const gift = payload.new as any;
          // If the user is the sender or receiver, refetch
          if (gift?.sender_id === user.id || gift?.receiver_id === user.id) {
            refetchStats();
            refetchUnconverted();
            queryClient.invalidateQueries({ queryKey: ['received-gifts', user.id] });
            queryClient.invalidateQueries({ queryKey: ['sent-gifts', user.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchStats, refetchUnconverted, queryClient]);

  const hasUnconvertedGifts = (unconvertedStats?.count || 0) > 0;

  return (
    <div className="space-y-5">
      {/* Unconverted Gifts Card */}
      {hasUnconvertedGifts && (
        <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-sm">Unconverted Gifts</span>
              </div>
              <p className="text-2xl font-bold text-yellow-500">
                {unconvertedStats?.count || 0}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  worth {unconvertedStats?.totalValue || 0} credits
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                onClick={handleConvertAll}
                disabled={isConvertingAll || selectionMode}
                size="sm"
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
              >
                {isConvertingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Convert All
              </Button>
              {!selectionMode ? (
                <Button
                  onClick={() => setSelectionMode(true)}
                  size="sm"
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                  Select
                </Button>
              ) : (
                <Button
                  onClick={() => { setSelectionMode(false); setSelectedGiftIds(new Set()); }}
                  size="sm"
                  variant="outline"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
          {/* Convert Selected bar */}
          {selectionMode && selectedGiftIds.size > 0 && (
            <div className="mt-3 pt-3 border-t border-yellow-500/20 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedGiftIds.size} gift{selectedGiftIds.size > 1 ? 's' : ''} selected
              </span>
              <Button
                onClick={handleConvertSelected}
                disabled={isConvertingSelected}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                {isConvertingSelected ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Convert Selected
              </Button>
            </div>
          )}
        </div>
      )}

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
              <ReceivedGifts 
                selectionMode={selectionMode} 
                selectedIds={selectedGiftIds} 
                onToggleSelect={toggleGiftSelection} 
              />
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
