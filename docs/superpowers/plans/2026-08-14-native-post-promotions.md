# Native Post Promotions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users promote any eligible public post through a remotely managed Plans, Targeting, Preview, and Confirm flow, with atomic campaign funding and ranked feed delivery.

**Architecture:** Add remote promotion plans and immutable campaign snapshots to Supabase, then expose one idempotent funding RPC. Flutter uses a typed repository and a native step flow opened from post actions. Feed-engine consumes eligible campaign signals; Flutter only renders the server-provided promoted disclosure.

**Tech Stack:** PostgreSQL/Supabase PL/pgSQL and RLS, existing credit ledger, Flutter, Riverpod, feed-engine Edge Function, Flutter and SQL tests.

---

### Task 1: Add remote plans and atomic campaign funding

**Files:**
- Create: `supabase/migrations/20260814192000_native_post_promotions.sql`
- Create: `supabase/tests/native_post_promotions.sql`

- [ ] **Step 1: Write failing SQL tests**

Cover active plan reads, promoting the caller's post, promoting another creator's public post, private/deleted/blocked rejection, insufficient credits, stale plan version, idempotent retry, exact ledger mutation, and RLS.

- [ ] **Step 2: Run and verify failure**

Run: `npx supabase test db supabase/tests/native_post_promotions.sql`

Expected: FAIL because promotion contracts do not exist.

- [ ] **Step 3: Create remotely managed plans**

```sql
create table public.promotion_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  credit_cost integer not null check (credit_cost > 0),
  duration_hours integer not null check (duration_hours > 0),
  estimated_reach_min integer not null,
  estimated_reach_max integer not null,
  targeting_capabilities jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Seed the existing web product's plan ladder exactly, while making the server
authoritative for subsequent changes:

```sql
values
  ('starter', 'Starter Boost', 25, 12, 500, 750, 10),
  ('basic', 'Basic Boost', 50, 24, 1500, 2250, 20),
  ('pro', 'Pro Boost', 100, 72, 5000, 7500, 30),
  ('premium', 'Premium Boost', 200, 168, 15000, 22500, 40),
  ('elite', 'Elite Campaign', 500, 336, 50000, 75000, 50)
