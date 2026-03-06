import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gift, Loader2, Send, X, Users, Search, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Viewer {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
}

interface HostGiftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  isSpace?: boolean;
  participants: Viewer[];
  onGiftSent?: (gift: { type: string; value: number; emoji: string; recipientName: string }) => void;
}

const GIFTS = [
  { type: 'rose', name: 'Rose', value: 10, emoji: '🌹', color: 'from-red-500/20 to-red-900/20 border-red-500/50' },
  { type: 'coffee', name: 'Coffee', value: 20, emoji: '☕', color: 'from-amber-700/20 to-amber-900/20 border-amber-700/50' },
  { type: 'heart', name: 'Love', value: 50, emoji: '❤️', color: 'from-pink-500/20 to-pink-900/20 border-pink-500/50' },
  { type: 'diamond', name: 'Diamond', value: 100, emoji: '💎', color: 'from-cyan-400/20 to-cyan-900/20 border-cyan-400/50' },
  { type: 'rocket', name: 'Rocket', value: 500, emoji: '🚀', color: 'from-purple-600/20 to-purple-900/20 border-purple-600/50' },
  { type: 'castle', name: 'Castle', value: 1000, emoji: '🏰', color: 'from-yellow-500/20 to-yellow-900/20 border-yellow-500/50' },
];

const CREDIT_AMOUNTS = [50, 100, 250, 500, 1000];

