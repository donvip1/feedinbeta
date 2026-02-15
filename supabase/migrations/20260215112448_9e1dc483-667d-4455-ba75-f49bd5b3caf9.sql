-- Add highest_tier_level to user_credits to track what packs users have purchased
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS highest_tier_level integer DEFAULT 0;