```

Store the web feature labels in plan metadata. All plans allow automatic or
global targeting; Pro, Premium, and Elite additionally allow age and interest
targeting. Location targeting is enabled for Premium and Elite.

- [ ] **Step 4: Create immutable campaign snapshots**

Create `post_promotion_campaigns` with promoter, creator, post, plan ID/version, credit cost, targeting snapshot, estimate snapshot, start/end, state, remaining budget, impression/reach/engagement counters, idempotency key, ledger ID, moderation fields, and terminal reason.

- [ ] **Step 5: Implement `promote_post`**

```sql
create or replace function public.promote_post(
  p_post_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_targeting jsonb,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = '';
```

Validate the authenticated actor, current active plan/version, public active post, block/moderation rules, targeting schema, and balance. Lock funds, create one campaign and ledger event, and return the canonical campaign snapshot.

- [ ] **Step 6: Add RLS and pass tests**

Publicly expose active plan reads. Permit promoters and post creators to read relevant campaign summaries; reserve mutation for the RPC and service role.

Run: `npx supabase test db supabase/tests/native_post_promotions.sql`

Expected: PASS.

- [ ] **Step 7: Commit promotion backend**

```bash
git add supabase/migrations/20260814192000_native_post_promotions.sql supabase/tests/native_post_promotions.sql
git commit -m "feat(db): add post promotion campaigns"
```

### Task 2: Integrate campaigns with feed ranking

**Files:**
- Modify: `supabase/functions/feed-engine/index.ts`
- Create: `supabase/functions/feed-engine/promotion-ranking.ts`
- Modify: `supabase/functions/feed-engine/index.test.ts`

- [ ] **Step 1: Write failing ranking tests**

Assert that only active, in-window, funded, target-matching campaigns are eligible; frequency caps and pacing prevent permanent pinning; promoted metadata includes disclosure and campaign ID; organic ordering remains when no campaign qualifies.

- [ ] **Step 2: Run and verify failure**

Run the feed-engine test command documented in the function package.

Expected: FAIL because campaign ranking is absent.

- [ ] **Step 3: Implement isolated promotion ranking**

```ts
export function promotionScore(input: PromotionCandidate): number {
  if (!input.active || !input.targetMatches || input.frequencyCapped) return 0;
  return input.planWeight * input.pacingFactor * input.qualityFactor;
}
```

Keep campaign selection separate from organic scoring. Merge eligible promoted candidates at bounded intervals and return `is_promoted`, `promotion_campaign_id`, and disclosure fields.

- [ ] **Step 4: Record delivery atomically**

Use the existing service-role function boundary to increment impressions/reach with deduplication and decrement campaign budget/pacing counters. Never let the Flutter client write delivery metrics directly.

- [ ] **Step 5: Verify and commit ranking**

Run feed-engine tests and local function smoke checks.

```bash
git add supabase/functions/feed-engine
git commit -m "feat(feed): rank promoted campaigns"
```

### Task 3: Add Flutter promotion models and repository

**Files:**
- Create: `native/flutter/lib/src/features/promotions/data/promotion_models.dart`
- Create: `native/flutter/lib/src/features/promotions/data/promotion_remote_data_source.dart`
- Create: `native/flutter/lib/src/features/promotions/data/promotion_repository.dart`
- Create: `native/flutter/test/promotion_models_test.dart`
- Create: `native/flutter/test/promotion_remote_data_source_test.dart`

- [ ] **Step 1: Write failing tests**

Cover plan parsing, targeting capabilities, reach ranges, plan version conflicts, eligibility errors, insufficient credits, and idempotency reconciliation.

- [ ] **Step 2: Run and verify failure**

Run: `flutter test test/promotion_models_test.dart test/promotion_remote_data_source_test.dart`

Expected: FAIL because the promotion domain does not exist.

- [ ] **Step 3: Implement typed contracts**

```dart
class PromotionPlan {
  const PromotionPlan({
    required this.id,
    required this.version,
    required this.name,
    required this.creditCost,
    required this.duration,
    required this.estimatedReach,
    required this.capabilities,
  });
}
```

Define immutable targeting, preview, campaign, and sealed failure models. Flutter submits plan ID/version, targeting, post ID, and one idempotency key; it never submits trusted price/duration/reach.

- [ ] **Step 4: Implement and verify remote calls**

Fetch active plans and invoke `promote_post`. Map stable server error codes to user actions.

Run: `flutter test test/promotion_models_test.dart test/promotion_remote_data_source_test.dart`

Run: `flutter analyze lib/src/features/promotions`

- [ ] **Step 5: Commit promotion data layer**

```bash
git add native/flutter/lib/src/features/promotions native/flutter/test/promotion_models_test.dart native/flutter/test/promotion_remote_data_source_test.dart
git commit -m "feat(promotions): add campaign repository"
```

### Task 4: Build Plans, Targeting, Preview, and Confirm UI

**Files:**
- Create: `native/flutter/lib/src/features/promotions/presentation/promote_post_flow.dart`
- Create: `native/flutter/lib/src/features/promotions/presentation/promotion_plan_step.dart`
- Create: `native/flutter/lib/src/features/promotions/presentation/promotion_targeting_step.dart`
- Create: `native/flutter/lib/src/features/promotions/presentation/promotion_preview_step.dart`
- Create: `native/flutter/lib/src/features/promotions/presentation/promotion_confirm_step.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_post_pager_screen.dart`
- Create: `native/flutter/test/promote_post_flow_test.dart`

- [ ] **Step 1: Write failing flow tests**

Assert remote plans, selection persistence, capability-driven targeting fields, real post preview, Promoted disclosure, summary totals, confirm busy state, stale-version forced review, successful campaign result, and promotion of another creator's eligible post.

- [ ] **Step 2: Run and verify failure**

Run: `flutter test test/promote_post_flow_test.dart`

Expected: FAIL because the native flow does not exist.

- [ ] **Step 3: Implement one stateful route with four keyed steps**

```dart
enum PromotionStep { plans, targeting, preview, confirm }
```

Use a quiet neutral-dark layout, compact progress indicator, back navigation that preserves state, remote reach/price values, and a full post preview. The route returns `PromotionCreated(campaignId)` once.

- [ ] **Step 4: Add Promote to post actions**

Expose Promote in the overflow menu for eligible public posts regardless of ownership. Keep Delete/Edit owner-only. Pass the selected post and repository into `PromotePostFlow`.

- [ ] **Step 5: Render disclosure from feed data**

Use the existing `isPromoted` flag plus server disclosure metadata in the author/header region. Do not infer promotion locally from the user opening the flow.

- [ ] **Step 6: Verify and commit UI**

Run: `flutter test test/promote_post_flow_test.dart test/feed_creator_header_test.dart`

```bash
git add native/flutter/lib/src/features/promotions native/flutter/lib/src/features/feed/feed_shell.dart native/flutter/lib/src/features/feed/feed_post_pager_screen.dart native/flutter/test/promote_post_flow_test.dart
git commit -m "feat(promotions): add native promote flow"
```

### Task 5: Deploy, build, and device-test promotions

**Files:**
- No product files beyond fixes discovered by verification.

- [ ] **Step 1: Run integrated verification**

Run: `flutter analyze`

Run: `flutter test`

Run the Supabase SQL tests and feed-engine tests.

Expected: all pass.

- [ ] **Step 2: Deploy in dependency order**

Deploy the promotion migration first, then feed-engine. Confirm the linked Supabase project before applying either change.

- [ ] **Step 3: Build and install the live signed APK**

Increment Flutter build metadata, build with live Supabase dart defines, verify signature/package/version, and update the attached device with the exact APK.

- [ ] **Step 4: Run device acceptance checks**

Promote the viewer's public post and another creator's public post; verify private-post rejection, stale-plan review, insufficient credits, successful campaign creation, promoted disclosure, and ranked delivery. Capture foreground and screen evidence without exposing credentials or signed URLs.
