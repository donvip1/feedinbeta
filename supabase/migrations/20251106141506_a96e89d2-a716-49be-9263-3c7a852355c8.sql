-- Fix search_path for all public functions to improve security

-- Fix generate_stream_key function
CREATE OR REPLACE FUNCTION public.generate_stream_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'stream_' || encode(gen_random_bytes(16), 'hex');
END;
$$;