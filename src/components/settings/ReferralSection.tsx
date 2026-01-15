import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { Copy, Share2, Users, Gift, Check, ExternalLink } from 'lucide-react';

export const ReferralSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Fetch user profile with referral data
  const { data: profile } = useCachedQuery({
    cacheKey: `referral:${user?.id}`,
    queryKey: ['referral-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, referral_count, referred_by')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    ttl: 60 * 1000, // 1 minute
  });

  // Fetch referrer info if user was referred
  const { data: referrer } = useCachedQuery({
    cacheKey: `referrer:${profile?.referred_by}`,
    queryKey: ['referrer-info', profile?.referred_by],
    queryFn: async () => {
      if (!profile?.referred_by) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', profile.referred_by)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!profile?.referred_by,
    ttl: 5 * 60 * 1000, // 5 minutes
  });

  // Use published URL for referral links (update to custom domain when available)
  const PUBLISHED_URL = 'https://feedinbeta.lovable.app';
  
  const referralLink = profile?.username 
    ? `${PUBLISHED_URL}/referral/${profile.username}`
    : '';

  const handleCopy = async () => {
    if (!referralLink) return;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!referralLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join FEEDIN',
          text: `Join me on FEEDIN - the AI-powered social media platform!`,
          url: referralLink,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  if (!profile?.username) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card/50 to-card/30 border-border">
        <div className="text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Complete your profile to get your referral link</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-xl bg-primary/20">
          <Gift className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Invite Friends</h3>
          <p className="text-sm text-muted-foreground">
            Share your referral link and grow your network
          </p>
        </div>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-background/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {profile.referral_count || 0}
          </div>
          <div className="text-xs text-muted-foreground">People Referred</div>
        </div>
        <div className="bg-background/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent">
            {referrer ? '1' : '0'}
          </div>
          <div className="text-xs text-muted-foreground">
            {referrer 
              ? `Referred by @${referrer.username}` 
              : 'No referrer'}
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Your Referral Link
        </label>
        <div className="flex gap-2">
          <Input
            value={referralLink}
            readOnly
            className="bg-background/50 text-sm font-mono"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        <Button
          onClick={handleShare}
          className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Referral Link
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          <ExternalLink className="w-3 h-3 inline mr-1" />
          feedin.com/referral/{profile.username}
        </p>
      </div>
    </Card>
  );
};

export default ReferralSection;
