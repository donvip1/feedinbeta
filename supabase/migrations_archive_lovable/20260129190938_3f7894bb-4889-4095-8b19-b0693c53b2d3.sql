-- Add missing last_active column to user_analytics
ALTER TABLE user_analytics 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT now();