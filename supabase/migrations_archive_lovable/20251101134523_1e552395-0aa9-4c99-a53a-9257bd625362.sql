-- Add subscription requirement field to groups table
ALTER TABLE public.groups 
ADD COLUMN requires_subscription BOOLEAN DEFAULT false;