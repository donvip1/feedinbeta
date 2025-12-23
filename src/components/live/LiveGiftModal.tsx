import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Gift, Coins, Send, Sparkles, Crown, Zap, Heart, Star, Gem, Flame, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiveGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  hostId: string;
  viewers: Array<{ id: string; display_name: string; username: string; avatar_url: string }>;
  isHost: boolean;
}

// Premium 3D animated gift types
const GIFTS = [
  { type: "heart", label: "Heart", value: 10, emoji: "❤️", color: "from-red-400 to-pink-500", icon: Heart },
  { type: "star", label: "Star", value: 25, emoji: "⭐", color: "from-yellow-400 to-amber-500", icon: Star },
  { type: "fire", label: "Fire", value: 50, emoji: "🔥", color: "from-orange-400 to-red-500", icon: Flame },
  { type: "lightning", label: "Lightning", value: 100, emoji: "⚡", color: "from-blue-400 to-indigo-500", icon: Zap },
  { type: "crown", label: "Crown", value: 250, emoji: "👑", color: "from-amber-400 to-yellow-500", icon: Crown },
  { type: "diamond", label: "Diamond", value: 500, emoji: "💎", color: "from-cyan-400 to-blue-500", icon: Gem },
  { type: "rocket", label: "Rocket", value: 1000, emoji: "🚀", color: "from-purple-400 to-pink-500", icon: Rocket },
  { type: "universe", label: "Universe", value: 2500, emoji: "🌌", color: "from-indigo-500 to-purple-600", icon: Sparkles },
];

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

export const LiveGiftModal = ({
  isOpen,
  onClose,
  streamId,
  hostId,
  viewers,
  isHost,
}: LiveGiftModalProps) => {
  const { user } = useAuth();
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sentGift, setSentGift] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserCredits();
    }
  }, [isOpen, user]);

  const fetchUserCredits = async () => {
    if (!user) return;
    // Calculate balance from credit_transactions
    const { data } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', user.id);
    const balance = data?.reduce((sum, t) => sum + t.amount, 0) || 0;
    setUserCredits(balance);
  };

  const handleSendGift = async (giftType: string, creditValue: number) => {
    if (!user) {
      toast.error("Please log in to send gifts");
      return;
    }
    
    const recipientId = isHost ? selectedRecipient : hostId;
    if (!recipientId) {
      toast.error("Please select a recipient");
      return;
    }

    if (userCredits < creditValue) {
      toast.error("Insufficient credits");
      return;
    }

    setSending(true);
    setSentGift(giftType);

    try {
      // Deduct credits from sender via transaction
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -creditValue,
        type: 'gift_sent',
        description: `Sent ${giftType} gift in live stream`,
        related_id: streamId,
      });

      // Add credits to recipient (90% - 10% platform fee)
      const recipientAmount = Math.floor(creditValue * 0.9);
      await supabase.from('credit_transactions').insert({
        user_id: recipientId,
        amount: recipientAmount,
        type: 'gift_received',
        description: `Received ${giftType} gift in live stream`,
        related_id: streamId,
      });

      // Record the gift
      await supabase.from('live_stream_gifts').insert({
        stream_id: streamId,
        sender_id: user.id,
        receiver_id: recipientId,
        gift_type: giftType,
        credit_value: creditValue,
      });

      // Record gift analytics
      await supabase.from('gift_analytics').insert({
        gift_type: giftType,
        credit_value: creditValue,
        sender_id: user.id,
        receiver_id: recipientId,
        source_type: 'live_stream',
        source_id: streamId,
        platform_fee: creditValue - recipientAmount,
      });

      toast.success(`${giftType} sent!`);
      setUserCredits(prev => prev - creditValue);

      setTimeout(() => {
        setSentGift(null);
        onClose();
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to send gift");
      setSentGift(null);
    } finally {
      setSending(false);
    }
  };

  const handleSendCredits = async () => {
    const amount = parseInt(customAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    await handleSendGift("credits", amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden bg-gradient-to-b from-background to-background/95 border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold">Send Gift</span>
              <p className="text-xs text-muted-foreground font-normal">
                Your balance: <span className="text-primary font-semibold">{userCredits} credits</span>
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Success Animation */}
        <AnimatePresence>
          {sentGift && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-background/90 z-50 rounded-lg"
            >
              <div className="text-center">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ duration: 0.5 }}
                  className="text-6xl mb-4"
                >
                  {GIFTS.find(g => g.type === sentGift)?.emoji || '🎁'}
                </motion.div>
                <p className="text-lg font-bold text-primary">Gift Sent!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs defaultValue="gifts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50">
            <TabsTrigger value="gifts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              Gifts
            </TabsTrigger>
            <TabsTrigger value="credits" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Coins className="w-4 h-4 mr-2" />
              Send Credits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gifts" className="space-y-4 mt-4">
            {/* Recipient Selection for Hosts */}
            {isHost && (
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Viewer</Label>
                <ScrollArea className="h-24 border rounded-xl p-2 mt-2 bg-muted/30">
                  {viewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active viewers
                    </p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {viewers.map((viewer) => (
                        <button
                          key={viewer.id}
                          onClick={() => setSelectedRecipient(viewer.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl transition-all",
                            selectedRecipient === viewer.id
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
                </ScrollArea>
              </div>
            )}

            {/* Gift Grid */}
            <div className="grid grid-cols-4 gap-2">
              {GIFTS.map((gift) => {
                const Icon = gift.icon;
                const canAfford = userCredits >= gift.value;
                
                return (
                  <motion.button
                    key={gift.type}
                    whileHover={{ scale: canAfford ? 1.05 : 1 }}
                    whileTap={{ scale: canAfford ? 0.95 : 1 }}
                    className={cn(
                      "relative flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all",
                      canAfford 
                        ? "hover:border-primary cursor-pointer" 
                        : "opacity-50 cursor-not-allowed",
                      sending && "pointer-events-none"
                    )}
                    onClick={() => canAfford && handleSendGift(gift.type, gift.value)}
                    disabled={!canAfford || sending || (isHost && !selectedRecipient)}
                  >
                    <div className={cn(
                      "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-10",
                      gift.color
                    )} />
                    
                    <span className="text-2xl relative z-10">{gift.emoji}</span>
                    <span className="text-[10px] font-medium relative z-10">{gift.label}</span>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-[10px] h-5 relative z-10",
                        canAfford ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {gift.value}
                    </Badge>
                  </motion.button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="credits" className="space-y-4 mt-4">
            {/* Recipient Selection for Hosts */}
            {isHost && (
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Viewer</Label>
                <ScrollArea className="h-24 border rounded-xl p-2 mt-2 bg-muted/30">
                  {viewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active viewers
                    </p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {viewers.map((viewer) => (
                        <button
                          key={viewer.id}
                          onClick={() => setSelectedRecipient(viewer.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl transition-all",
                            selectedRecipient === viewer.id
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
                </ScrollArea>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Amount</Label>
              <div className="flex gap-2 mt-2">
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
                  disabled={sending || !customAmount || (isHost && !selectedRecipient)}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>

            {/* Quick Amounts */}
            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomAmount(amount.toString())}
                  className={cn(
                    "flex-1 min-w-[60px]",
                    customAmount === amount.toString() && "border-primary bg-primary/10"
                  )}
                  disabled={userCredits < amount}
                >
                  {amount}
                </Button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              10% platform fee applies. Recipient receives 90% of the amount.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
