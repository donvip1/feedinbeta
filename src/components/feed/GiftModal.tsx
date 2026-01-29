import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gift, Heart, Trophy, Crown, Sparkles, TrendingUp, Infinity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AnimatedGiftEmoji from '@/components/shared/AnimatedGiftEmoji';
import { useAdminRole } from '@/hooks/useAdminRole';
interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  recipientId: string;
  recipientName?: string;
}

interface GiftType {
  id: string;
  label: string;
  cost: number;
  category: 'basic' | 'premium' | 'exclusive';
  color: string;
  animation?: string;
}

// All unique gift types with 3D animated emojis
const allGifts: GiftType[] = [
  // Basic Gifts (10-50 credits) - 9 unique items
  { id: 'heart', label: 'Heart', cost: 10, category: 'basic', color: 'from-red-400 to-pink-500' },
  { id: 'star', label: 'Star', cost: 15, category: 'basic', color: 'from-yellow-400 to-amber-500' },
  { id: 'coffee', label: 'Coffee', cost: 20, category: 'basic', color: 'from-amber-600 to-orange-700' },
  { id: 'flower', label: 'Flower', cost: 25, category: 'basic', color: 'from-pink-400 to-rose-500' },
  { id: 'sun', label: 'Sunshine', cost: 30, category: 'basic', color: 'from-yellow-300 to-orange-400' },
  { id: 'music', label: 'Music', cost: 35, category: 'basic', color: 'from-purple-400 to-indigo-500' },
  { id: 'pizza', label: 'Pizza', cost: 40, category: 'basic', color: 'from-orange-400 to-red-500' },
  { id: 'icecream', label: 'Ice Cream', cost: 45, category: 'basic', color: 'from-pink-300 to-purple-400' },
  { id: 'moon', label: 'Moon', cost: 50, category: 'basic', color: 'from-indigo-400 to-purple-600' },
  
  // Premium Gifts (75-200 credits) - 6 unique items
  { id: 'lightning', label: 'Lightning', cost: 75, category: 'premium', color: 'from-yellow-400 to-amber-600', animation: 'gift-pulse' },
  { id: 'trophy', label: 'Trophy', cost: 100, category: 'premium', color: 'from-yellow-500 to-amber-600', animation: 'gift-pulse' },
  { id: 'fire', label: 'Fire', cost: 120, category: 'premium', color: 'from-orange-500 to-red-600', animation: 'gift-pulse' },
  { id: 'party', label: 'Party', cost: 150, category: 'premium', color: 'from-purple-500 to-pink-500', animation: 'gift-pulse' },
  { id: 'cake', label: 'Cake', cost: 175, category: 'premium', color: 'from-pink-400 to-rose-600', animation: 'gift-pulse' },
  { id: 'rainbow', label: 'Rainbow', cost: 200, category: 'premium', color: 'from-red-400 via-yellow-400 to-blue-500', animation: 'gift-pulse' },
  
  // Exclusive Gifts (300-1000 credits) - 4 unique items
  { id: 'rocket', label: 'Rocket', cost: 300, category: 'exclusive', color: 'from-blue-500 to-indigo-600', animation: 'promote-glow' },
  { id: 'crown', label: 'Crown', cost: 500, category: 'exclusive', color: 'from-yellow-400 to-amber-500', animation: 'promote-glow' },
  { id: 'diamond', label: 'Diamond', cost: 750, category: 'exclusive', color: 'from-cyan-400 to-blue-500', animation: 'promote-glow' },
  { id: 'universe', label: 'Universe', cost: 1000, category: 'exclusive', color: 'from-purple-500 via-pink-500 to-rose-500', animation: 'promote-glow' },
];

