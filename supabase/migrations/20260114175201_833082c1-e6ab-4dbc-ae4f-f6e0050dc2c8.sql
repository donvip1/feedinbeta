-- Add last_display_name_change column to profiles table for 5-month restriction
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_display_name_change TIMESTAMP WITH TIME ZONE DEFAULT NULL;