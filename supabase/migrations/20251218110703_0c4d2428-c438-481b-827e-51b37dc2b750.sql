
-- Drop the duplicate trigger causing double refeed counts
DROP TRIGGER IF EXISTS trigger_update_refeeds_count ON public.post_shares;
