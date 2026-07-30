-- Restrict unique-view RPC execution to their intended API roles.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so revoke
-- that inherited permission before granting the narrow role-specific access.

revoke execute on function public.record_post_view(uuid) from public;
revoke execute on function public.record_anonymous_post_view(uuid, text)
  from public;

grant execute on function public.record_post_view(uuid) to authenticated;
revoke execute on function public.record_post_view(uuid) from anon;

grant execute on function public.record_anonymous_post_view(uuid, text) to anon;
revoke execute on function public.record_anonymous_post_view(uuid, text)
  from authenticated;
