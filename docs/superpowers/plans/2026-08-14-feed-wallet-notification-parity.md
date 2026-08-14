# Feed Wallet Notification Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved compact feed chrome, reliable gift settlement and receipt feedback, tabbed wallet with local-currency checkout, and background notification routing in the native Flutter app.

**Architecture:** Keep UI state in focused Flutter presenters/widgets, keep balances and currency conversion server-authoritative in Supabase, and reuse the existing FCM token registration plus data-only background handler. Every financial mutation remains idempotent and atomic; the client only renders verified server results.

**Tech Stack:** Flutter/Dart, Supabase Postgres/RPC, Supabase Edge Functions/Deno TypeScript, Firebase Cloud Messaging, Paystack hosted checkout, Flutter widget tests, SQL contract tests, Deno tests.

---

### Task 1: Compact feed chrome and creator row

**Files:**
- Modify: `native/flutter/lib/src/features/feed/feed_shell.dart`
- Modify: `native/flutter/lib/src/features/feed/immersive/creator_header.dart`
- Modify: `native/flutter/lib/src/features/feed/state/feed_chrome_state_machine.dart`
- Test: `native/flutter/test/feed_creator_header_test.dart`
- Test: `native/flutter/test/feed_chrome_widgets_test.dart`
- Test: `native/flutter/test/feed_chrome_state_machine_test.dart`

- [ ] **Step 1: Write failing creator-order and centered-tab widget tests**

Add assertions that the semantic/widget order is display name, verified icon, tier badge, Follow, with the handle below, and that the feed tabs occupy the centered slot in the top overlay rather than a second row.

```dart
expect(find.text('Ada Okafor'), findsOneWidget);
expect(find.byIcon(Icons.verified_rounded), findsOneWidget);
expect(find.text('Pro'), findsOneWidget);
expect(find.byKey(const Key('feed-author-follow')), findsOneWidget);
expect(find.text('@adaokafor'), findsOneWidget);

final nameX = tester.getTopLeft(find.text('Ada Okafor')).dx;
final followX = tester.getTopLeft(find.byKey(const Key('feed-author-follow'))).dx;
expect(followX, greaterThan(nameX));
expect(tester.takeException(), isNull);
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
cd native/flutter
flutter test test/feed_creator_header_test.dart test/feed_chrome_widgets_test.dart test/feed_chrome_state_machine_test.dart
```

Expected: at least one new layout/timing assertion fails against the current two-row tabs and detached Follow control.

- [ ] **Step 3: Implement the compact row and four-second timer**

Move `_ImmersiveFeedTabs` into the top row using a centered `Expanded` slot, reduce tab label size to 60% of the current value, and make the tabs disappear with the existing full-chrome animation. Restructure `CreatorHeader` so the Follow control is inside the identity line after `_TierBadge`, with the handle and metadata below.

Configure the state machine with the approved delay:

```dart
static const Duration defaultAutoHideDelay = Duration(seconds: 4);
```

Playback changes and surface taps call the existing reveal/restart paths so pause, play, and tap restore full chrome.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the command from Step 2. Expected: all tests pass with no overflow exception.

- [ ] **Step 5: Commit the feed slice**

```bash
git add native/flutter/lib/src/features/feed/feed_shell.dart native/flutter/lib/src/features/feed/immersive/creator_header.dart native/flutter/lib/src/features/feed/state/feed_chrome_state_machine.dart native/flutter/test/feed_creator_header_test.dart native/flutter/test/feed_chrome_widgets_test.dart native/flutter/test/feed_chrome_state_machine_test.dart
git commit -m "fix(feed): align chrome and creator actions"
```

### Task 2: Gift receipt records and atomic balance synchronization

**Files:**
- Modify: `supabase/migrations/20260814191000_premium_post_gifts.sql`
- Create: `supabase/migrations/20260814203000_gift_receipt_delivery.sql`
- Modify: `supabase/tests/premium_post_gifts_test.sql`
- Modify: `native/flutter/lib/src/features/gifts/data/gift_models.dart`
- Modify: `native/flutter/lib/src/features/gifts/data/gift_remote_data_source.dart`
- Test: `native/flutter/test/gift_remote_data_source_test.dart`
- Test: `native/flutter/test/gift_models_test.dart`

