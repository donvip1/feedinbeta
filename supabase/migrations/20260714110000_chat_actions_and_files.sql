-- Starred messages, participant-scoped message reports, and generic files.
--
-- Generic files continue to use public.message_attachments and the private
-- message-media bucket. This migration only extends that bucket's MIME allowlist.

-- ---------------------------------------------------------------------------
-- Private per-user message stars
-- ---------------------------------------------------------------------------
create table if not exists public.message_stars (
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_stars_user_conversation_idx
  on public.message_stars(user_id, conversation_id, created_at desc);

alter table public.message_stars enable row level security;

drop policy if exists "Users can read own message stars" on public.message_stars;
create policy "Users can read own message stars"
  on public.message_stars for select
  using (
    auth.uid() = user_id
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "Users can create own message stars" on public.message_stars;
create policy "Users can create own message stars"
  on public.message_stars for insert
  with check (
    auth.uid() = user_id
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1
      from public.messages m
      where m.id = message_id
        and m.conversation_id = conversation_id
        and m.deleted_at is null
    )
  );

drop policy if exists "Users can remove own message stars" on public.message_stars;
create policy "Users can remove own message stars"
  on public.message_stars for delete
  using (auth.uid() = user_id);

create or replace function public.toggle_message_star(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_conversation_id uuid;
begin
  if viewer_id is null then
    raise exception 'not authenticated';
  end if;

  select m.conversation_id
    into target_conversation_id
    from public.messages m
    where m.id = p_message_id
      and m.deleted_at is null;

  if target_conversation_id is null then
    raise exception 'message not found';
  end if;
  if not public.is_conversation_participant(target_conversation_id) then
    raise exception 'not a conversation participant';
  end if;

  delete from public.message_stars s
    where s.message_id = p_message_id
      and s.user_id = viewer_id;
  if found then
    return false;
  end if;

  insert into public.message_stars (
    message_id,
    conversation_id,
    user_id
  )
  values (
    p_message_id,
    target_conversation_id,
    viewer_id
  )
  on conflict (message_id, user_id) do nothing;

  return true;
end;
$$;

create or replace function public.get_starred_message_ids(
  p_conversation_id uuid
)
returns table (message_id uuid)
language plpgsql
stable
security definer
set search_path = ''
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

  return query
    select s.message_id
    from public.message_stars s
    join public.messages m on m.id = s.message_id
    where s.user_id = viewer_id
      and s.conversation_id = p_conversation_id
      and m.deleted_at is null
    order by s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared moderation report contract + message-scoped RPC
-- ---------------------------------------------------------------------------
-- The web app already uses content_reports. Recreate that shared table for
-- fresh native projects instead of introducing a message-only report store.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  content_type text not null
    check (
      content_type in (
        'post',
        'comment',
        'message',
        'story',
        'live_stream',
        'profile'
      )
    ),
  content_id uuid not null,
  reason text not null,
  description text,
  status text default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

-- Older web migrations omitted "scam" even though the message report UI sends
-- it. Keep the shared contract compatible with both web and native clients.
alter table public.content_reports
  drop constraint if exists content_reports_reason_check;
alter table public.content_reports
  add constraint content_reports_reason_check
  check (
    reason in (
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'scam',
      'misinformation',
      'copyright',
      'other'
    )
  );

create index if not exists idx_content_reports_status
  on public.content_reports(status);
create index if not exists idx_content_reports_reporter
  on public.content_reports(reporter_id);
create index if not exists content_reports_message_lookup_idx
  on public.content_reports(content_id, reporter_id, status)
  where content_type = 'message';

alter table public.content_reports enable row level security;

drop policy if exists "Users can create reports" on public.content_reports;
create policy "Users can create reports"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own reports" on public.content_reports;
create policy "Users can view their own reports"
  on public.content_reports for select
  using (auth.uid() = reporter_id);

create or replace function public.report_message(
  p_message_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_conversation_id uuid;
  target_sender_id uuid;
  normalized_reason text := lower(btrim(coalesce(p_reason, '')));
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  report_id uuid;
begin
  if viewer_id is null then
    raise exception 'not authenticated';
  end if;
  if normalized_reason not in (
    'spam',
    'harassment',
    'hate_speech',
    'violence',
    'nudity',
    'scam',
    'misinformation',
    'copyright',
    'other'
  ) then
    raise exception 'invalid report reason';
  end if;
  if char_length(coalesce(normalized_description, '')) > 2000 then
    raise exception 'report description is too long';
  end if;

  select m.conversation_id, m.sender_id
    into target_conversation_id, target_sender_id
    from public.messages m
    where m.id = p_message_id;

  if target_conversation_id is null then
    raise exception 'message not found';
  end if;
  if not public.is_conversation_participant(target_conversation_id) then
    raise exception 'not a conversation participant';
  end if;
  if target_sender_id = viewer_id then
    raise exception 'cannot report your own message';
  end if;

  -- Treat repeated taps as idempotent while moderation is still in progress.
  select r.id
    into report_id
    from public.content_reports r
    where r.reporter_id = viewer_id
      and r.content_type = 'message'
      and r.content_id = p_message_id
      and r.status in ('pending', 'reviewing')
    order by r.created_at desc
    limit 1;

  if report_id is not null then
    return report_id;
  end if;

  insert into public.content_reports (
    reporter_id,
    reported_user_id,
    content_type,
    content_id,
    reason,
    description,
    status
  )
  values (
    viewer_id,
    target_sender_id,
    'message',
    p_message_id,
    normalized_reason,
    normalized_description,
    'pending'
  )
  returning id into report_id;

  return report_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic files in the existing message attachment bucket
-- ---------------------------------------------------------------------------
update storage.buckets b
set
  file_size_limit = 52428800,
  allowed_mime_types = (
    select array_agg(allowed.mime_type order by allowed.mime_type)
    from (
      select distinct mime_type
      from unnest(
        coalesce(b.allowed_mime_types, array[]::text[])
        || array[
          'text/plain',
          'text/csv',
          'application/rtf',
          'application/json',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/zip'
        ]::text[]
      ) as expanded(mime_type)
      where mime_type is not null
    ) as allowed
  )
where b.id = 'message-media';

-- ---------------------------------------------------------------------------
-- Privileges and API schema refresh
-- ---------------------------------------------------------------------------
revoke all on table public.message_stars from anon;
revoke all on table public.message_stars from authenticated;

grant select, insert on table public.content_reports to authenticated;

revoke all on function public.toggle_message_star(uuid) from public;
revoke all on function public.toggle_message_star(uuid) from anon;
grant execute on function public.toggle_message_star(uuid)
  to authenticated, service_role;

revoke all on function public.get_starred_message_ids(uuid) from public;
revoke all on function public.get_starred_message_ids(uuid) from anon;
grant execute on function public.get_starred_message_ids(uuid)
  to authenticated, service_role;

revoke all on function public.report_message(uuid, text, text) from public;
revoke all on function public.report_message(uuid, text, text) from anon;
grant execute on function public.report_message(uuid, text, text)
  to authenticated, service_role;

comment on function public.toggle_message_star(uuid) is
  'Toggles the authenticated user''s private star for a conversation message.';
comment on function public.get_starred_message_ids(uuid) is
  'Returns the authenticated user''s starred message ids in one conversation.';
comment on function public.report_message(uuid, text, text) is
  'Creates an idempotent participant-scoped moderation report for a message.';

notify pgrst, 'reload schema';
