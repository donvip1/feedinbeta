import { useState } from "react";
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
import { Gift, Coins, Send, Heart, Star, Trophy, Zap, Crown, Diamond, Sparkles } from "lucide-react";

interface LiveGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  hostId: string;
  viewers: Array<{ id: string; display_name: string; username: string; avatar_url: string }>;
  isHost: boolean;
}

const GIFTS = [
  { type: "heart", icon: Heart, label: "Heart", value: 10, color: "text-red-500" },
  { type: "star", icon: Star, label: "Star", value: 25, color: "text-yellow-500" },
  { type: "trophy", icon: Trophy, label: "Trophy", value: 50, color: "text-amber-500" },
  { type: "zap", icon: Zap, label: "Lightning", value: 100, color: "text-blue-500" },
  { type: "crown", icon: Crown, label: "Crown", value: 250, color: "text-purple-500" },
  { type: "diamond", icon: Diamond, label: "Diamond", value: 500, color: "text-cyan-500" },
  { type: "sparkles", icon: Sparkles, label: "Universe", value: 1000, color: "text-pink-500" },
];

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

  const handleSendGift = async (giftType: string, creditValue: number) => {
    if (!user) return;
    
    const recipientId = isHost ? selectedRecipient : hostId;
    if (!recipientId) {
      toast.error("Please select a recipient");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.rpc('send_live_gift', {
        p_stream_id: streamId,
        p_receiver_id: recipientId,
        p_gift_type: giftType,
        p_credit_value: creditValue,
      });

      if (error) {
        if (error.message.includes('Insufficient credits')) {
          toast.error("Insufficient credits");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`${giftType} sent!`);
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send gift");
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {isHost ? "Send Gift to Viewer" : "Send Gift to Host"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="gifts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gifts">Gifts</TabsTrigger>
            <TabsTrigger value="credits">Send Credits</TabsTrigger>
          </TabsList>

          <TabsContent value="gifts" className="space-y-4">
            {isHost && (
              <div>
                <Label>Select Viewer</Label>
                <ScrollArea className="h-32 border rounded-lg p-2 mt-1">
                  {viewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active viewers
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {viewers.map((viewer) => (
                        <button
                          key={viewer.id}
                          onClick={() => setSelectedRecipient(viewer.id)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                            selectedRecipient === viewer.id
                              ? "bg-primary/20 border border-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={viewer.avatar_url} />
                            <AvatarFallback>{viewer.display_name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <p className="text-sm font-medium">{viewer.display_name}</p>
                            <p className="text-xs text-muted-foreground">@{viewer.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {GIFTS.map((gift) => (
                <Button
                  key={gift.type}
                  variant="outline"
                  className="flex flex-col items-center gap-1 h-auto py-3 hover:border-primary"
                  onClick={() => handleSendGift(gift.type, gift.value)}
                  disabled={sending || (isHost && !selectedRecipient)}
                >
                  <gift.icon className={`w-6 h-6 ${gift.color}`} />
                  <span className="text-xs font-medium">{gift.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {gift.value}
                  </Badge>
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="credits" className="space-y-4">
            {isHost && (
              <div>
                <Label>Select Viewer</Label>
                <ScrollArea className="h-32 border rounded-lg p-2 mt-1">
                  {viewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active viewers
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {viewers.map((viewer) => (
                        <button
                          key={viewer.id}
                          onClick={() => setSelectedRecipient(viewer.id)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                            selectedRecipient === viewer.id
                              ? "bg-primary/20 border border-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={viewer.avatar_url} />
                            <AvatarFallback>{viewer.display_name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <p className="text-sm font-medium">{viewer.display_name}</p>
                            <p className="text-xs text-muted-foreground">@{viewer.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            <div>
              <Label>Amount</Label>
              <div className="flex gap-2 mt-1">
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
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {[50, 100, 250, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomAmount(amount.toString())}
                >
                  {amount}
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
