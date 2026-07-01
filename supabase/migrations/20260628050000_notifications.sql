-- feedIn native notifications: idempotent reconcile of the existing
-- `public.notifications` table for the native app.
--
-- The notifications table already exists in the live DB: it originates in the
-- web-app archive (`migrations_archive_lovable/20251101121239_*.sql`) with
-- columns: id, user_id, type, title, message, related_id, related_type,
-- from_user_id, is_read, created_at — and was extended by the native contract
-- migration `20260627143200_native_notifications_contracts.sql` (action_type,
-- action_url, route, data, fcm_payload, read_at).
--
-- This migration is intentionally additive and safe to run repeatedly: it only
-- ensures the columns the native app reads exist, backfills nothing, and never
-- drops or recreates the table. It must NOT trip a schema-cache "missing
-- column" error, so it ends with a PostgREST schema reload.

-- 1. Ensure the table exists at all (no-op in the live DB; guards fresh DBs /
--    CI where only the archive baseline may be present). Shape matches the web
--    archive table exactly.
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  type text not null,
  title text not null,
  message text,
  related_id uuid,
  related_type text,
  from_user_id uuid,
  is_read boolean default false,
  created_at timestamptz not null default now()
);

-- 2. Add only the columns the native app reads, each guarded. These mirror the
--    native notifications contract; re-declaring them here keeps this migration
--    self-sufficient if applied against the archive baseline alone.
alter table public.notifications
  add column if not exists from_user_id uuid,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists related_id uuid,
  add column if not exists related_type text,
  add column if not exists action_type text,
  add column if not exists action_url text,
  add column if not exists route text,
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

-- 3. Helpful read indexes (idempotent). The native client orders by
--    (user_id, created_at desc) and filters unread.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- 4. RLS — enable + ensure owner-scoped policies exist. Matches the archive
--    patterns ("Users can view/update/delete their own notifications") and the
--    native contract. Each policy is dropped-then-created so re-runs are safe
--    and the predicate is guaranteed current.
alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (user_id = auth.uid());

-- INSERTs come from server-side triggers/functions (follows, likes, etc.); the
-- archive grants this broadly. Keep an authenticated-or-system insert policy so
-- the native app's trigger-generated notifications still land.
drop policy if exists "Authenticated users can create notifications" on public.notifications;
drop policy if exists "Users can create notifications for self" on public.notifications;
create policy "Users can create notifications for self"
  on public.notifications for insert
  with check (auth.uid() = user_id);

-- 5. Reload the PostgREST schema cache so the columns above are immediately
--    visible to the client (prevents the "missing column" schema-cache error).
notify pgrst, 'reload schema';