- [ ] **Step 1: Add failing SQL assertions for settlement and replay**

Extend the SQL test to send a 30-credit gift and assert the sender balance decreases by 30, the creator balance increases by 24, the platform balance increases by 6, exactly one `post_gifts` row exists, exactly one gift notification exists, and replaying the same UUID changes no balances or counts.

```sql
select public.send_post_gift(gift_id, post_id, idempotency_id);
select public.send_post_gift(gift_id, post_id, idempotency_id);

select is((select count(*) from public.post_gifts where idempotency_key = idempotency_id), 1::bigint, 'gift is idempotent');
select is((select count(*) from public.notifications where user_id = creator_id and type = 'gift' and related_id = post_id), 1::bigint, 'recipient notified once');
```

- [ ] **Step 2: Run the SQL test and confirm RED**

Run:

```bash
supabase test db supabase/tests/premium_post_gifts_test.sql
```

Expected: the replay/receipt assertions fail until the RPC returns and records the original settlement consistently.

- [ ] **Step 3: Add a server-owned gift delivery outbox**

Create `notification_delivery_outbox` if the repository has no equivalent table, keyed by notification ID, and insert the gift event within `send_post_gift` after the notification row is created. The outbox payload is stable and contains:

```json
{
  "type": "gift",
  "route": "post:<post-id>",
  "gift_key": "golden-star",
  "gross_credits": "30",
  "recipient_credits": "24"
}
```

Return the recipient balance and notification ID from the RPC so the sender UI and recipient refresh share the authoritative result.

- [ ] **Step 4: Extend Flutter parsing for authoritative settlement fields**

Add `recipientBalanceAfter` and `notificationId` to `GiftSendResult`, parse them from the RPC response, and preserve the existing animation asset manifest.

- [ ] **Step 5: Run SQL and Flutter gift tests and confirm GREEN**

```bash
supabase test db supabase/tests/premium_post_gifts_test.sql
cd native/flutter
flutter test test/gift_models_test.dart test/gift_remote_data_source_test.dart test/gift_marketplace_sheet_test.dart
```

- [ ] **Step 6: Commit the gift slice**

```bash
git add supabase/migrations/20260814191000_premium_post_gifts.sql supabase/migrations/20260814203000_gift_receipt_delivery.sql supabase/tests/premium_post_gifts_test.sql native/flutter/lib/src/features/gifts/data/gift_models.dart native/flutter/lib/src/features/gifts/data/gift_remote_data_source.dart native/flutter/test/gift_models_test.dart native/flutter/test/gift_remote_data_source_test.dart
git commit -m "fix(gifts): synchronize receipts and balances"
```

### Task 3: Wallet tabs and received-gift history

**Files:**
- Create: `native/flutter/lib/src/features/wallet/data/wallet_gift_models.dart`
- Create: `native/flutter/lib/src/features/wallet/widgets/wallet_tab_bar.dart`
- Create: `native/flutter/lib/src/features/wallet/widgets/gifts_tab.dart`
- Create: `native/flutter/lib/src/features/wallet/widgets/wallet_history_tab.dart`
- Modify: `native/flutter/lib/src/features/wallet/data/wallet_remote_data_source.dart`
- Modify: `native/flutter/lib/src/features/wallet/wallet_presenter.dart`
- Modify: `native/flutter/lib/src/features/wallet/wallet_screen.dart`
- Test: `native/flutter/test/wallet_presenter_test.dart`
- Test: `native/flutter/test/wallet_screen_test.dart`

- [ ] **Step 1: Write failing wallet navigation tests**

Assert that the wallet renders exactly five navigation choices and switching tabs replaces the body rather than scrolling to another section.

```dart
for (final label in ['Packages', 'Gifts', 'History', 'Sell Credits', 'P2P']) {
  expect(find.text(label), findsOneWidget);
}
await tester.tap(find.text('Gifts'));
await tester.pumpAndSettle();
expect(find.byKey(const Key('wallet-gifts-tab')), findsOneWidget);
expect(find.byKey(const Key('wallet-packages-tab')), findsNothing);
```

- [ ] **Step 2: Add failing received-gift data tests**

Extend the fake data source with `fetchReceivedGifts()` and assert the presenter exposes gift name, sender, gross credits, recipient credits, created time, and converted status.

- [ ] **Step 3: Run wallet tests and confirm RED**

