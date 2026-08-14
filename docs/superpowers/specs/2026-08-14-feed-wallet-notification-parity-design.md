# Feed, Wallet, and Notification Parity Design

**Date:** 2026-08-14

**Goal:** Align the native Feedin feed and wallet with the approved modern layout while making gift delivery, wallet balances, local-currency checkout, and background notifications reliable and server-authoritative.

## Scope

This change is split into four independently testable surfaces:

1. Feed chrome and author identity layout.
2. Gift receipt, ledger settlement, and notification delivery.
3. Tabbed wallet navigation and local-currency price presentation/checkout.
4. Background push delivery for social, gift, message, and call events.

The existing premium gift catalog, promotion flow, Supabase auth/RLS, FCM registration, and hosted Paystack checkout remain the foundation. No client-side balance mutation is authoritative.

## Feed Chrome

The immersive feed overlay uses one compact safe-area row. `feedIn` remains left-aligned, the `Videos`, `Photos`, and `Live` tabs are centered in the remaining space, and search, notification bell, and post actions remain right-aligned. The tabs are reduced to compact label/icon treatment and never share horizontal space with the author identity.

The creator header uses a constrained identity line: avatar, display name, verified badge, Pro/Premium badge, then Follow. The username and metadata are on the next line. Long names truncate before the action controls; the Follow control has a fixed minimum hit target and cannot overlap badges.

While an active video is playing, full feed chrome fades out after four seconds without a tap or playback state change. Any surface tap, pause, play, tab change, or navigation event restores it. Photos and Live retain full chrome unless the user explicitly enters the same immersive playback state.

## Gifts and Settlement

`send_post_gift` remains the single transaction boundary. For each idempotency key it must atomically:

- debit the sender;
- credit the creator with 80% of the catalog cost;
- credit the platform wallet with 20%;
- write sender and recipient credit-ledger rows;
- write the gift record and analytics row;
- increment post gift counters;
- create the recipient notification row;
- enqueue or dispatch a push notification event.

The recipient experience reads the same gift record and ledger state in the Feed notification, notification inbox, and Wallet Gifts tab. The UI displays the gross gift cost, recipient credit value, and resulting balance. Retrying a request with the same idempotency key returns the original result and never creates a second debit or credit.

## Wallet

Wallet navigation is a persistent tab bar with five tabs: `Packages`, `Gifts`, `History`, `Sell Credits`, and `P2P`. Each tab owns its loading, empty, error, and refresh states. The balance header is shared and shows available credits, local-currency approximation, and the rate timestamp.

Package and subscription cards show both the local display price and the USD-equivalent catalog price. Currency rates come from the active server-owned `currency_rates` contract and the user profile preference, with a clear fallback to USD if rates are unavailable. The checkout request includes the selected local currency; the server validates supported currencies, converts from the canonical USD price, and verifies the provider response before applying wallet mutations.

## Background Notifications

The native push service continues to register FCM tokens per authenticated device and process foreground messages into the local notification repository. The server push boundary is extended to gift, comment, mention, tag, follow, message, and call event types.

Background payloads use high-priority Android delivery with a stable channel and a route/data payload. Gift and social notifications open the related post or inbox; messages open the conversation; calls use the existing CallKit/full-screen route. Notification preference checks happen before dispatch. Token invalidation and provider failures are recorded without blocking the originating database transaction.

## Verification

- Widget tests cover compact feed layout, badge/Follow ordering, truncation, and chrome hide/reveal timing.
- Gift contract tests cover atomic settlement, idempotent replay, notification creation, and balance synchronization.
- Wallet tests cover tab selection, local-currency formatting, unsupported-rate fallback, and checkout payload currency.
- Push tests cover each route/type payload and background handler behavior.
- `flutter analyze --no-pub`, the full Flutter test suite, Supabase SQL/function tests, a signed release build, device install, foreground launch, and device smoke taps are required before commit/push.

