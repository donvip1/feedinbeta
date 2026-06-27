-- Create table for user public keys (E2EE)
CREATE TABLE public.user_public_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key_jwk JSONB NOT NULL,
  key_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read public keys (needed for encryption)
CREATE POLICY "Public keys are readable by all authenticated"
ON public.user_public_keys FOR SELECT TO authenticated
USING (true);

-- Users can insert their own public key
CREATE POLICY "Users can insert own public key"
ON public.user_public_keys FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own public key
CREATE POLICY "Users can update own public key"
ON public.user_public_keys FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create table for encrypted user data (server-side encryption)
CREATE TABLE public.encrypted_user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_encrypted TEXT,
  date_of_birth_encrypted TEXT,
  address_encrypted TEXT,
  government_id_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.encrypted_user_data ENABLE ROW LEVEL SECURITY;

-- Only the owner can read their encrypted data
CREATE POLICY "Users can read own encrypted data"
ON public.encrypted_user_data FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own encrypted data
CREATE POLICY "Users can insert own encrypted data"
ON public.encrypted_user_data FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own encrypted data
CREATE POLICY "Users can update own encrypted data"
ON public.encrypted_user_data FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add encrypted_content column to messages table for E2EE
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS encrypted_content JSONB,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sender_public_key_version INTEGER;

-- Create trigger for updated_at on user_public_keys
CREATE TRIGGER update_user_public_keys_updated_at
BEFORE UPDATE ON public.user_public_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on encrypted_user_data
CREATE TRIGGER update_encrypted_user_data_updated_at
BEFORE UPDATE ON public.encrypted_user_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();