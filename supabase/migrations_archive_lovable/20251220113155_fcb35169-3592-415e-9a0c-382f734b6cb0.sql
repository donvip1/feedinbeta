-- Create push_subscriptions table to store user push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions" 
ON public.push_subscriptions 
FOR ALL 
USING (auth.uid() = user_id);

-- Add additional notification preference columns
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS friend_requests_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gifts_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS follows_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS live_enabled BOOLEAN DEFAULT true;

-- Enable realtime for push_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;