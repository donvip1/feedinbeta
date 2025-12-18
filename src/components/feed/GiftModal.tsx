import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Gift, Heart, Star, Trophy, Zap, Crown, Diamond, Sparkles, 
  Flame, Rocket, Music, PartyPopper, Cake, Coffee, Pizza, 
  IceCream, Flower2, Rainbow, Sun, Moon, Ghost, Skull,
  Timer, TrendingUp
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  recipientId: string;
  recipientName?: string;
}

interface GiftType {
  icon: React.ReactNode;
  label: string;
  cost: number;
  category: 'basic' | 'premium' | 'exclusive';
  emoji: string;
  color: string;
  animation?: string;
}

const allGifts: GiftType[] = [
  // Basic Gifts (10-50 credits)
  { icon: <Heart className="w-6 h-6" />, label: 'Heart', cost: 10, category: 'basic', emoji: '❤️', color: 'from-red-400 to-pink-500' },
  { icon: <Star className="w-6 h-6" />, label: 'Star', cost: 15, category: 'basic', emoji: '⭐', color: 'from-yellow-400 to-amber-500' },
  { icon: <Coffee className="w-6 h-6" />, label: 'Coffee', cost: 20, category: 'basic', emoji: '☕', color: 'from-amber-600 to-orange-700' },
  { icon: <Flower2 className="w-6 h-6" />, label: 'Flower', cost: 25, category: 'basic', emoji: '🌸', color: 'from-pink-400 to-rose-500' },
  { icon: <Sun className="w-6 h-6" />, label: 'Sunshine', cost: 30, category: 'basic', emoji: '☀️', color: 'from-yellow-300 to-orange-400' },
  { icon: <Music className="w-6 h-6" />, label: 'Music', cost: 35, category: 'basic', emoji: '🎵', color: 'from-purple-400 to-indigo-500' },
  { icon: <Pizza className="w-6 h-6" />, label: 'Pizza', cost: 40, category: 'basic', emoji: '🍕', color: 'from-orange-400 to-red-500' },
  { icon: <IceCream className="w-6 h-6" />, label: 'Ice Cream', cost: 45, category: 'basic', emoji: '🍦', color: 'from-pink-300 to-purple-400' },
  { icon: <Moon className="w-6 h-6" />, label: 'Moon', cost: 50, category: 'basic', emoji: '🌙', color: 'from-indigo-400 to-purple-600' },
  
  // Premium Gifts (75-200 credits)
  { icon: <Zap className="w-6 h-6" />, label: 'Lightning', cost: 75, category: 'premium', emoji: '⚡', color: 'from-yellow-400 to-amber-600', animation: 'gift-pulse' },
  { icon: <Trophy className="w-6 h-6" />, label: 'Trophy', cost: 100, category: 'premium', emoji: '🏆', color: 'from-yellow-500 to-amber-600', animation: 'gift-pulse' },
  { icon: <Flame className="w-6 h-6" />, label: 'Fire', cost: 120, category: 'premium', emoji: '🔥', color: 'from-orange-500 to-red-600', animation: 'gift-pulse' },
  { icon: <PartyPopper className="w-6 h-6" />, label: 'Party', cost: 150, category: 'premium', emoji: '🎉', color: 'from-purple-500 to-pink-500', animation: 'gift-pulse' },
  { icon: <Cake className="w-6 h-6" />, label: 'Cake', cost: 175, category: 'premium', emoji: '🎂', color: 'from-pink-400 to-rose-600', animation: 'gift-pulse' },
  { icon: <Rainbow className="w-6 h-6" />, label: 'Rainbow', cost: 200, category: 'premium', emoji: '🌈', color: 'from-red-400 via-yellow-400 to-blue-500', animation: 'gift-pulse' },
  
  // Exclusive Gifts (300-1000 credits)
  { icon: <Rocket className="w-6 h-6" />, label: 'Rocket', cost: 300, category: 'exclusive', emoji: '🚀', color: 'from-blue-500 to-indigo-600', animation: 'promote-glow' },
  { icon: <Crown className="w-6 h-6" />, label: 'Crown', cost: 500, category: 'exclusive', emoji: '👑', color: 'from-yellow-400 to-amber-500', animation: 'promote-glow' },
  { icon: <Diamond className="w-6 h-6" />, label: 'Diamond', cost: 750, category: 'exclusive', emoji: '💎', color: 'from-cyan-400 to-blue-500', animation: 'promote-glow' },
  { icon: <Sparkles className="w-6 h-6" />, label: 'Universe', cost: 1000, category: 'exclusive', emoji: '✨', color: 'from-purple-500 via-pink-500 to-rose-500', animation: 'promote-glow' },
];

export default function GiftModal({ isOpen, onClose, postId, recipientId, recipientName }: GiftModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [credits, setCredits] = useState(0);
  const [activeTab, setActiveTab] = useState('basic');
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number }[]>([]);
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

  const addFloatingEmoji = (emoji: string) => {
    const id = Date.now();
    const x = Math.random() * 80 + 10;
    setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
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

    if (credits < gift.cost) {
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
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_post_id: postId,
        p_gift_type: gift.label,
        p_cost: gift.cost,
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

      // Add floating emojis
      for (let i = 0; i < (comboCount > 1 ? 5 : 3); i++) {
        setTimeout(() => addFloatingEmoji(gift.emoji), i * 100);
      }

      setCredits(prev => prev - gift.cost);

      toast({ 
        title: comboCount > 1 ? `${comboCount}x Combo! ${gift.emoji}` : `${gift.emoji} Gift sent!`,
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
        {/* Floating Emojis */}
        {floatingEmojis.map(({ id, emoji, x }) => (
          <div
            key={id}
            className="floating-gift fixed text-4xl pointer-events-none z-50"
            style={{ left: `${x}%`, bottom: '50%' }}
          >
            {emoji}
          </div>
        ))}

        {/* Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
          </div>
          
          <div className="relative flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mb-3 ${sending ? 'gift-pulse' : ''}`}>
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
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-bold">{credits}</span>
              <span className="text-xs text-muted-foreground">credits available</span>
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
                      key={gift.label}
                      variant="outline"
                      className={`gift-card flex flex-col items-center gap-2 h-auto py-4 rounded-xl border-2 transition-all relative overflow-hidden
                        ${selectedGift?.label === gift.label ? 'border-primary scale-105' : 'border-border hover:border-primary/50'}
                        ${credits < gift.cost ? 'opacity-50' : ''}
                      `}
                      onClick={() => handleSendGift(gift)}
                      disabled={sending || credits < gift.cost}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${gift.color} opacity-10`} />
                      <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${gift.color} flex items-center justify-center text-white ${gift.animation || ''}`}>
                        {gift.icon}
                      </div>
                      <div className="relative">
                        <div className="text-lg">{gift.emoji}</div>
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