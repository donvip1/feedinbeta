-- feedIn native parity: message attachments, receipts, presence, and call entry contracts.

alter table public.messages
add column if not exists is_read boolean not null default false,
add column if not exists delivered_at timestamptz,
add column if not exists read_at timestamptz,
add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.messages
set delivered_at = coalesce(delivered_at, created_at)
where delivered_at is null
  and status in ('sent', 'delivered', 'read');

update public.messages
set is_read = true,
    read_at = coalesce(read_at, updated_at, created_at),
    status = 'read'
where status = 'read'
  and is_read = false;

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'message-media',
  storage_path text not null,
  public_url text,
  file_name text,
  file_size_bytes bigint,
  mime_type text,
  media_type text not null default 'file',
  thumbnail_url text,
  duration_ms integer,
  downloaded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_message_idx
on public.message_attachments(message_id);

create index if not exists message_attachments_conversation_idx
on public.message_attachments(conversation_id, created_at desc);

alter table public.message_attachments enable row level security;

drop policy if exists "Participants can read message attachments" on public.message_attachments;
create policy "Participants can read message attachments"
on public.message_attachments for select
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Senders can create message attachments" on public.message_attachments;
create policy "Senders can create message attachments"
on public.message_attachments for insert
with check (
  auth.uid() = sender_id
  and public.is_conversation_participant(conversation_id)
);

drop policy if exists "Participants can update message attachment download state" on public.message_attachments;
create policy "Participants can update message attachment download state"
on public.message_attachments for update
using (public.is_conversation_participant(conversation_id));

create table if not exists public.message_read_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_read_receipts_conversation_idx
on public.message_read_receipts(conversation_id, read_at desc);

alter table public.message_read_receipts enable row level security;

drop policy if exists "Participants can read message receipts" on public.message_read_receipts;
create policy "Participants can read message receipts"
on public.message_read_receipts for select
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants can write own message receipts" on public.message_read_receipts;
create policy "Participants can write own message receipts"
on public.message_read_receipts for insert
with check (
  auth.uid() = user_id
  and public.is_conversation_participant(conversation_id)
);

