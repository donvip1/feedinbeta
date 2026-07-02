-- Realtime for 1:1 call signaling + ring (Phase 9 WebRTC calling).
--
-- The native call feature exchanges WebRTC SDP offers/answers and ICE
-- candidates as rows in `call_signals`, and detects incoming calls / status
-- changes from `call_logs`. Both tables existed (20260624000600) with RLS but
-- were NOT in the `supabase_realtime` publication, so the client fell back to
-- polling. Adding them enables push-speed signaling (required for WebRTC to
-- connect promptly) and instant ring.
--
-- RLS already restricts both tables to the two call participants, so realtime
-- respects those policies (Supabase realtime enforces RLS on broadcasted rows).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'call_signals'
    ) then
      alter publication supabase_realtime add table public.call_signals;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'call_logs'
    ) then
      alter publication supabase_realtime add table public.call_logs;
    end if;
  end if;
end
$$;

-- Ensure UPDATE/DELETE realtime payloads carry enough identity for client-side
-- filtering (REPLICA IDENTITY FULL emits old-row values on changes). call_logs
-- status transitions (answered/ended) are UPDATEs the callee must react to.
alter table public.call_logs replica identity full;
alter table public.call_signals replica identity full;
