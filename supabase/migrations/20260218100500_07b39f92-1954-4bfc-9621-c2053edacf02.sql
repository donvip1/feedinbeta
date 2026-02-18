-- Enable realtime for user_roles table so role changes are instantly reflected
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;