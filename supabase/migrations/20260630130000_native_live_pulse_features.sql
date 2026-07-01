-- Native live PULSE host cards + group-scoped streams (plan.md Part 1 + §E).
--
-- The native live viewer lets a host publish "PULSE" spotlight cards
-- (emoji + title + body + optional link), persisted as a JSON array under
-- `live_streams.stream_features.host_cards` — mirroring the web
-- `stream-v2/AICatchUpPanel.tsx` HostCard shape so the same JSON round-trips.
--
-- The base `live_streams` table (20260624000100) has no JSON feature bag, so
-- host-card reads/writes were best-effort no-ops. This adds the column. Writes
-- are already covered by the existing host UPDATE RLS policy
-- ("Users can update own live streams" = auth.uid() = user_id), so no new
-- policy is required.

alter table public.live_streams
  add column if not exists stream_features jsonb not null default '{}'::jsonb,
  -- Forward-looking: lets a future broadcast backend scope a stream to a group
  -- conversation (the native "Go Live from group" flow carries this id). Nulls
  -- for ordinary global streams. Not read by the client yet; additive + cheap.
  add column if not exists group_conversation_id uuid
    references public.conversations(id) on delete set null;

create index if not exists live_streams_group_conversation_idx
  on public.live_streams(group_conversation_id)
  where group_conversation_id is not null;
