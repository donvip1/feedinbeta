-- Drop the duplicate bigint version, keep only the integer one
DROP FUNCTION IF EXISTS public.admin_transfer_to_user(uuid, bigint, text);