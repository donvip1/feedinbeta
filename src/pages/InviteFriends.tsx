import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { Copy, Share2, Users, Gift, Check, ExternalLink, Trophy, Star, UserPlus } from 'lucide-react';
import { createShareableUrl } from '@/lib/url-utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { motion } from 'framer-motion';

const InviteFriends = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

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
    ttl: 60 * 1000,
  });

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
    ttl: 5 * 60 * 1000,
  });

  const referralLink = profile?.username
    ? createShareableUrl(`/referral/${profile.username}`)
    : '';

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Referral link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', description: 'Please copy the link manually', variant: 'destructive' });
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
        if ((err as Error).name !== 'AbortError') handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const referralCount = profile?.referral_count || 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Invite Friends & Earn" backTo="/settings" />

      <main className="px-4 py-6 max-w-lg mx-auto pb-24 space-y-5">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Invite & Grow Together</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Share your link with friends. When they join, you both benefit from the FeedIn community.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          <Card className="p-4 bg-card/80 border-border/60 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="text-2xl font-bold text-primary">{referralCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Friends Invited</div>
          </Card>
          <Card className="p-4 bg-card/80 border-border/60 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              {referrer ? <Star className="w-5 h-5 text-accent" /> : <UserPlus className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="text-2xl font-bold text-accent">{referrer ? '1' : '0'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {referrer ? `By @${referrer.username}` : 'No referrer'}
            </div>
          </Card>
        </motion.div>

        {/* Milestones */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="p-4 bg-card/80 border-border/60">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Milestones
            </h3>
            <div className="space-y-3">
              {[
                { count: 5, label: 'Rising Star', achieved: referralCount >= 5 },
                { count: 15, label: 'Community Builder', achieved: referralCount >= 15 },
                { count: 50, label: 'Ambassador', achieved: referralCount >= 50 },
              ].map((milestone) => (
                <div key={milestone.count} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    milestone.achieved
                      ? 'bg-primary/20 text-primary'
                      : 'bg-secondary/50 text-muted-foreground'
                  }`}>
                    {milestone.count}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${milestone.achieved ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {milestone.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Invite {milestone.count} friends
                    </p>
                  </div>
                  {milestone.achieved && <Check className="w-4 h-4 text-primary" />}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Referral Link */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <h3 className="text-sm font-semibold text-foreground mb-3">Your Referral Link</h3>

            {profile?.username ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={referralLink}
                    readOnly
                    className="bg-background/60 text-sm font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Button
                  onClick={handleShare}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Referral Link
                </Button>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  feedinn.com/referral/{profile.username}
                </p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Complete your profile to get your referral link</p>
              </div>
            )}
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default InviteFriends;
