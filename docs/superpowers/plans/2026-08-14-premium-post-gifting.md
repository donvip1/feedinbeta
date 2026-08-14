# Premium Post Gifting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the remotely managed 16-item premium gift marketplace, atomic 80/20 post-gift transactions, and native Idle, Preview, and Send playback without redirecting users to Wallet.

**Architecture:** Extend the existing `gift_catalog` additively so chat and post gifting share one server-owned catalog while retaining source-specific RPCs. Add an idempotent `send_post_gift` transaction backed by the credit ledger. Flutter uses a repository boundary, a draggable in-feed sheet, versioned asset caching, and a full-screen activation overlay.

**Tech Stack:** PostgreSQL/Supabase PL/pgSQL and RLS, Flutter, `cached_network_image`, `video_player`, `just_audio`, `flutter_cache_manager`, UUID idempotency keys, Blender-rendered WebP/MP4 assets.

---

### Task 1: Extend and seed the remote gift catalog

**Files:**
- Create: `supabase/migrations/20260814191000_premium_post_gifts.sql`
- Create: `supabase/tests/premium_post_gifts.sql`

- [ ] **Step 1: Write failing catalog and transaction tests**

Assert exactly 16 active `post` gifts with approved keys, tiers, prices, 80 recipient percent, unique display order, and nonempty poster/idle/preview/send metadata. Assert the legacy chat catalog remains readable.

- [ ] **Step 2: Run and observe failure**

Run: `npx supabase test db supabase/tests/premium_post_gifts.sql`

Expected: FAIL because the extended columns and post-gift RPC do not exist.

- [ ] **Step 3: Extend `gift_catalog` additively**

```sql
alter table public.gift_catalog
  add column if not exists tier text not null default 'basic',
  add column if not exists supported_sources text[] not null default array['chat'],
  add column if not exists poster_url text,
  add column if not exists idle_url text,
  add column if not exists preview_url text,
  add column if not exists send_url text,
  add column if not exists sound_url text,
  add column if not exists asset_version integer not null default 1,
  add column if not exists asset_hashes jsonb not null default '{}'::jsonb,
  add column if not exists fallback_asset_key text,
  add column if not exists minimum_client_version integer not null default 1;
```

Constrain `tier` to `basic`, `premium`, or `exclusive`. Seed these exact rows,
with `recipient_percent = 80` and `supported_sources` containing `post`:

```sql
values
  ('pulse-heart', 'Pulse Heart', 'basic', 10, 10),
  ('ice-cream', 'Ice Cream', 'basic', 12, 20),
  ('golden-star', 'Golden Star', 'basic', 30, 30),
  ('coffee-break', 'Coffee Break', 'basic', 35, 40),
  ('pizza-slice', 'Pizza Slice', 'basic', 40, 50),
  ('dream-moon', 'Dream Moon', 'basic', 50, 60),
  ('lightning', 'Lightning', 'premium', 75, 70),
  ('champion-trophy', 'Champion Trophy', 'premium', 100, 80),
  ('blazing-fire', 'Blazing Fire', 'premium', 120, 90),
  ('party-blast', 'Party Blast', 'premium', 150, 100),
  ('celebration-cake', 'Celebration Cake', 'premium', 175, 110),
  ('rainbow-vibes', 'Rainbow Vibes', 'premium', 200, 120),
  ('galaxy-rocket', 'Galaxy Rocket', 'exclusive', 300, 130),
  ('royal-crown', 'Royal Crown', 'exclusive', 500, 140),
  ('legendary-diamond', 'Legendary Diamond', 'exclusive', 750, 150),
  ('the-universe', 'The Universe', 'exclusive', 1000, 160)
```

- [ ] **Step 4: Add immutable post-gift records**

Create `post_gifts` with unique `(sender_id, idempotency_key)`, catalog snapshot fields, sender and recipient ledger IDs, post ID, 80/20 amounts, state, and timestamps. Remove direct client insert permission from `gift_analytics`; only server functions may record successful gift events.

- [ ] **Step 5: Implement `send_post_gift`**

```sql
create or replace function public.send_post_gift(
  p_gift_id uuid,
  p_post_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = '';
```

Lock the sender balance, reject self-gifting and ineligible posts, resolve the current catalog price, deduct once, record the 20% platform fee, credit 80% into creator gift earnings/ledger, update post gift aggregates, insert notification and analytics rows, and return catalog animation metadata plus canonical balances.

