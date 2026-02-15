import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Gift, RefreshCw, Loader2, CheckSquare, X } from 'lucide-react';
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

  const { data: giftStats, refetch: refetchStats } = useQuery({
    queryKey: ['gift-stats', user?.id],
    queryFn: async () => {
      const { data: received, error: recError } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee, is_converted')
        .eq('receiver_id', user?.id);
      if (recError) throw recError;

      const { data: sent, error: sentError } = await supabase
        .from('gift_analytics')
        .select('credit_value')
        .eq('sender_id', user?.id);
      if (sentError) throw sentError;

      return {
        receivedCount: received?.length || 0,
        receivedTotal: received?.reduce((sum, g) => sum + (g.credit_value - (g.platform_fee || 0)), 0) || 0,
        sentCount: sent?.length || 0,
        sentTotal: sent?.reduce((sum, g) => sum + g.credit_value, 0) || 0,
      };
    },
    enabled: !!user,
  });

  const { data: unconvertedStats, refetch: refetchUnconverted } = useQuery({
    queryKey: ['unconverted-gifts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee')
        .eq('receiver_id', user?.id)
        .or('is_converted.eq.false,is_converted.is.null');
      if (error) throw error;
      return {
        count: data?.length || 0,
        totalValue: data?.reduce((sum, g) => sum + (g.credit_value - (g.platform_fee || 0)), 0) || 0,
      };
    },
    enabled: !!user,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
    queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
    queryClient.invalidateQueries({ queryKey: ['unconverted-gifts'] });
  };

  const handleConvertAll = async () => {
    setIsConvertingAll(true);
    try {
      const { data, error } = await supabase.rpc('convert_all_gifts');
      if (error) throw error;
      const result = data as { success: boolean; error?: string; gifts_converted?: number; credits_added?: number };
      if (!result.success) throw new Error(result.error || 'Failed to convert gifts');
      toast.success(`Converted ${result.gifts_converted} gifts · +${result.credits_added} credits`);
      invalidateAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to convert gifts');
    } finally {
      setIsConvertingAll(false);
    }
  };

  const handleConvertSelected = async () => {
    if (selectedGiftIds.size === 0) return;
    setIsConvertingSelected(true);
    try {
      let converted = 0, totalCredits = 0;
      for (const giftId of selectedGiftIds) {
        const { data, error } = await supabase.rpc('convert_gift', { p_gift_id: giftId });
        if (error) throw error;
        const result = data as { success: boolean; error?: string; credits_added?: number };
        if (result.success) { converted++; totalCredits += result.credits_added || 0; }
      }
      toast.success(`Converted ${converted} gifts · +${totalCredits} credits`);
      setSelectedGiftIds(new Set());
      setSelectionMode(false);
      invalidateAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to convert gifts');
    } finally {
      setIsConvertingSelected(false);
    }
  };

  const toggleGiftSelection = (id: string) => {
    setSelectedGiftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('gifts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gift_analytics' }, (payload) => {
        const gift = payload.new as any;
        if (gift?.sender_id === user.id || gift?.receiver_id === user.id) {
          refetchStats();
          refetchUnconverted();
          queryClient.invalidateQueries({ queryKey: ['received-gifts', user.id] });
          queryClient.invalidateQueries({ queryKey: ['sent-gifts', user.id] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetchStats, refetchUnconverted, queryClient]);

  const hasUnconvertedGifts = (unconvertedStats?.count || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Stats row — minimal, two numbers side by side */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-2xl font-bold text-foreground">{giftStats?.receivedCount || 0}</p>
          <p className="text-xs text-muted-foreground">Received · +{giftStats?.receivedTotal || 0}</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <p className="text-2xl font-bold text-foreground">{giftStats?.sentCount || 0}</p>
          <p className="text-xs text-muted-foreground">Sent · −{giftStats?.sentTotal || 0}</p>
        </div>
      </div>

      {/* Unconverted banner — minimal */}
      {hasUnconvertedGifts && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {unconvertedStats?.count} unredeemed
                <span className="text-muted-foreground font-normal"> · {unconvertedStats?.totalValue} credits</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleConvertAll}
                disabled={isConvertingAll || selectionMode}
                size="sm"
                variant="default"
                className="h-7 text-xs"
              >
                {isConvertingAll ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Redeem All
              </Button>
              <Button
                onClick={() => {
                  if (selectionMode) { setSelectionMode(false); setSelectedGiftIds(new Set()); }
                  else setSelectionMode(true);
                }}
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
              >
                {selectionMode ? <X className="w-3 h-3 mr-1" /> : <CheckSquare className="w-3 h-3 mr-1" />}
                {selectionMode ? 'Cancel' : 'Select'}
              </Button>
            </div>
          </div>
          {selectionMode && selectedGiftIds.size > 0 && (
            <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{selectedGiftIds.size} selected</span>
              <Button
                onClick={handleConvertSelected}
                disabled={isConvertingSelected}
                size="sm"
                variant="default"
                className="h-7 text-xs"
              >
                {isConvertingSelected ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Redeem Selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Send Gift */}
      <Button onClick={() => setShowSendGiftModal(true)} className="w-full" size="default">
        <Gift className="w-4 h-4 mr-2" />
        Send Gift
      </Button>

      {/* History — clean tabs, no card wrapper with header */}
      <Tabs defaultValue="received">
        <TabsList className="w-full h-9 bg-muted/50">
          <TabsTrigger value="received" className="flex-1 text-xs">
            Received ({giftStats?.receivedCount || 0})
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1 text-xs">
            Sent ({giftStats?.sentCount || 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="mt-2">
          <ReceivedGifts
            selectionMode={selectionMode}
            selectedIds={selectedGiftIds}
            onToggleSelect={toggleGiftSelection}
          />
        </TabsContent>
        <TabsContent value="sent" className="mt-2">
          <SentGifts />
        </TabsContent>
      </Tabs>

      <SendDirectGiftModal isOpen={showSendGiftModal} onClose={() => setShowSendGiftModal(false)} />
    </div>
  );
};