```bash
cd native/flutter
flutter test test/wallet_presenter_test.dart test/wallet_screen_test.dart
```

Expected: missing five-tab navigation and gift data API failures.

- [ ] **Step 4: Implement tab-owned wallet bodies**

Use a stable enum:

```dart
enum WalletTab { packages, gifts, history, sellCredits, p2p }
```

Keep the balance header outside the selected body. Packages renders package/subscription purchasing, Gifts renders `post_gifts` received and sent views, History renders the credit ledger, Sell Credits renders finance buyback controls, and P2P opens/renders the existing P2P surface. Each body owns its error, loading, empty, and refresh state.

- [ ] **Step 5: Run wallet tests and confirm GREEN**

Run the command from Step 3. Expected: all wallet tests pass.

- [ ] **Step 6: Commit the wallet navigation slice**

```bash
git add native/flutter/lib/src/features/wallet native/flutter/test/wallet_presenter_test.dart native/flutter/test/wallet_screen_test.dart native/flutter/test/wallet_test_fakes.dart
git commit -m "feat(wallet): add tabbed credit management"
```

### Task 4: Local-currency display and checkout contract

**Files:**
- Create: `native/flutter/lib/src/features/wallet/data/currency_models.dart`
- Create: `native/flutter/lib/src/features/wallet/data/currency_remote_data_source.dart`
- Modify: `native/flutter/lib/src/features/wallet/data/wallet_remote_data_source.dart`
- Modify: `native/flutter/lib/src/features/wallet/wallet_presenter.dart`
- Modify: `native/flutter/lib/src/features/wallet/widgets/package_card.dart`
- Modify: `native/flutter/lib/src/features/wallet/widgets/subscription_card.dart`
- Modify: `supabase/functions/paystack-checkout/contracts.ts`
- Modify: `supabase/functions/paystack-checkout/index.ts`
- Test: `native/flutter/test/wallet_presenter_test.dart`
- Test: `native/flutter/test/wallet_server_contract_test.dart`
- Test: `supabase/functions/paystack-checkout/contracts_test.ts`

- [ ] **Step 1: Write failing currency conversion tests**

Test a canonical `$10.00` package with `NGN` rate `1515` and assert `₦15,150` is displayed with `$10.00 USD equivalent`. Test missing/unsupported rate fallback to `$10.00 USD`.

- [ ] **Step 2: Write failing checkout payload tests**

Assert the Flutter request sends `currency: NGN`, and the Edge Function contract accepts the requested currency only when it is active/supported while retaining the canonical USD amount for verification.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
cd native/flutter
flutter test test/wallet_presenter_test.dart test/wallet_server_contract_test.dart
cd ../..
deno test supabase/functions/paystack-checkout/contracts_test.ts
```

- [ ] **Step 4: Implement server-backed currency state**

Read `profiles.preferred_currency` and active `currency_rates`, expose `CurrencyQuote`, and format prices with the stored symbol/rate timestamp. Extend checkout initialization with:

```json
{
  "type": "credits",
  "itemId": "<package-id>",
  "currency": "NGN"
}
```

The Edge Function loads the canonical USD item price, validates the active rate, rounds the local minor-unit amount once, initializes Paystack in the supported local currency, stores both canonical and charged amounts, and verifies the provider currency/amount before crediting.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the command from Step 3. Expected: all currency and checkout contract tests pass.

- [ ] **Step 6: Commit the currency slice**

```bash
git add native/flutter/lib/src/features/wallet supabase/functions/paystack-checkout native/flutter/test/wallet_presenter_test.dart native/flutter/test/wallet_server_contract_test.dart
git commit -m "feat(wallet): support local currency checkout"
```

### Task 5: Background push routing for gifts and social events

**Files:**
- Create: `supabase/functions/dispatch-notification-push/index.ts`
- Create: `supabase/functions/dispatch-notification-push/index_test.ts`
- Modify: `supabase/functions/_shared/fcm.ts`
- Modify: `native/flutter/lib/src/core/notifications/push_notification_service.dart`
- Modify: `native/flutter/lib/src/core/notifications/local_notifications_service.dart`
- Test: `native/flutter/test/communication/notification_router_test.dart`
- Create: `native/flutter/test/push_notification_service_test.dart`

- [ ] **Step 1: Write failing route-mapping tests**

Cover `gift`, `comment`, `mention`, `tag`, `follow`, `message`, and `call`. Expected routes are `post:<id>`, `profile:<id>`, `conversation:<id>`, or `call:<id>`.

```dart
expect(routeFromData({'type': 'gift', 'post_id': 'p1'}), 'post:p1');
expect(routeFromData({'type': 'message', 'conversation_id': 'c1'}), 'conversation:c1');
expect(routeFromData({'type': 'call', 'call_id': 'k1'}), 'call:k1');
```

- [ ] **Step 2: Write failing dispatcher tests**

Test preference rejection, no-token success, invalid-token cleanup, and high-priority data payload generation without contacting FCM by injecting the sender function.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
cd native/flutter
flutter test test/communication/notification_router_test.dart test/push_notification_service_test.dart
cd ../..
deno test supabase/functions/dispatch-notification-push/index_test.ts
```

