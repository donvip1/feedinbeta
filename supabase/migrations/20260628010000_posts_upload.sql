-- feedIn native: posts/stories upload pipeline reconciliation.
--
-- Purpose: guarantee that every column the native upload queue
-- (lib/src/core/sync/upload_queue_service.dart) inserts actually exists on the
-- live `posts` and `stories` tables, and force PostgREST to reload its schema
-- cache. The original failure ("Could not find the 'privacy' column ... in the
-- schema cache") was a stale PostgREST cache after privacy/stories columns were
-- added in earlier migrations that never issued `notify pgrst, 'reload schema'`.
--
-- This migration is strictly additive and idempotent: it only uses
-- `add column if not exists` and never drops or recreates a table. Earlier
-- migrations (20260624000800_posts_privacy_rls.sql,
-- 20260624000900_native_stories_schema.sql,
-- 20260624000400_native_storage_and_realtime.sql) already create the privacy
-- column, the stories table + RLS, and the post-media bucket + RLS; this file
-- only backfills anything the live DB might still be missing and reloads the
-- cache.

-- ---------------------------------------------------------------------------
-- posts: columns the native post insert writes
--   user_id, content, media_url, media_type, media_urls, media_types,
--   privacy, post_type, status, location
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists content text;

alter table public.posts
  add column if not exists media_url text;

alter table public.posts
  add column if not exists media_type text;

alter table public.posts
  add column if not exists media_urls text[] not null default '{}';

alter table public.posts
  add column if not exists media_types text[] not null default '{}';

alter table public.posts
  add column if not exists location text;

alter table public.posts
  add column if not exists post_type text not null default 'post';

alter table public.posts
  add column if not exists status text not null default 'active';

-- privacy: created with a privacy-aware default in
-- 20260624000800_posts_privacy_rls.sql. Re-assert it idempotently so an
-- out-of-sync live DB still gets the column the app inserts. Keep it nullable
-- here to avoid failing on pre-existing NULL rows; the prior migration is the
-- source of truth for the NOT NULL + CHECK constraint.
alter table public.posts
  add column if not exists privacy text default 'everyone';

-- ---------------------------------------------------------------------------
-- stories: columns the native story insert writes
--   user_id, media_url, media_type, caption
-- The stories table (and caption column) is created in
-- 20260624000900_native_stories_schema.sql. Re-assert the caption column
-- idempotently in case the live DB predates that migration.
-- ---------------------------------------------------------------------------
alter table public.stories
  add column if not exists caption text;

-- ---------------------------------------------------------------------------
-- Reload the PostgREST schema cache so the columns above are immediately
-- visible to the REST API used by the Flutter client. This is the direct fix
-- for the "Could not find the '<column>' column ... in the schema cache" error.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
