-- Create privacy_settings table
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_visible BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  allow_friend_requests BOOLEAN DEFAULT true,
  allow_messages_from_strangers BOOLEAN DEFAULT false,
  show_read_receipts BOOLEAN DEFAULT true,
  show_activity_status BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own privacy settings"
ON public.privacy_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings"
ON public.privacy_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings"
ON public.privacy_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_privacy_settings_updated_at
BEFORE UPDATE ON public.privacy_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add language preference to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';