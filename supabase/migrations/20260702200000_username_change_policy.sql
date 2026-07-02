-- Username change policy (server-authoritative — the client UI mirrors this but
-- the RPC is the real enforcement).
--
-- Rules:
--   * Standard users: set a username once; after that it is permanently locked.
--   * Premium users (active subscription OR profiles.is_premium): may change it
--     once every 90 days, only while premium.
--   * Format: 3-30 chars, [a-z0-9_], stored lowercase; unique (backed by the
--     existing profiles.username UNIQUE constraint).

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

-- Premium = a live subscription or the is_premium flag.
create or replace function public.is_user_premium(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_premium from public.profiles where id = p_user), false)
      or exists (
        select 1 from public.user_subscriptions
        where user_id = p_user
          and status = 'active'
          and (current_period_end is null or current_period_end > now())
      );
$$;

-- Read-only status for the client (drives show/hide + countdown copy).
create or replace function public.username_change_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur text;
  changed_at timestamptz;
  premium boolean;
  cooldown interval := interval '90 days';
  next_at timestamptz;
  can boolean;
  reason text;
begin
  if uid is null then
    return jsonb_build_object('can_change', false, 'reason', 'not_authenticated');
  end if;
  select username, username_changed_at into cur, changed_at from public.profiles where id = uid;
  premium := public.is_user_premium(uid);

  if cur is null or cur = '' then
    can := true; reason := 'first_time';
  elsif not premium then
    can := false; reason := 'locked_standard';
  elsif changed_at is not null and (now() - changed_at) < cooldown then
    can := false; reason := 'cooldown'; next_at := changed_at + cooldown;
  else
    can := true; reason := 'premium_eligible';
  end if;

  return jsonb_build_object(
    'can_change', can,
    'reason', reason,
    'is_premium', premium,
    'next_change_at', next_at,
    'days_remaining',
      case when next_at is not null
        then greatest(0, ceil(extract(epoch from (next_at - now())) / 86400))
        else 0 end
  );
end;
$$;

-- Perform the change with full server-side enforcement.
create or replace function public.change_username(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  normalized text := lower(trim(coalesce(p_username, '')));
  cur text;
  changed_at timestamptz;
  premium boolean;
  cooldown interval := interval '90 days';
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if normalized !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Username must be 3-30 characters: letters, numbers, or underscores.';
  end if;

  if exists (select 1 from public.profiles where lower(username) = normalized and id <> uid) then
    raise exception 'That username is already taken.';
  end if;

  select username, username_changed_at into cur, changed_at from public.profiles where id = uid;
  premium := public.is_user_premium(uid);

  if cur is null or cur = '' then
    null; -- first-time set is always allowed
  elsif not premium then
    raise exception 'Your username is locked. Upgrade to premium to change it.';
  elsif changed_at is not null and (now() - changed_at) < cooldown then
    raise exception 'You can change your username again on %.',
      to_char(changed_at + cooldown, 'YYYY-MM-DD');
  end if;

  begin
    update public.profiles
      set username = normalized, username_changed_at = now(), updated_at = now()
      where id = uid;
  exception when unique_violation then
    raise exception 'That username is already taken.';
  end;

  return jsonb_build_object(
    'username', normalized,
    'changed_at', now(),
    'next_change_at', now() + cooldown,
    'is_premium', premium
  );
end;
$$;

grant execute on function public.is_user_premium(uuid) to authenticated, service_role;
grant execute on function public.username_change_status() to authenticated, service_role;
grant execute on function public.change_username(text) to authenticated, service_role;