- [ ] **Step 6: Rerun SQL tests**

Test insufficient funds, idempotent retry, idempotency conflict, inactive gift, deleted/private post, self-gift, concurrent balance protection, exact split, and RLS.

Run: `npx supabase test db supabase/tests/premium_post_gifts.sql`

Expected: PASS.

- [ ] **Step 7: Commit backend gifting**

```bash
git add supabase/migrations/20260814191000_premium_post_gifts.sql supabase/tests/premium_post_gifts.sql
git commit -m "feat(db): add atomic post gifting"
```

### Task 2: Produce and register the proprietary gift assets

**Files:**
- Create: `native/flutter/assets/gifts/fallback/`
- Create: `assets/gifts/source/README.md`
- Create: `scripts/gifts/validate_gift_assets.sh`
- Modify: `native/flutter/pubspec.yaml`

- [ ] **Step 1: Define the delivery manifest**

For each approved gift, render:

```text
<gift-key>-poster.webp
<gift-key>-idle.webp
<gift-key>-preview.webp
<gift-key>-send.mp4
<gift-key>-sound.m4a (optional)
```

Idle loops must be transparent animated WebP; Preview is animated WebP or muted MP4; Send is unique 2-6 second MP4. Source `.blend` files remain under the production asset workspace and are not replaced by generated flat icons.

- [ ] **Step 2: Create the Blender scenes and render all 16 gifts**

Model the silhouettes and materials specified in the approved design: crystal/metal Basic, energy/holographic Premium, and cinematic Exclusive. Each scene must contain separate Idle, Preview, and Send actions matching its named motion signature.

- [ ] **Step 3: Validate asset constraints**

`validate_gift_assets.sh` must fail when any gift/state is missing, when an idle file is not animated WebP, when Send is outside 2-6 seconds, or when dimensions/byte limits exceed the mobile budget.

Run: `bash scripts/gifts/validate_gift_assets.sh native/flutter/assets/gifts/fallback`

Expected: `16 gifts validated; 48 required visual assets present`.

- [ ] **Step 4: Register bundled fallbacks**

Add `assets/gifts/fallback/` to `pubspec.yaml`. Upload versioned production assets to the approved remote storage bucket and update the migration seed URLs/hashes before deployment.

- [ ] **Step 5: Commit production assets and validation**

```bash
git add native/flutter/assets/gifts/fallback native/flutter/pubspec.yaml assets/gifts/source/README.md scripts/gifts/validate_gift_assets.sh
git commit -m "feat(gifts): add premium animated assets"
```

### Task 3: Add Flutter gift domain and repository boundaries

**Files:**
- Create: `native/flutter/lib/src/features/gifts/data/gift_models.dart`
- Create: `native/flutter/lib/src/features/gifts/data/gift_remote_data_source.dart`
- Create: `native/flutter/lib/src/features/gifts/data/gift_repository.dart`
- Create: `native/flutter/test/gift_models_test.dart`
- Create: `native/flutter/test/gift_remote_data_source_test.dart`

- [ ] **Step 1: Write failing model/repository tests**

Cover tier parsing, catalog order, server price, asset version/hash parsing, incompatible-client filtering, stable error-code mapping, and idempotency-key reuse after timeout.

- [ ] **Step 2: Run and verify failure**

Run: `flutter test test/gift_models_test.dart test/gift_remote_data_source_test.dart`

Expected: FAIL because the gift domain does not exist.

- [ ] **Step 3: Implement immutable models**

```dart
enum GiftTier { basic, premium, exclusive }

class GiftCatalogItem {
  const GiftCatalogItem({
    required this.id,
    required this.key,
    required this.name,
    required this.tier,
    required this.creditCost,
    required this.assets,
    required this.fallbackAssetKey,
  });
}
```

Define `GiftAssetManifest`, `GiftSendResult`, and sealed `GiftFailure` variants for insufficient credits, unavailable gift, ineligible post, timeout reconciliation, and unknown server failure.

- [ ] **Step 4: Implement remote calls**

Fetch active post gifts from `gift_catalog`; call `send_post_gift` with gift ID, post ID, and one UUID generated per send attempt. Do not send price or recipient percent from Flutter.

- [ ] **Step 5: Verify and commit**

