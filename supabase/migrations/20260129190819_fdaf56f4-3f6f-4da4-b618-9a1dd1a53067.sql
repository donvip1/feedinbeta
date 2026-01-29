-- Add missing total_promotions column to user_analytics
ALTER TABLE user_analytics 
ADD COLUMN IF NOT EXISTS total_promotions INTEGER DEFAULT 0;