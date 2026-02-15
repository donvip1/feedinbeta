-- Add FK from user_roles to profiles (for PostgREST joins)
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_assigned_by_profiles_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id);

-- Add FK from admin_action_logs to profiles
ALTER TABLE public.admin_action_logs
  ADD CONSTRAINT admin_action_logs_admin_id_profiles_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id);

-- Add FKs for p2p_disputes
ALTER TABLE public.p2p_disputes
  ADD CONSTRAINT p2p_disputes_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.p2p_transactions(id);

ALTER TABLE public.p2p_disputes
  ADD CONSTRAINT p2p_disputes_initiated_by_profiles_fkey FOREIGN KEY (initiated_by) REFERENCES public.profiles(id);

ALTER TABLE public.p2p_disputes
  ADD CONSTRAINT p2p_disputes_moderator_id_profiles_fkey FOREIGN KEY (moderator_id) REFERENCES public.profiles(id);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';