export default function GiftModal({ isOpen, onClose, postId, recipientId, recipientName }: GiftModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { permissions } = useAdminRole();
  const hasUnlimitedCredits = permissions.isDeveloper;
  const [sending, setSending] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [credits, setCredits] = useState(0);
  const [activeTab, setActiveTab] = useState('basic');
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; giftId: string; x: number }[]>([]);
  const [comboCount, setComboCount] = useState(0);
  const [lastGiftTime, setLastGiftTime] = useState(0);
  useEffect(() => {
    if (isOpen && user) {
      loadCredits();
    }
  }, [isOpen, user]);

  const loadCredits = async () => {
    const { data } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user?.id)
      .single();
    setCredits(data?.balance || 0);
  };

  const addFloatingEmoji = (giftId: string) => {
    const id = Date.now() + Math.random();
    const x = Math.random() * 70 + 15;
    setFloatingEmojis(prev => [...prev, { id, giftId, x }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  };

  const handleSendGift = async (gift: GiftType) => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to send gifts',
        variant: 'destructive',
      });
      return;
    }

    if (user.id === recipientId) {
      toast({
        title: 'Cannot send gift',
        description: 'You cannot send gifts to yourself',
        variant: 'destructive',
      });
      return;
    }

    if (!hasUnlimitedCredits && credits < gift.cost) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${gift.cost} credits. You have ${credits}.`,
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    setSelectedGift(gift);

    // Check for combo
    const now = Date.now();
    if (now - lastGiftTime < 3000) {
      setComboCount(prev => prev + 1);
    } else {
      setComboCount(1);
    }
    setLastGiftTime(now);

    try {
      const { data, error } = await supabase.rpc('send_gift', {
        p_post_id: postId,
        p_gift_type: gift.label,
        p_credit_value: gift.cost,
      });

      if (error) {
        if (error.message.includes('Insufficient credits')) {
          toast({
            title: 'Insufficient credits',
            description: 'Please purchase more credits to send gifts',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      // Add floating animated emojis
      for (let i = 0; i < (comboCount > 1 ? 5 : 3); i++) {
        setTimeout(() => addFloatingEmoji(gift.id), i * 100);
      }

      setCredits(prev => prev - gift.cost);

      toast({ 
        title: comboCount > 1 ? `${comboCount}x Combo! 🎉` : `Gift sent!`,
        description: `You sent a ${gift.label} to ${recipientName || 'the creator'}`,
      });

    } catch (error: any) {
      toast({
        title: 'Error sending gift',
        description: error.message || 'Failed to send gift',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
      setTimeout(() => setSelectedGift(null), 500);
    }
  };

  const getGiftsByCategory = (category: 'basic' | 'premium' | 'exclusive') => 
    allGifts.filter(g => g.category === category);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-primary/20">
        {/* Floating Animated Emojis */}
        {floatingEmojis.map(({ id, giftId, x }) => (
          <div
            key={id}
            className="floating-gift fixed pointer-events-none z-50"
            style={{ left: `${x}%`, bottom: '50%' }}
          >
            <AnimatedGiftEmoji giftType={giftId} size={64} />
          </div>
        ))}

        {/* Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
          </div>
          
          <div className="relative flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-3 ${sending ? 'gift-pulse' : ''}`}>
              <Gift className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Send a Gift
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Show appreciation to {recipientName || 'the creator'}
            </p>
            
            {/* Credits Display */}
            <div className="mt-3 flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full">
              {hasUnlimitedCredits ? (
                <>
                  <Infinity className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">Unlimited</span>
                  <span className="text-xs text-muted-foreground">developer access</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-bold">{credits}</span>
                  <span className="text-xs text-muted-foreground">credits available</span>
                </>
              )}
            </div>

            {/* Combo Indicator */}
            {comboCount > 1 && (
              <Badge className="mt-2 bg-gradient-to-r from-orange-500 to-red-500 text-white animate-bounce">
                🔥 {comboCount}x COMBO!
              </Badge>
            )}
          </div>
        </div>

        {/* Gift Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4 pt-0">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="basic" className="text-xs">
              <Heart className="w-3 h-3 mr-1" /> Basic
            </TabsTrigger>
            <TabsTrigger value="premium" className="text-xs">
              <Trophy className="w-3 h-3 mr-1" /> Premium
            </TabsTrigger>
            <TabsTrigger value="exclusive" className="text-xs">
              <Crown className="w-3 h-3 mr-1" /> Exclusive
            </TabsTrigger>
          </TabsList>

          {['basic', 'premium', 'exclusive'].map((category) => (
            <TabsContent key={category} value={category} className="mt-0">
              <ScrollArea className="h-[280px] pr-4">
                <div className="grid grid-cols-3 gap-3">
                  {getGiftsByCategory(category as 'basic' | 'premium' | 'exclusive').map((gift) => (
                    <Button
                      key={gift.id}
                      variant="outline"
                      className={`gift-card flex flex-col items-center gap-2 h-auto py-4 rounded-xl border-2 transition-all relative overflow-hidden
                        ${selectedGift?.id === gift.id ? 'border-primary scale-105' : 'border-border hover:border-primary/50'}
                        ${!hasUnlimitedCredits && credits < gift.cost ? 'opacity-50' : ''}
                      `}
                      onClick={() => handleSendGift(gift)}
                      disabled={sending || (!hasUnlimitedCredits && credits < gift.cost)}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${gift.color} opacity-10`} />
                      
                      {/* 3D Animated Emoji */}
                      <div className={`relative ${gift.animation || ''}`}>
                        <AnimatedGiftEmoji giftType={gift.id} size={48} />
                      </div>
                      
                      <div className="relative">
                        <div className="text-xs font-medium">{gift.label}</div>
                        <div className="text-xs text-muted-foreground">{gift.cost} 💎</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        {/* Footer Info */}
        <div className="p-4 pt-0 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span>Creators receive 80% of gift value. Send gifts within 3 seconds for combo bonuses!</span>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => window.location.href = '/wallet'}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Get More Credits
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
