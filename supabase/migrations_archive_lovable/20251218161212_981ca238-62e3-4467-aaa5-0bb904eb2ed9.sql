-- Create private schema first
CREATE SCHEMA IF NOT EXISTS private;

-- Create encryption key storage table in private schema
CREATE TABLE IF NOT EXISTS private.encryption_keys (
  id TEXT PRIMARY KEY DEFAULT 'default',
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert a secure key
INSERT INTO private.encryption_keys (id, key_value)
VALUES ('sensitive_data', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- Revoke all access to private schema from public roles
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon, authenticated;

-- Add encrypted columns to profile_sensitive_data
ALTER TABLE public.profile_sensitive_data 
ADD COLUMN IF NOT EXISTS phone_number_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS stripe_customer_id_encrypted BYTEA;

-- Create secure encryption function
CREATE OR REPLACE FUNCTION private.encrypt_sensitive(plain_text TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  IF plain_text IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT key_value INTO enc_key FROM private.encryption_keys WHERE id = 'sensitive_data';
  RETURN extensions.pgp_sym_encrypt(plain_text, enc_key);
END;
$$;

-- Create secure decryption function
CREATE OR REPLACE FUNCTION private.decrypt_sensitive(encrypted_data BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT key_value INTO enc_key FROM private.encryption_keys WHERE id = 'sensitive_data';
  RETURN extensions.pgp_sym_decrypt(encrypted_data, enc_key);
END;
$$;

-- Migrate existing data to encrypted columns
UPDATE public.profile_sensitive_data
SET 
  phone_number_encrypted = private.encrypt_sensitive(phone_number),
  stripe_customer_id_encrypted = private.encrypt_sensitive(stripe_customer_id)
WHERE phone_number IS NOT NULL OR stripe_customer_id IS NOT NULL;

-- Create secure accessor function
DROP FUNCTION IF EXISTS public.get_my_sensitive_data();
CREATE OR REPLACE FUNCTION public.get_my_sensitive_data()
RETURNS TABLE (
  user_id UUID,
  phone_number TEXT,
  stripe_customer_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psd.user_id,
    private.decrypt_sensitive(psd.phone_number_encrypted),
    private.decrypt_sensitive(psd.stripe_customer_id_encrypted)
  FROM public.profile_sensitive_data psd
  WHERE psd.user_id = auth.uid();
END;
$$;

-- Create secure update function
DROP FUNCTION IF EXISTS public.update_my_phone_number(TEXT);
CREATE OR REPLACE FUNCTION public.update_my_phone_number(new_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  UPDATE public.profile_sensitive_data
  SET 
    phone_number = NULL,
    phone_number_encrypted = private.encrypt_sensitive(new_phone),
    updated_at = now()
  WHERE user_id = auth.uid();
  
  IF NOT FOUND THEN
    INSERT INTO public.profile_sensitive_data (user_id, phone_number_encrypted)
    VALUES (auth.uid(), private.encrypt_sensitive(new_phone));
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Clear plain text after encryption
UPDATE public.profile_sensitive_data
SET phone_number = NULL, stripe_customer_id = NULL
WHERE phone_number_encrypted IS NOT NULL OR stripe_customer_id_encrypted IS NOT NULL;

-- Strengthen RLS
DROP POLICY IF EXISTS "Users can view own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can read own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Owner only access to sensitive data" ON public.profile_sensitive_data;

CREATE POLICY "Owner only access to sensitive data"
ON public.profile_sensitive_data
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE SELECT ON public.profile_sensitive_data FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_sensitive_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_phone_number(TEXT) TO authenticated;