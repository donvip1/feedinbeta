import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface UserAd {
  id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string | null;
  click_url: string | null;
  daily_budget_credits: number | null;
  total_budget_credits: number | null;
  target_age_min: number | null;
  target_age_max: number | null;
  target_interests: string[] | null;
  target_countries: string[] | null;
  target_genders: string[] | null;
  is_active: boolean | null;
  approval_status: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export interface CreateAdParams {
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: string;
  clickUrl?: string;
  ctaText: string;
  budgetCredits: number;
  durationHours: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  targetInterests?: string[];
  targetCountries?: string[];
  targetGenders?: string[];
  postId?: string;
}

export const useUserAds = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState<UserAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchAds = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feed_ads')
        .select('id, title, description, media_url, media_type, click_url, daily_budget_credits, total_budget_credits, target_age_min, target_age_max, target_interests, target_countries, target_genders, is_active, approval_status, impressions, clicks, ctr, started_at, expires_at, created_at')
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAds((data as UserAd[]) || []);
    } catch (error: any) {
      console.error('Error fetching ads:', error);
      toast({
        title: 'Error loading ads',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchAds();
    }
  }, [user, fetchAds]);

  const createAd = async (params: CreateAdParams): Promise<boolean> => {
    if (!user) return false;

    try {
      setCreating(true);

      // Check user balance first
      const { data: balanceData, error: balanceError } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (balanceError) throw balanceError;

      const currentBalance = balanceData?.balance || 0;
      if (currentBalance < params.budgetCredits) {
        toast({
          title: 'Insufficient credits',
          description: `You need ${params.budgetCredits} credits but only have ${currentBalance}.`,
          variant: 'destructive',
        });
        return false;
      }

      // Calculate end date based on duration
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + params.durationHours * 60 * 60 * 1000);

      // Create ad entry - include ctaText in description for now since table doesn't have cta_text column
      const { error: adError } = await supabase
        .from('feed_ads')
        .insert({
          advertiser_id: user.id,
          title: params.title,
          description: params.ctaText ? `[CTA:${params.ctaText}] ${params.description}` : params.description,
          media_url: params.mediaUrl,
          media_type: params.mediaType,
          click_url: params.clickUrl || null,
          daily_budget_credits: Math.ceil(params.budgetCredits / Math.ceil(params.durationHours / 24)),
          total_budget_credits: params.budgetCredits,
          target_age_min: params.targetAgeMin || 13,
          target_age_max: params.targetAgeMax || 65,
          target_interests: params.targetInterests || [],
          target_countries: params.targetCountries || [],
          target_genders: params.targetGenders || [],
          is_active: true,
          approval_status: 'approved', // Auto-approve for now
          started_at: startDate.toISOString(),
          expires_at: endDate.toISOString(),
        });

      if (adError) throw adError;

      // Deduct credits via transaction (trigger handles balance update)
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: -params.budgetCredits,
          type: 'ad_promotion',
          description: `Ad promotion: ${params.title}`,
        });

      if (transactionError) throw transactionError;

      toast({
        title: 'Ad created successfully!',
        description: `Your ad "${params.title}" is now live.`,
      });

      await fetchAds();
      return true;
    } catch (error: any) {
      console.error('Error creating ad:', error);
      toast({
        title: 'Error creating ad',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setCreating(false);
    }
  };

  const pauseAd = async (adId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('feed_ads')
        .update({ is_active: false })
        .eq('id', adId)
        .eq('advertiser_id', user?.id);

      if (error) throw error;

      toast({ title: 'Ad paused' });
      await fetchAds();
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const resumeAd = async (adId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('feed_ads')
        .update({ is_active: true })
        .eq('id', adId)
        .eq('advertiser_id', user?.id);

      if (error) throw error;

      toast({ title: 'Ad resumed' });
      await fetchAds();
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteAd = async (adId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('feed_ads')
        .delete()
        .eq('id', adId)
        .eq('advertiser_id', user?.id);

      if (error) throw error;

      toast({ title: 'Ad deleted' });
      await fetchAds();
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    ads,
    loading,
    creating,
    fetchAds,
    createAd,
    pauseAd,
    resumeAd,
    deleteAd,
  };
};
