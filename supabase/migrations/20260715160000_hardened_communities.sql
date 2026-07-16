-- Web-compatible communities with hardened membership and chat authorization.

create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  avatar_url text,
  cover_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  is_private boolean not null default false,
  is_premium boolean not null default false,
  requires_subscription boolean not null default false,
  member_count integer not null default 0,
  post_count integer not null default 0,
  invite_code text not null default encode(gen_random_bytes(10), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invite_code)
);

alter table public.groups add column if not exists description text not null default '';
alter table public.groups add column if not exists avatar_url text;
alter table public.groups add column if not exists cover_url text;
alter table public.groups add column if not exists is_private boolean not null default false;
alter table public.groups add column if not exists is_premium boolean not null default false;
alter table public.groups add column if not exists requires_subscription boolean not null default false;
alter table public.groups add column if not exists member_count integer not null default 0;
alter table public.groups add column if not exists post_count integer not null default 0;
alter table public.groups add column if not exists invite_code text;
alter table public.groups add column if not exists created_at timestamptz not null default now();
alter table public.groups add column if not exists updated_at timestamptz not null default now();
update public.groups
set invite_code = encode(gen_random_bytes(10), 'hex')
where invite_code is null or btrim(invite_code) = '';
alter table public.groups alter column invite_code set default encode(gen_random_bytes(10), 'hex');
alter table public.groups alter column invite_code set not null;
create unique index if not exists groups_invite_code_uidx on public.groups(invite_code);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  can_send_messages boolean not null default true,
  muted_until timestamptz,
  added_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.group_members add column if not exists can_send_messages boolean not null default true;
alter table public.group_members add column if not exists muted_until timestamptz;
alter table public.group_members add column if not exists added_by uuid references public.profiles(id) on delete set null;
alter table public.group_members add column if not exists joined_at timestamptz not null default now();
update public.group_members set role = 'member'
where role not in ('owner', 'admin', 'moderator', 'member');
update public.group_members gm
set role = 'owner'
from public.groups g
where g.id = gm.group_id and g.created_by = gm.user_id;
alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check
  check (role in ('owner', 'admin', 'moderator', 'member'));
create unique index if not exists group_members_group_user_uidx
  on public.group_members(group_id, user_id);
create index if not exists group_members_user_idx on public.group_members(user_id, joined_at desc);

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id),
  check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_url text,
  storage_bucket text,
  storage_path text,
  media_type text,
  file_name text,
  file_size integer,
  reply_to_id uuid references public.group_messages(id) on delete set null,
  is_pinned boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(content) <> '' or media_url is not null or storage_path is not null)
);

alter table public.group_messages add column if not exists media_url text;
alter table public.group_messages add column if not exists storage_bucket text;
alter table public.group_messages add column if not exists storage_path text;
alter table public.group_messages add column if not exists media_type text;
alter table public.group_messages add column if not exists file_name text;
alter table public.group_messages add column if not exists file_size integer;
alter table public.group_messages add column if not exists reply_to_id uuid references public.group_messages(id) on delete set null;
alter table public.group_messages add column if not exists is_pinned boolean not null default false;
alter table public.group_messages add column if not exists edited_at timestamptz;
alter table public.group_messages add column if not exists deleted_at timestamptz;
alter table public.group_messages add column if not exists updated_at timestamptz not null default now();
alter table public.group_messages alter column content set default '';
create index if not exists group_messages_group_created_idx
  on public.group_messages(group_id, created_at desc) where deleted_at is null;

