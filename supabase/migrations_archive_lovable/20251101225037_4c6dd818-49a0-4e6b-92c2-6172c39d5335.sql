-- Backfill missing user credits with 100
INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
SELECT p.id, 100, 100, 0
FROM public.profiles p
LEFT JOIN public.user_credits uc ON uc.user_id = p.id
WHERE uc.user_id IS NULL;

-- Ensure new profiles automatically receive initial credits
DROP TRIGGER IF EXISTS trg_initialize_user_credits ON public.profiles;
CREATE TRIGGER trg_initialize_user_credits
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_user_credits();