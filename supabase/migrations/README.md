# feedIn Native Migrations

This folder is the active migration set for the Flutter native rebuild.

The old Lovable-generated migration files were moved to:

```text
supabase/migrations_archive_lovable/
```

Use these active migrations for a fresh Supabase project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Current active migrations:

1. `20260624000100_native_core_schema.sql` - profiles, feed, messaging, live discovery tables.
2. `20260624000200_native_rls_policies.sql` - mobile-safe row-level security policies.
3. `20260624000300_native_views_and_rpcs.sql` - public profile search and chat RPCs.
4. `20260624000400_native_storage_and_realtime.sql` - `post-media` storage and realtime tables.
5. `20260624000500_native_money_p2p_schema.sql` - credits, payments, monetization, payouts, and P2P marketplace.
6. `20260624000600_native_advanced_live_calls_schema.sql` - advanced live streams/spaces, gifts, calls, and group calls.
7. `20260624000700_native_extended_rls_policies.sql` - RLS policies for monetization, P2P, live, gifts, and calls.
8. `20260624000800_posts_privacy_rls.sql` - `posts.privacy` with conservative privacy-aware post read RLS.

FeedAI and FeedIn Learn schemas are intentionally not part of this active baseline for the first native release.
