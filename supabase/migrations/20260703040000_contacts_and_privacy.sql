-- Contact sync (hashed) + WhatsApp-style privacy (Module 6).
--
-- Contact matching NEVER stores raw phone numbers server-side. Each user opts in
-- by registering the SHA-256 hash of their own normalized number
-- (set_my_phone_hash); a client then hashes its address-book numbers the same
-- way and calls match_contacts to find which hashes belong to feedIn users.
--
-- "Friends" = a mutual follow (the follows table). Privacy prefs (last seen /
-- photo / status / about) default to 'friends'; a helper resolves whether a
-- viewer may see a given field.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone_hash text,
  add column if not exists privacy_last_seen text not null default 'friends',
  add column if not exists privacy_photo     text not null default 'friends',
  add column if not exists privacy_status    text not null default 'friends',
  add column if not exists privacy_about     text not null default 'friends';

-- Constrain the privacy values.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_privacy_values_chk') then
    alter table public.profiles add constraint profiles_privacy_values_chk check (
      privacy_last_seen in ('everyone','friends','nobody')
      and privacy_photo  in ('everyone','friends','nobody')
      and privacy_status in ('everyone','friends','nobody')
      and privacy_about  in ('everyone','friends','nobody')
    );
  end if;
end $$;

create index if not exists profiles_phone_hash_idx
  on public.profiles(phone_hash) where phone_hash is not null;

-- ---------------------------------------------------------------------------
-- Friendship (mutual follow) helper
-- ---------------------------------------------------------------------------
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.follows f1
    where f1.follower_id = p_a and f1.following_id = p_b
  ) and exists (
    select 1 from public.follows f2
    where f2.follower_id = p_b and f2.following_id = p_a
  );
$$;

-- Whether [p_viewer] may see [p_field] of [p_owner] given the owner's setting.
create or replace function public.can_view_profile_field(
  p_viewer uuid, p_owner uuid, p_field text
)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  setting text;
begin
  if p_viewer = p_owner then return true; end if;
  select case p_field
    when 'last_seen' then privacy_last_seen
    when 'photo'     then privacy_photo
    when 'status'    then privacy_status
    when 'about'     then privacy_about
    else 'friends' end
  into setting
  from public.profiles where id = p_owner;

  if setting is null or setting = 'friends' then
    return p_viewer is not null and public.are_friends(p_viewer, p_owner);
  elsif setting = 'everyone' then
    return true;
  else -- 'nobody'
    return false;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phone hash registration + contact matching
-- ---------------------------------------------------------------------------

-- Register the current user's own phone hash (client computes SHA-256 of the
-- E.164-normalized number). Only stores the hash, never the raw number.
create or replace function public.set_my_phone_hash(p_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_hash is null or length(trim(p_hash)) < 16 then
    raise exception 'invalid phone hash';
  end if;
  update public.profiles set phone_hash = lower(trim(p_hash)), updated_at = now()
    where id = uid;
end;
$$;

-- Match a batch of contact-number hashes to feedIn users (excludes self). Caps
-- the batch to keep it cheap. Returns minimal public discovery fields.
create or replace function public.match_contacts(p_hashes text[])
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where p.phone_hash is not null
    and p.id <> auth.uid()
    and p.phone_hash = any (
      select lower(trim(h)) from unnest(p_hashes[1:2000]) as h
    );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_profile_field(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.set_my_phone_hash(text) to authenticated, service_role;
grant execute on function public.match_contacts(text[]) to authenticated, service_role;