create table if not exists public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_group_member(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$$;

create or replace function public.is_group_admin(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role in ('owner', 'admin', 'moderator')
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
revoke all on function public.is_group_admin(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_admin(uuid, uuid) to authenticated;

create or replace function public.add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role, added_by)
  values (new.id, new.created_by, 'owner', new.created_by)
  on conflict (group_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create or replace function public.recount_group_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group uuid := coalesce(new.group_id, old.group_id);
begin
  update public.groups g
  set member_count = (
    select count(*)::integer from public.group_members gm
    where gm.group_id = target_group
  )
  where g.id = target_group;
  return null;
end;
$$;

create or replace function public.recount_group_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group uuid := coalesce(new.group_id, old.group_id);
begin
  update public.groups g
  set post_count = (
    select count(*)::integer from public.group_posts gp
    where gp.group_id = target_group and gp.status = 'active'
  )
  where g.id = target_group;
  return null;
end;
$$;

create or replace function public.touch_group_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.groups set updated_at = now() where id = new.group_id;
  return new;
end;
$$;

create or replace function public.protect_group_owner_fields()
returns trigger
language plpgsql
as $$
begin
  if new.created_by <> old.created_by then
    raise exception 'Group ownership cannot be changed from this client';
  end if;
  if new.invite_code <> old.invite_code then
    raise exception 'Invite code cannot be changed from this client';
  end if;
  return new;
end;
$$;

drop trigger if exists add_creator_as_admin on public.groups;
drop trigger if exists add_group_owner_trigger on public.groups;
create trigger add_group_owner_trigger
after insert on public.groups
for each row execute function public.add_group_owner();

drop trigger if exists update_groups_member_count on public.group_members;
drop trigger if exists recount_group_members_trigger on public.group_members;
create trigger recount_group_members_trigger
after insert or delete on public.group_members
for each row execute function public.recount_group_members();

drop trigger if exists recount_group_posts_trigger on public.group_posts;
create trigger recount_group_posts_trigger
after insert or delete or update of status on public.group_posts
for each row execute function public.recount_group_posts();

drop trigger if exists touch_group_from_message_trigger on public.group_messages;
create trigger touch_group_from_message_trigger
after insert on public.group_messages
for each row execute function public.touch_group_from_message();

drop trigger if exists set_groups_updated_at on public.groups;
drop trigger if exists protect_group_owner_fields_trigger on public.groups;
create trigger protect_group_owner_fields_trigger before update on public.groups
for each row execute function public.protect_group_owner_fields();
create trigger set_groups_updated_at before update on public.groups
for each row execute function public.set_updated_at();
drop trigger if exists set_group_join_requests_updated_at on public.group_join_requests;
create trigger set_group_join_requests_updated_at before update on public.group_join_requests
for each row execute function public.set_updated_at();
drop trigger if exists set_group_messages_updated_at on public.group_messages;
create trigger set_group_messages_updated_at before update on public.group_messages
for each row execute function public.set_updated_at();
drop trigger if exists set_group_posts_updated_at on public.group_posts;
create trigger set_group_posts_updated_at before update on public.group_posts
for each row execute function public.set_updated_at();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_posts enable row level security;

drop policy if exists "Anyone can view public groups" on public.groups;
drop policy if exists "Authenticated users can view groups" on public.groups;
create policy "Authenticated users can view groups"
on public.groups for select to authenticated using (true);
drop policy if exists "Authenticated users can create groups" on public.groups;
create policy "Users can create owned groups"
on public.groups for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "Group admins can update groups" on public.groups;
create policy "Group admins can update groups"
on public.groups for update to authenticated
using (public.is_group_admin(id))
with check (public.is_group_admin(id));
drop policy if exists "Group creators can delete groups" on public.groups;
create policy "Group owners can delete groups"
on public.groups for delete to authenticated using (auth.uid() = created_by);

drop policy if exists "Members can view group members" on public.group_members;
create policy "Members can view group members"
on public.group_members for select to authenticated
using (public.is_group_member(group_id));
drop policy if exists "Users can join groups" on public.group_members;
create policy "Public nonpremium groups allow self join"
on public.group_members for insert to authenticated
with check (
  auth.uid() = user_id and role = 'member' and exists (
    select 1 from public.groups g where g.id = group_id
      and not g.is_private and not g.is_premium and not g.requires_subscription
  )
);
drop policy if exists "Admins can manage members" on public.group_members;
create policy "Members can leave and admins can remove"
on public.group_members for delete to authenticated
using (
  (auth.uid() = user_id and role <> 'owner')
  or (public.is_group_admin(group_id) and role <> 'owner')
);
drop policy if exists "Admins can update member roles" on public.group_members;
create policy "Owners and admins can update nonowner members"
on public.group_members for update to authenticated
using (public.is_group_admin(group_id) and role <> 'owner')
with check (public.is_group_admin(group_id) and role in ('admin', 'moderator', 'member'));

drop policy if exists "Users can view their own requests" on public.group_join_requests;
drop policy if exists "Admins can view group requests" on public.group_join_requests;
create policy "Users and admins can view join requests"
on public.group_join_requests for select to authenticated
using (auth.uid() = user_id or public.is_group_admin(group_id));
drop policy if exists "Users can create join requests" on public.group_join_requests;
create policy "Users can request private group membership"
on public.group_join_requests for insert to authenticated
with check (
  auth.uid() = user_id and status = 'pending' and exists (
    select 1 from public.groups g where g.id = group_id and g.is_private
  ) and not public.is_group_member(group_id)
);
drop policy if exists "Admins can update requests" on public.group_join_requests;
create policy "Admins can review join requests"
on public.group_join_requests for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

create policy "Members can read group messages"
on public.group_messages for select to authenticated
using (public.is_group_member(group_id));
create policy "Members can send group messages"
on public.group_messages for insert to authenticated
with check (
  auth.uid() = sender_id and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_messages.group_id
      and gm.user_id = auth.uid()
      and gm.can_send_messages
      and (gm.muted_until is null or gm.muted_until <= now())
  )
);
create policy "Authors and admins can update group messages"
on public.group_messages for update to authenticated
using (auth.uid() = sender_id or public.is_group_admin(group_id))
with check (auth.uid() = sender_id or public.is_group_admin(group_id));
create policy "Authors and admins can delete group messages"
on public.group_messages for delete to authenticated
using (auth.uid() = sender_id or public.is_group_admin(group_id));

create policy "Members can read group posts"
on public.group_posts for select to authenticated
using (public.is_group_member(group_id));
create policy "Members can create group posts"
on public.group_posts for insert to authenticated
with check (auth.uid() = user_id and public.is_group_member(group_id));
create policy "Authors and admins can update group posts"
on public.group_posts for update to authenticated
using (auth.uid() = user_id or public.is_group_admin(group_id))
with check (auth.uid() = user_id or public.is_group_admin(group_id));
create policy "Authors and admins can delete group posts"
on public.group_posts for delete to authenticated
using (auth.uid() = user_id or public.is_group_admin(group_id));

create or replace function public.join_group(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target public.groups;
  has_premium boolean;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into target from public.groups where id = p_group_id;
  if target.id is null then raise exception 'Group not found'; end if;
  if public.is_group_member(p_group_id, actor) then return 'joined'; end if;

  if target.is_premium or target.requires_subscription then
    select exists (
      select 1 from public.user_subscriptions us
      where us.user_id = actor and us.status = 'active'
        and (us.current_period_end is null or us.current_period_end > now())
    ) into has_premium;
    if not has_premium then raise exception 'An active premium subscription is required'; end if;
  end if;

  if target.is_private then
    insert into public.group_join_requests (group_id, user_id, status)
    values (p_group_id, actor, 'pending')
    on conflict (group_id, user_id) do update set status = 'pending', updated_at = now();
    return 'requested';
  end if;

  insert into public.group_members (group_id, user_id, role, added_by)
  values (p_group_id, actor, 'member', actor)
  on conflict (group_id, user_id) do nothing;
  return 'joined';
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'The owner must transfer ownership before leaving'; end if;
  delete from public.group_members where group_id = p_group_id and user_id = auth.uid();
end;
$$;

create or replace function public.join_group_via_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target public.groups;
  has_premium boolean;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into target from public.groups where invite_code = lower(btrim(p_invite_code));
  if target.id is null then raise exception 'Invite link is invalid'; end if;
  if target.is_premium or target.requires_subscription then
    select exists (
      select 1 from public.user_subscriptions us
      where us.user_id = actor and us.status = 'active'
        and (us.current_period_end is null or us.current_period_end > now())
    ) into has_premium;
    if not has_premium then raise exception 'An active premium subscription is required'; end if;
  end if;
  insert into public.group_members (group_id, user_id, role, added_by)
  values (target.id, actor, 'member', target.created_by)
  on conflict (group_id, user_id) do nothing;
  return target.id;
end;
$$;

revoke all on function public.join_group(uuid) from public;
revoke all on function public.leave_group(uuid) from public;
revoke all on function public.join_group_via_invite(text) from public;
grant execute on function public.join_group(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.join_group_via_invite(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-media',
  'group-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can read group media" on storage.objects;
create policy "Members can read group media"
on storage.objects for select to authenticated
using (
  bucket_id = 'group-media'
  and public.is_group_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "Members can upload group media" on storage.objects;
create policy "Members can upload group media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'group-media'
  and public.is_group_member(((storage.foldername(name))[1])::uuid)
  and auth.uid()::text = (storage.foldername(name))[2]
);
drop policy if exists "Members can remove own group media" on storage.objects;
create policy "Members can remove own group media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'group-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['groups', 'group_members', 'group_messages', 'group_join_requests', 'group_posts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.group_join_requests to authenticated;
grant select, insert, update, delete on public.group_messages to authenticated;
grant select, insert, update, delete on public.group_posts to authenticated;

notify pgrst, 'reload schema';