- [ ] **Step 4: Implement dispatcher and native routing**

The dispatcher reads a notification/outbox row, checks the recipient preference column for its type, sends data-only high-priority FCM through `_shared/fcm.ts`, and records delivered/failed state. The native background handler shows a local notification for gift/social/message types and preserves CallKit handling for calls. Notification taps use one pure route mapper shared by foreground, background, and cold-start paths.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the command from Step 3. Expected: all push contract and route tests pass.

- [ ] **Step 6: Commit the push slice**

```bash
git add supabase/functions/dispatch-notification-push supabase/functions/_shared/fcm.ts native/flutter/lib/src/core/notifications/push_notification_service.dart native/flutter/lib/src/core/notifications/local_notifications_service.dart native/flutter/test/communication/notification_router_test.dart native/flutter/test/push_notification_service_test.dart
git commit -m "feat(notifications): deliver gift and social push"
```

### Task 6: Integrated verification, backend deployment, and device release

**Files:**
- Modify: `native/flutter/pubspec.yaml` only if a build-number increment is required after the previous installed release.

- [ ] **Step 1: Run source and full test verification**

```bash
cd native/flutter
flutter analyze --no-pub
flutter test
cd ../..
git diff --check
```

Expected: analyzer reports `No issues found!`, Flutter reports zero failed tests, and `git diff --check` exits 0.

- [ ] **Step 2: Apply and verify backend changes**

Load the existing project environment without printing it, then run:

```bash
supabase db push --linked --password "$SUPABASE_DB_PASSWORD" --yes
supabase functions deploy paystack-checkout --project-ref jnegupfltkfybhwpodrr
supabase functions deploy dispatch-notification-push --project-ref jnegupfltkfybhwpodrr
```

Expected: migrations apply once and both functions report deployed/active.

- [ ] **Step 3: Build and inspect the signed release APK**

```bash
cd native/flutter
flutter build apk --release
aapt dump badging build/app/outputs/flutter-apk/app-release.apk
apksigner verify --verbose --print-certs build/app/outputs/flutter-apk/app-release.apk
shasum -a 256 build/app/outputs/flutter-apk/app-release.apk
```

Expected: package is `com.feedin.app`, versionCode exceeds the installed build, v2 signing verifies, and a SHA-256 is printed.

- [ ] **Step 4: Install and smoke-test the attached device**

```bash
adb devices -l
adb -s SM02G40619110816 install -r build/app/outputs/flutter-apk/app-release.apk
adb -s SM02G40619110816 shell am start -n com.feedin.app/.MainActivity
adb -s SM02G40619110816 shell dumpsys activity activities
```

Verify on-device: centered tabs, four-second hide/reveal, Follow alignment, wallet five-tab switching, received-gift row/balance, and notification tap routing.

- [ ] **Step 5: Confirm repository and publication boundary**

```bash
git rev-parse --show-toplevel
git branch --show-current
git remote get-url origin
gh auth status
git status --short
git log --oneline origin/feat/native-feed-parity..HEAD
```

Expected: root is the isolated worktree, branch is `feat/native-feed-parity`, origin is `https://github.com/donvip1/feedinbeta.git`, GitHub auth is valid, and only intended changes/commits remain.

- [ ] **Step 6: Push the completed branch**

```bash
git push -u origin feat/native-feed-parity
```

Expected: origin advances to the final verified commit.