export const HostGiftPanel = ({
  isOpen,
  onClose,
  roomId,
  isSpace = false,
  participants,
  onGiftSent,
}: HostGiftPanelProps) => {
  const { user } = useAuth();
  const { permissions } = useAdminRole();
  const hasUnlimitedCredits = permissions.isDeveloper;
  
  const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [localCredits, setLocalCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real credits from user_credits table
  useEffect(() => {
    if (isOpen && user) {
      fetchCredits();
    }
  }, [isOpen, user]);

  const fetchCredits = async () => {
    if (!user) return;
    setIsLoadingCredits(true);
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setLocalCredits(data.balance || 0);
      }
    } catch (e) {
      console.error('Failed to fetch credits:', e);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const handleSendGift = async (giftType: string, creditValue: number, emoji: string) => {
    if (!user || !selectedViewer) {
      toast.error('Please select a viewer first');
      return;
    }

    if (!hasUnlimitedCredits && localCredits < creditValue) {
      toast.error('Insufficient credits');
      return;
    }

    setSending(giftType);

    try {
      // Use secure atomic RPC for proper credit handling
      let result;
      if (isSpace) {
        result = await supabase.rpc('send_space_gift', {
          p_space_id: roomId,
          p_gift_type: giftType,
          p_credit_value: creditValue,
          p_receiver_id: selectedViewer.id,
        });
      } else {
        result = await supabase.rpc('send_live_gift', {
          p_credit_value: creditValue,
          p_gift_type: giftType,
          p_stream_id: roomId,
        });
      }

      if (result.error) throw result.error;

      const rpcResult = result.data as any;
      if (rpcResult && rpcResult.success === false) {
        throw new Error(rpcResult.error || 'Gift failed');
      }

      // Create notification
      await supabase.from('notifications').insert({
        user_id: selectedViewer.id,
        from_user_id: user.id,
        type: 'live_gift',
        title: 'The host sent you a gift!',
        message: `The host sent you a ${giftType} gift (${creditValue} credits)`,
        related_id: roomId,
        related_type: isSpace ? 'space' : 'live_stream'
      });

      toast.success(`${emoji} Sent to ${selectedViewer.display_name}!`);
      
      // Refresh actual balance from DB
      await fetchCredits();

      // Broadcast gift for instant display to all participants
      await supabase.channel(`space-gift-broadcast-${roomId}`).send({
        type: 'broadcast',
        event: 'gift_sent',
        payload: {
          gift_type: giftType,
          credit_value: creditValue,
          emoji,
          sender_id: user.id,
          sender_name: user.user_metadata?.display_name || 'Host',
          receiver_id: selectedViewer.id,
          receiver_name: selectedViewer.display_name,
        },
      });

      onGiftSent?.({ type: giftType, value: creditValue, emoji, recipientName: selectedViewer.display_name });
    } catch (error: any) {
      console.error('Gift error:', error);
      toast.error(error.message || 'Failed to send gift');
    } finally {
      setSending(null);
    }
  };

  const handleSendCredits = async () => {
    const amount = parseInt(customAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    await handleSendGift('credits', amount, '💰');
    setCustomAmount('');
  };

  // Filter participants (exclude self)
  const filteredViewers = participants
    .filter(p => p.id !== user?.id)
    .filter(p => 
      searchQuery === '' ||
      p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* Panel - Centered */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Gift Viewers</h3>
                  <p className="text-xs text-muted-foreground">
                    Balance: {isLoadingCredits ? (
                      <Loader2 className="w-3 h-3 inline animate-spin" />
                    ) : hasUnlimitedCredits ? (
                      <span className="text-primary font-semibold">∞ Unlimited</span>
                    ) : (
                      <span className="text-primary font-semibold">{localCredits.toLocaleString()}</span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 overflow-y-auto">
              <Tabs defaultValue="gifts" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mx-4 mt-4" style={{ width: 'calc(100% - 2rem)' }}>
                  <TabsTrigger value="gifts">
                    <Gift className="w-4 h-4 mr-2" />
                    Gifts
                  </TabsTrigger>
                  <TabsTrigger value="credits">
                    <Coins className="w-4 h-4 mr-2" />
                    Credits
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="gifts" className="p-4 space-y-4">
                  {/* Viewer Selection */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                      Select Viewer
                    </label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search viewers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="h-24 border rounded-xl p-2 bg-muted/30 overflow-y-auto">
                      {filteredViewers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {participants.filter(p => p.id !== user?.id).length === 0 
                            ? 'No viewers yet' 
                            : 'No matching viewers'}
                        </p>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {filteredViewers.map((viewer) => (
                            <button
                              key={viewer.id}
                              onClick={() => setSelectedViewer(viewer)}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-xl transition-all",
                                selectedViewer?.id === viewer.id
                                  ? "bg-primary/20 ring-2 ring-primary"
                                  : "hover:bg-muted"
                              )}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={viewer.avatar_url} />
                                <AvatarFallback>{viewer.display_name?.[0] || "U"}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{viewer.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gift Grid - Scrollable */}
                  <div className="grid grid-cols-3 gap-2">
                    {GIFTS.map((gift) => {
                      const canAfford = hasUnlimitedCredits || localCredits >= gift.value;
                      const isSending = sending === gift.type;

                      return (
                        <motion.button
                          key={gift.type}
                          whileHover={{ scale: canAfford && selectedViewer ? 1.05 : 1 }}
                          whileTap={{ scale: canAfford && selectedViewer ? 0.95 : 1 }}
                          onClick={() => canAfford && selectedViewer && handleSendGift(gift.type, gift.value, gift.emoji)}
                          disabled={!canAfford || !selectedViewer || !!sending}
                          className={cn(
                            "relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-300",
                            canAfford && selectedViewer
                              ? `bg-gradient-to-br ${gift.color} hover:shadow-lg cursor-pointer`
                              : "bg-muted/50 border-border opacity-50 cursor-not-allowed",
                            isSending && "animate-pulse scale-110"
                          )}
                        >
                          <motion.span 
                            className="text-2xl mb-0.5"
                            animate={isSending ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
                            transition={{ duration: 0.5 }}
                          >
                            {gift.emoji}
                          </motion.span>
                          <span className="text-[10px] font-medium">{gift.name}</span>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Coins className="w-2.5 h-2.5 text-amber-400" />
                            <span className="text-[9px] text-amber-500 font-semibold">{gift.value}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="credits" className="p-4 space-y-4">
                  {/* Viewer Selection (same) */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                      Select Viewer
                    </label>
                    <div className="h-24 border rounded-xl p-2 bg-muted/30 overflow-y-auto">
                      {filteredViewers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No viewers yet
                        </p>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {filteredViewers.map((viewer) => (
                            <button
                              key={viewer.id}
                              onClick={() => setSelectedViewer(viewer)}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-xl transition-all",
                                selectedViewer?.id === viewer.id
                                  ? "bg-primary/20 ring-2 ring-primary"
                                  : "hover:bg-muted"
                              )}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={viewer.avatar_url} />
                                <AvatarFallback>{viewer.display_name?.[0] || "U"}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{viewer.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                      Amount
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="Enter credits"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="pl-10"
                          min="1"
                        />
                      </div>
                      <Button
                        onClick={handleSendCredits}
                        disabled={sending !== null || !customAmount || !selectedViewer}
                        className="bg-gradient-to-r from-primary to-purple-600"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                    </div>
                  </div>

                  {/* Quick Amounts */}
                  <div className="flex gap-2 flex-wrap">
                    {CREDIT_AMOUNTS.map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomAmount(amount.toString())}
                        className={cn(
                          "flex-1 min-w-[60px]",
                          customAmount === amount.toString() && "border-primary bg-primary/10"
                        )}
                        disabled={!hasUnlimitedCredits && localCredits < amount}
                      >
                        {amount}
                      </Button>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    15% platform fee applies. Viewer receives 85% of the amount.
                  </p>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HostGiftPanel;
