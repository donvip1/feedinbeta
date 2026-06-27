-- feedIn native baseline: advanced live rooms, spaces, gifts, and calls.

alter table public.live_streams
  add column if not exists description text,
  add column if not exists stream_key text,
  add column if not exists playback_url text,
  add column if not exists is_recording_enabled boolean not null default false,
  add column if not exists recording_url text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

alter table public.live_spaces
  add column if not exists description text,
  add column if not exists is_recording_enabled boolean not null default false,
  add column if not exists recording_url text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

create table if not exists public.live_stream_viewers (
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (stream_id, user_id)
);

create table if not exists public.live_stream_comments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_stream_reactions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_stream_chat_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.live_stream_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_stream_gifts (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid references public.live_streams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete set null,
  gift_type text not null,
  credit_value integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.live_stream_invites (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.live_stream_analytics (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  viewer_count integer not null default 0,
  peak_viewer_count integer not null default 0,
  comments_count integer not null default 0,
  gifts_count integer not null default 0,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.live_space_speakers (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.live_spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'speaker',
  status text not null default 'invited',
  muted boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create table if not exists public.live_space_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.live_spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  reply_to_id uuid references public.live_space_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_space_message_likes (
  message_id uuid not null references public.live_space_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.live_space_reactions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.live_spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.live_spaces(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.live_space_gifts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.live_spaces(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete set null,
  gift_type text not null,
  credit_value integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete set null,
  call_type text not null,
  status text not null default 'initiated',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  credits_deducted integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_participants (
  call_id uuid not null references public.call_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);

create table if not exists public.call_invites (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.call_logs(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  call_type text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_logs(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  signal_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.group_calls (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  call_type text not null default 'audio',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.group_call_participants (
  call_id uuid not null references public.group_calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'participant',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (call_id, user_id)
);

create table if not exists public.gift_appreciation_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  credit_value integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_analytics (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  receiver_id uuid references public.profiles(id) on delete set null,
  gift_type text not null,
  credit_value integer not null default 0,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists live_stream_comments_stream_created_idx on public.live_stream_comments(stream_id, created_at);
create index if not exists live_space_speakers_space_idx on public.live_space_speakers(space_id);
create index if not exists live_space_messages_space_created_idx on public.live_space_messages(space_id, created_at);
create index if not exists call_logs_caller_created_idx on public.call_logs(caller_id, created_at desc);
create index if not exists call_logs_receiver_created_idx on public.call_logs(receiver_id, created_at desc);

drop trigger if exists set_call_logs_updated_at on public.call_logs;
create trigger set_call_logs_updated_at
before update on public.call_logs
for each row execute function public.set_updated_at();

