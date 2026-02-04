-- Add missing columns to platform_wallet table
ALTER TABLE platform_wallet 
ADD COLUMN IF NOT EXISTS platform_profit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS creator_payouts_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_feature_revenue NUMERIC DEFAULT 0;