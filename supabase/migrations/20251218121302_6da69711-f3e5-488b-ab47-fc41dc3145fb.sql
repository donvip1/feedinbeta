-- Fix: Add unique constraint on user_analytics.user_id for ON CONFLICT to work
-- First, handle any existing duplicates by keeping only the most recent record per user
DELETE FROM public.user_analytics a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_analytics
  ORDER BY user_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
);

-- Drop the existing non-unique index if it exists
DROP INDEX IF EXISTS public.idx_user_analytics_user_id;

-- Add unique constraint on user_id
ALTER TABLE public.user_analytics
ADD CONSTRAINT user_analytics_user_id_key UNIQUE (user_id);