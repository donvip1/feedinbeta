-- Add features and tier_level columns to credit_packages
ALTER TABLE public.credit_packages 
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tier_level integer DEFAULT 0;

-- Update tier levels and features for each package
UPDATE public.credit_packages SET 
  tier_level = 1,
  features = '["AI Image Generation", "AI Chat & Writing", "Send Gifts to Creators", "Create Live Spaces"]'::jsonb
WHERE name = 'Starter Pack';

UPDATE public.credit_packages SET 
  tier_level = 2,
  features = '["AI Image Generation", "AI Chat & Writing", "Send Gifts to Creators", "Create Live Spaces", "Create Livestreams", "Promote Your Posts"]'::jsonb
WHERE name = 'Popular Pack';

UPDATE public.credit_packages SET 
  tier_level = 3,
  features = '["AI Image Generation", "AI Chat & Writing", "Send Gifts to Creators", "Create Live Spaces", "Create Livestreams", "Promote Your Posts", "Schedule Posts", "Boosted Reach"]'::jsonb
WHERE name = 'Mega Pack';

UPDATE public.credit_packages SET 
  tier_level = 4,
  features = '["AI Image Generation", "AI Chat & Writing", "Send Gifts to Creators", "Create Live Spaces", "Create Livestreams", "Promote Your Posts", "Schedule Posts", "Boosted Reach", "Verified Badge", "Featured Profile"]'::jsonb
WHERE name = 'Ultimate Pack';

UPDATE public.credit_packages SET 
  tier_level = 5,
  features = '["AI Image Generation", "AI Chat & Writing", "Send Gifts to Creators", "Create Live Spaces", "Create Livestreams", "Promote Your Posts", "Schedule Posts", "Boosted Reach", "Verified Badge", "Featured Profile", "API Access", "Bulk Distribution"]'::jsonb
WHERE name = 'Reseller Pack';