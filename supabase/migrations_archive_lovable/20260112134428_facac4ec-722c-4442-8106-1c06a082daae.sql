-- Add phone number and date of birth to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS date_of_birth date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS occupation text DEFAULT NULL;

-- Add phone_verified column for verification status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);