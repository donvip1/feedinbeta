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
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "sonner";
import { Gift, Coins, Send, Sparkles, Crown, Zap, Heart, Star, Gem, Flame, Rocket, Infinity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiveGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  hostId: string;
  viewers: Array<{ id: string; display_name: string; username: string; avatar_url: string }>;
  isHost: boolean;
  isSpace?: boolean; // If true, inserts into live_space_gifts instead of live_stream_gifts
  spaceName?: string; // Name of the space/stream for descriptions
}

// Premium animated gift types with colors matching reference design
const GIFTS = [
  { type: "rose", label: "Rose", value: 10, emoji: "🌹", color: "from-red-500/20 to-red-900/20 border-red-500/50", icon: Heart },
  { type: "coffee", label: "Coffee", value: 20, emoji: "☕", color: "from-amber-700/20 to-amber-900/20 border-amber-700/50", icon: Star },
  { type: "heart", label: "Love", value: 50, emoji: "❤️", color: "from-pink-500/20 to-pink-900/20 border-pink-500/50", icon: Heart },
  { type: "diamond", label: "Diamond", value: 100, emoji: "💎", color: "from-cyan-400/20 to-cyan-900/20 border-cyan-400/50", icon: Gem },
  { type: "rocket", label: "Rocket", value: 500, emoji: "🚀", color: "from-purple-600/20 to-purple-900/20 border-purple-600/50", icon: Rocket },
  { type: "castle", label: "Castle", value: 1000, emoji: "🏰", color: "from-yellow-500/20 to-yellow-900/20 border-yellow-500/50", icon: Crown },
  { type: "crown", label: "Crown", value: 250, emoji: "👑", color: "from-amber-400/20 to-yellow-500/20 border-amber-500/50", icon: Crown },
  { type: "universe", label: "Universe", value: 2500, emoji: "🌌", color: "from-indigo-500/20 to-purple-600/20 border-indigo-500/50", icon: Sparkles },
];

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

export const LiveGiftModal = ({
  isOpen,
  onClose,
  streamId,
  hostId,
  viewers,
  isHost,
  isSpace = false,
  spaceName = '',
}: LiveGiftModalProps) => {
  const { user } = useAuth();
  const { permissions } = useAdminRole();
  const hasUnlimitedCredits = permissions.isDeveloper;
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
    const { data } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    setUserCredits(data?.balance || 0);
  };

  const handleSendGift = async (giftType: string, creditValue: number) => {
    if (!user) {
      toast.error("Please log in to send gifts");
      return;
    }
    
    // Determine recipient based on user role
    let recipientId: string | null = null;
    if (isHost) {
      // Hosts can only gift listeners/speakers in the list
      recipientId = selectedRecipient;
      if (!recipientId) {
        toast.error("Please select a listener or speaker to gift");
        return;
      }
      // Prevent hosts from gifting themselves
      if (recipientId === user.id) {
        toast.error("You cannot gift yourself");
        return;
      }
    } else {
      // Listeners/guests can gift the host or speakers
      recipientId = hostId;
    }

    if (!recipientId) {
      toast.error("Please select a recipient");
      return;
    }

    if (!hasUnlimitedCredits && userCredits < creditValue) {
      toast.error("Insufficient credits");
      return;
    }

    setSending(true);
    setSentGift(giftType);

    try {
      // Use secure atomic RPC for proper credit handling
      let result;
      if (isSpace) {
        result = await supabase.rpc('send_space_gift', {
          p_space_id: streamId,
          p_gift_type: giftType,
          p_credit_value: creditValue,
          p_receiver_id: recipientId,
        });
      } else {
        result = await supabase.rpc('send_live_gift', {
          p_credit_value: creditValue,
          p_gift_type: giftType,
          p_stream_id: streamId,
        });
      }

      if (result.error) throw result.error;

      const rpcResult = result.data as any;
      if (rpcResult && rpcResult.success === false) {
        throw new Error(rpcResult.error || 'Gift failed');
      }

      // Create notification for the recipient
      const giftEmoji = GIFTS.find(g => g.type === giftType)?.emoji || '🎁';
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single();
      const senderName = senderProfile?.display_name || senderProfile?.username || 'Someone';
      const sourceLabel = spaceName ? `"${spaceName}"` : (isSpace ? 'a space' : 'a stream');
      const recipientAmount = Math.floor(creditValue * 0.85);

      await supabase.from('notifications').insert({
        user_id: recipientId,
        from_user_id: user.id,
        type: 'live_gift',
        title: `${giftEmoji} Gift from ${senderName}!`,
        message: `${senderName} sent you a ${giftType} (${recipientAmount} credits) in ${sourceLabel}`,
        related_id: streamId,
        related_type: isSpace ? 'space' : 'live_stream'
      });

      toast.success(`${giftType} sent!`);
      await fetchUserCredits();

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
                Your balance: {hasUnlimitedCredits ? (
                  <span className="text-primary font-semibold flex items-center gap-1 inline-flex">
                    <Infinity className="w-3 h-3" /> Unlimited
                  </span>
                ) : (
                  <span className="text-primary font-semibold">{userCredits} credits</span>
                )}
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
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Listener or Speaker</Label>
                <ScrollArea className="h-24 border rounded-xl p-2 mt-2 bg-muted/30">
                  {viewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active listeners or speakers
                    </p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {viewers.filter(v => v.id !== user?.id).map((viewer) => (
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

            {/* Gift Grid - Enhanced with hover animations */}
            <div className="grid grid-cols-4 gap-2">
              {GIFTS.map((gift) => {
                const canAfford = userCredits >= gift.value;
                const effectiveCanAfford = hasUnlimitedCredits || canAfford;
                
                return (
                  <motion.button
                    key={gift.type}
                    whileHover={{ scale: effectiveCanAfford ? 1.08 : 1, y: effectiveCanAfford ? -2 : 0 }}
                    whileTap={{ scale: effectiveCanAfford ? 0.95 : 1 }}
                    className={cn(
                      "relative flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all duration-300",
                      effectiveCanAfford 
                        ? `bg-gradient-to-br ${gift.color} hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] cursor-pointer` 
                        : "bg-slate-900/50 border-white/5 opacity-50 cursor-not-allowed",
                      sending && "pointer-events-none"
                    )}
                    onClick={() => effectiveCanAfford && handleSendGift(gift.type, gift.value)}
                    disabled={!effectiveCanAfford || sending || (isHost && !selectedRecipient)}
                  >
                    <motion.span 
                      className="text-2xl relative z-10"
                      animate={effectiveCanAfford ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    >
                      {gift.emoji}
                    </motion.span>
                    <span className="text-[10px] font-medium relative z-10 text-white/80">{gift.label}</span>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-[10px] h-5 relative z-10 mt-0.5",
                        effectiveCanAfford ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
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
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Listener or Speaker</Label>
                <ScrollArea className="h-24 border rounded-xl p-2 mt-2 bg-muted/30">
                  {viewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active listeners or speakers
                    </p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {viewers.filter(v => v.id !== user?.id).map((viewer) => (
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
                  disabled={!hasUnlimitedCredits && userCredits < amount}
                >
                  {amount}
                </Button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              15% platform fee applies. Recipient receives 85% of the amount.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
