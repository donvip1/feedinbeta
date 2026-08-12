-- Username -> email resolver for username sign-in (web + native parity).
--
-- The native app's AuthRepository.signInWithIdentifier resolves a username to
-- the owning account's email via this RPC before calling signInWithPassword,
-- mirroring the web SignInForm. The function was previously only present in the
-- archived Lovable migrations, so it is (re)created here for the native project.
--
-- SECURITY DEFINER so it can read auth.users; lookup is by lowercased username
-- against public.profiles. Returns null when no such username exists, keeping
-- "unknown username" and "wrong password" indistinguishable to the caller.
--
-- anon needs EXECUTE because the resolve happens on the login screen before a
-- session exists; PostgreSQL grants EXECUTE to PUBLIC on new functions by
-- default, so revoke that inherited grant before granting the narrow roles.

create or replace function public.get_user_email_by_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  select id into v_user_id
  from public.profiles
  where lower(username) = lower(p_username)
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  select email into v_email
  from auth.users
  where id = v_user_id;

  return v_email;
end;
$$;

revoke execute on function public.get_user_email_by_username(text) from public;
grant execute on function public.get_user_email_by_username(text) to anon;
grant execute on function public.get_user_email_by_username(text) to authenticated;