create table if not exists public.typing_indicators (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null default 'typing',
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.typing_indicators enable row level security;

drop policy if exists "Participants can read typing indicators" on public.typing_indicators;
create policy "Participants can read typing indicators"
on public.typing_indicators for select
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants can upsert own typing indicators" on public.typing_indicators;
create policy "Participants can upsert own typing indicators"
on public.typing_indicators for insert
with check (
  auth.uid() = user_id
  and public.is_conversation_participant(conversation_id)
);

drop policy if exists "Participants can update own typing indicators" on public.typing_indicators;
create policy "Participants can update own typing indicators"
on public.typing_indicators for update
using (
  auth.uid() = user_id
  and public.is_conversation_participant(conversation_id)
)
with check (
  auth.uid() = user_id
  and public.is_conversation_participant(conversation_id)
);

create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'offline'
    check (status in ('online', 'active_now', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

drop policy if exists "Presence is readable to authenticated users" on public.user_presence;
create policy "Presence is readable to authenticated users"
on public.user_presence for select
using (auth.uid() is not null);

drop policy if exists "Users can insert own presence" on public.user_presence;
create policy "Users can insert own presence"
on public.user_presence for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own presence" on public.user_presence;
create policy "Users can update own presence"
on public.user_presence for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Recipients can mark received messages read" on public.messages;
create policy "Recipients can mark received messages read"
on public.messages for update
using (
  public.is_conversation_participant(conversation_id)
  and sender_id <> auth.uid()
)
with check (
  public.is_conversation_participant(conversation_id)
  and sender_id <> auth.uid()
);

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a conversation participant';
  end if;

  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = viewer_id;

  insert into public.message_read_receipts (message_id, user_id, conversation_id, read_at)
  select id, viewer_id, conversation_id, now()
  from public.messages
  where conversation_id = p_conversation_id
    and sender_id <> viewer_id
  on conflict (message_id, user_id)
  do update set read_at = excluded.read_at;

  update public.messages
  set is_read = true,
      read_at = coalesce(read_at, now()),
      status = 'read'
  where conversation_id = p_conversation_id
    and sender_id <> viewer_id
    and is_read = false;
end;
$$;

create or replace function public.set_typing_indicator(
  p_conversation_id uuid,
  p_activity text default 'typing'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.typing_indicators (conversation_id, user_id, activity, updated_at)
  values (p_conversation_id, auth.uid(), coalesce(nullif(p_activity, ''), 'typing'), now())
  on conflict (conversation_id, user_id)
  do update set activity = excluded.activity, updated_at = excluded.updated_at;
$$;

create or replace function public.update_presence(p_status text default 'online')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_presence (user_id, status, last_seen_at, updated_at)
  values (
    auth.uid(),
    case
      when p_status in ('online', 'active_now', 'away', 'offline') then p_status
      else 'online'
    end,
    now(),
    now()
  )
  on conflict (user_id)
  do update set
    status = excluded.status,
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at;
$$;

drop function if exists public.get_conversations_with_details(uuid);

create or replace function public.get_conversations_with_details(p_user_id uuid)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_username text,
  other_user_display_name text,
  other_user_avatar_url text,
  other_user_presence text,
  other_user_last_seen_at timestamptz,
  last_message_content text,
  last_message_created_at timestamptz,
  updated_at timestamptz,
  unread_count integer
)
language sql
security definer
set search_path = public
as $$
  with user_conversations as (
    select c.id, c.updated_at, cp.last_read_at
    from public.conversations c
    join public.conversation_participants cp
      on cp.conversation_id = c.id
    where cp.user_id = p_user_id
      and p_user_id = auth.uid()
  ),
  other_participants as (
    select
      uc.id as conversation_id,
      p.id as other_user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      up.status as presence_status,
      up.last_seen_at,
      uc.updated_at,
      uc.last_read_at
    from user_conversations uc
    join public.conversation_participants cp
      on cp.conversation_id = uc.id
     and cp.user_id <> p_user_id
    join public.profiles p
      on p.id = cp.user_id
    left join public.user_presence up
      on up.user_id = p.id
  ),
  last_messages as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at
    from public.messages m
    join user_conversations uc on uc.id = m.conversation_id
    order by m.conversation_id, m.created_at desc
  )
  select
    op.conversation_id,
    op.other_user_id,
    op.username as other_user_username,
    op.display_name as other_user_display_name,
    op.avatar_url as other_user_avatar_url,
    coalesce(op.presence_status, 'offline') as other_user_presence,
    op.last_seen_at as other_user_last_seen_at,
    lm.content as last_message_content,
    lm.created_at as last_message_created_at,
    coalesce(lm.created_at, op.updated_at) as updated_at,
    (
      select count(*)::integer
      from public.messages m
      where m.conversation_id = op.conversation_id
        and m.sender_id <> p_user_id
        and (
          op.last_read_at is null
          or m.created_at > op.last_read_at
        )
    ) as unread_count
  from other_participants op
  left join last_messages lm on lm.conversation_id = op.conversation_id
  order by coalesce(lm.created_at, op.updated_at) desc;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'audio/aac',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read message media" on storage.objects;
drop policy if exists "Participants can read message media" on storage.objects;
create policy "Participants can read message media"
on storage.objects for select
using (
  bucket_id = 'message-media'
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id::text = (storage.foldername(name))[1]
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can upload message media" on storage.objects;
create policy "Authenticated users can upload message media"
on storage.objects for insert
with check (
  bucket_id = 'message-media'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "Users can update own message media" on storage.objects;
create policy "Users can update own message media"
on storage.objects for update
using (
  bucket_id = 'message-media'
  and auth.uid()::text = (storage.foldername(name))[2]
)
with check (
  bucket_id = 'message-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "Users can delete own message media" on storage.objects;
create policy "Users can delete own message media"
on storage.objects for delete
using (
  bucket_id = 'message-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_attachments'
    ) then
      alter publication supabase_realtime add table public.message_attachments;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_read_receipts'
    ) then
      alter publication supabase_realtime add table public.message_read_receipts;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'typing_indicators'
    ) then
      alter publication supabase_realtime add table public.typing_indicators;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_presence'
    ) then
      alter publication supabase_realtime add table public.user_presence;
    end if;
  end if;
end $$;
