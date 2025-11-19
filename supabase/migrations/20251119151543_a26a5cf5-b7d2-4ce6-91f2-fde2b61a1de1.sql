-- Create service worker notifications table for offline support
CREATE TABLE IF NOT EXISTS public.offline_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.offline_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own offline notifications"
  ON public.offline_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own offline notifications"
  ON public.offline_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own offline notifications"
  ON public.offline_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_offline_notifications_user_id ON public.offline_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_notifications_synced ON public.offline_notifications(synced);