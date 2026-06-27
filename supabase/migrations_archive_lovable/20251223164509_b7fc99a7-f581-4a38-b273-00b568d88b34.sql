-- Add appreciation feedback columns to gift_analytics
ALTER TABLE public.gift_analytics ADD COLUMN IF NOT EXISTS sender_feedback TEXT;
ALTER TABLE public.gift_analytics ADD COLUMN IF NOT EXISTS receiver_feedback TEXT;
ALTER TABLE public.gift_analytics ADD COLUMN IF NOT EXISTS feedback_timestamp TIMESTAMPTZ;

-- Create preset appreciation options table
CREATE TABLE IF NOT EXISTS public.gift_appreciation_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on gift_appreciation_options
ALTER TABLE public.gift_appreciation_options ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read appreciation options
CREATE POLICY "Anyone can read appreciation options"
ON public.gift_appreciation_options
FOR SELECT
USING (true);

-- Insert preset appreciation messages
INSERT INTO public.gift_appreciation_options (emoji, message, category, sort_order) VALUES
('🙏', 'Thank you so much!', 'general', 1),
('❤️', 'You are amazing!', 'general', 2),
('⭐', 'This means a lot!', 'general', 3),
('💎', 'You made my day!', 'general', 4),
('🔥', 'You rock!', 'general', 5),
('🎉', 'Truly appreciated!', 'general', 6),
('💜', 'So grateful!', 'general', 7),
('🌟', 'Best gift ever!', 'general', 8);

-- Create user_wallet_notifications table to track unread gifts
CREATE TABLE IF NOT EXISTS public.user_wallet_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on user_wallet_notifications
ALTER TABLE public.user_wallet_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own notification settings
CREATE POLICY "Users can view their own wallet notifications"
ON public.user_wallet_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet notifications"
ON public.user_wallet_notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet notifications"
ON public.user_wallet_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for gift_analytics
ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_analytics;