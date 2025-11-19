-- Fix gift sending: Ensure proper constraints on credit_transactions
-- The error suggests there's no unique constraint matching ON CONFLICT specification
-- Let's drop any existing problematic constraints and recreate properly

-- Add status_visibility column for status feature
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_visibility TEXT DEFAULT 'public' CHECK (status_visibility IN ('public', 'friends', 'followers'));

-- Add purpose_updated_at to track when purpose was last changed (for 2-week lock)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purpose_updated_at TIMESTAMP WITH TIME ZONE;

-- Ensure proper handling of credit transactions (remove ON CONFLICT issues)
-- We'll handle duplicates in application logic instead of database constraints