Run: `flutter test test/gift_models_test.dart test/gift_remote_data_source_test.dart`

Run: `flutter analyze lib/src/features/gifts`

```bash
git add native/flutter/lib/src/features/gifts native/flutter/test/gift_models_test.dart native/flutter/test/gift_remote_data_source_test.dart
git commit -m "feat(gifts): add remote gift repository"
```

### Task 4: Build the native gift marketplace and playback system

**Files:**
- Create: `native/flutter/lib/src/features/gifts/presentation/gift_marketplace_sheet.dart`
- Create: `native/flutter/lib/src/features/gifts/presentation/gift_card.dart`
- Create: `native/flutter/lib/src/features/gifts/presentation/gift_credit_badge.dart`
- Create: `native/flutter/lib/src/features/gifts/presentation/gift_asset_view.dart`
- Create: `native/flutter/lib/src/features/gifts/presentation/gift_activation_overlay.dart`
- Create: `native/flutter/lib/src/features/gifts/presentation/gift_sound_controller.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/lib/src/features/feed/feed_post_pager_screen.dart`
- Create: `native/flutter/test/gift_marketplace_sheet_test.dart`
- Create: `native/flutter/test/gift_activation_overlay_test.dart`

- [ ] **Step 1: Write failing marketplace tests**

Assert the three tier tabs, remote prices, metallic credit badge, Idle-to-Preview selection, Send state, insufficient-credit action, reduced-motion poster fallback, remote asset failure fallback, muted sound, and one RPC for repeated taps.

- [ ] **Step 2: Run and verify failure**

Run: `flutter test test/gift_marketplace_sheet_test.dart test/gift_activation_overlay_test.dart`

Expected: FAIL because the presentation components do not exist.

- [ ] **Step 3: Implement tiered marketplace UI**

Use `DraggableScrollableSheet`, stable two-column cards, sapphire Basic, violet Premium, and black/deep-gold Exclusive panels. Pause off-screen idle decoders. Cache by catalog key/version/hash and use the bundled fallback on any invalid download.

- [ ] **Step 4: Implement transactional Send behavior**

Disable Send while pending, retain the same idempotency key across timeout reconciliation, update displayed balance/count from the server result, close the sheet, and play the returned Send manifest in `GiftActivationOverlay`.

- [ ] **Step 5: Replace Wallet routing**

In both `FeedShell` and `FeedPostPagerScreen`, replace `onOpenWallet`/the “Open Wallet” message with `showGiftMarketplaceSheet(postId: post.displayedPost.id, ...)`.

- [ ] **Step 6: Verify marketplace behavior**

Run: `flutter test test/gift_marketplace_sheet_test.dart test/gift_activation_overlay_test.dart test/feed_action_rail_test.dart`

Expected: PASS and Gift never navigates directly to Wallet.

- [ ] **Step 7: Commit native gifting UI**

```bash
git add native/flutter/lib/src/features/gifts native/flutter/lib/src/features/feed/feed_shell.dart native/flutter/lib/src/features/feed/feed_post_pager_screen.dart native/flutter/test/gift_marketplace_sheet_test.dart native/flutter/test/gift_activation_overlay_test.dart
git commit -m "feat(gifts): add in-feed gift marketplace"
```

### Task 5: Deploy and verify post gifting

**Files:**
- Modify: `docs/superpowers/plans/2026-08-14-premium-post-gifting.md` only to check completed steps.

- [ ] **Step 1: Run full verification**

Run: `flutter analyze`

Run: `flutter test`

Run: `bash scripts/gifts/validate_gift_assets.sh native/flutter/assets/gifts/fallback`

Expected: no analyzer issues, all Flutter tests pass, and all gift assets validate.

- [ ] **Step 2: Deploy the migration**

Run the project-approved linked Supabase migration command after confirming the target project. Verify `gift_catalog` rows and execute a rolled-back canary transaction for split/idempotency.

- [ ] **Step 3: Build and device-test a signed live APK**

Build with live Supabase dart defines. Install the exact APK on the attached device and verify Basic/Premium/Exclusive browsing, successful Send, insufficient balance, animation fallback, reduced motion, and muted sound.

- [ ] **Step 4: Commit rollout evidence**

Record only non-secret test evidence in the implementation report; do not commit generated APKs, signed URLs, or credentials.
