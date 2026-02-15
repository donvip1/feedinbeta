
-- Add paystack_reference and payment_provider columns to user_subscriptions
ALTER TABLE public.user_subscriptions 
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'paystack';

-- Add subscription_credits column to subscription_tiers to define how many credits come with each plan
ALTER TABLE public.subscription_tiers 
  ADD COLUMN IF NOT EXISTS subscription_credits integer DEFAULT 0;

-- Set subscription credits for each tier
UPDATE public.subscription_tiers SET subscription_credits = 100 WHERE name = 'Basic';
UPDATE public.subscription_tiers SET subscription_credits = 500 WHERE name = 'Pro';
UPDATE public.subscription_tiers SET subscription_credits = 1500 WHERE name = 'Premium';
