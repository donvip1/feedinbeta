# Native Feed Parity, Premium Gifts, and Promotions Design

## Objective

Bring the strongest interaction patterns from the existing Feedin web product
into the native Flutter feed while improving their visual hierarchy and mobile
behavior. The native app will gain a complete author header, an in-feed premium
gift experience, remotely managed post promotion, and a modern create-action
sheet. These features must use shared Supabase contracts and native Flutter UI;
they must not embed the web application in a WebView.

This design builds on the approved single-route full-screen composer. Selecting
Photo+ or Video from the create sheet enters that composer directly, and a
successful publish still closes Create, focuses the exact new post in Feed, and
shows a success notification.

## Product Principles

- The feed remains media-first, with identity and post context immediately
  visible without covering important media.
- Brand pink is an accent, not the dominant surface color. Neutral dark
  surfaces, white text, teal utility states, and amber value states provide a
  calmer and more modern interface.
- Pro and Premium are distinct earned subscription states. Neither replaces
  the standard verified indicator.
- Gifts are proprietary digital collectibles, not Unicode emoji, flat stickers,
  or copied assets from another platform.
- Credit prices, gift availability, promotion plans, and money movement are
  server-owned. The client renders server data and requests transactions.
- Every transactional action is idempotent, auditable, and recoverable from a
  temporary network or asset failure.

## Scope and Delivery Phases

The program is delivered through shared contracts in three independently
testable phases:

1. Feed identity and creation parity: enriched author header, corrected action
   placement, create sheet, and direct routing into existing native flows.
2. Premium gifts: remote catalog, native gift marketplace, atomic wallet
   transaction, animation playback, notifications, and gift totals.
3. Promotions: remote plans, targeting, preview and confirmation, campaign
   creation, and promoted placement through the existing feed ranking path.

Schema changes may land together when required for compatibility, but each
phase remains behind a remote feature flag until its contracts and native UI
have passed production-like device verification.

## Feed Post Experience

### Author header

Each original post places its author identity above the media at the top-left:

- circular avatar with profile navigation;
- display name on the primary line;
- verified indicator when the profile is verified;
- Pro or Premium subscription badge when that tier is currently active;
- `@username` beneath the display name;
- compact post age, privacy, and optional location metadata;
- Follow action when the viewer is eligible to follow the author;
- overflow menu for contextual post actions.

Verified, Pro, and Premium are separate fields and may appear together. An
expired subscription never displays a paid badge. Location is omitted rather
than replaced with empty text when no location exists.

The avatar is removed from the right-side action rail so identity is not
duplicated. The rail keeps clear actions for like, comments, gift, refeed/share,
and other existing supported engagement. Gift opens the post gift sheet; it
never redirects to Wallet.

Quoted or refed posts preserve visible attribution for both the acting user and
the original author without rendering two competing full author headers.

### Media and engagement behavior

Photos open a native full-screen viewer with pinch zoom, double-tap zoom, pan,
and swipe navigation for multi-image posts. Video posts remain in the video
feed classification and photos remain in the photo classification. Media type
is derived from canonical post media records, not a thumbnail or URL guess.

The visible comment total includes top-level comments and non-deleted replies.
The server returns the authoritative aggregate, while newly added comments and
replies update the count optimistically and reconcile after the write returns.

Promoted posts show a restrained `Promoted` label and the applicable disclosure
without displacing the author identity or engagement controls.

## Create Action Sheet

Tapping the center `+` action opens a native bottom sheet with four stable
options:

- Video: `Take video or choose from gallery`
- Photo+: `Share your thoughts with images`
- Story: `Share for 24 hours`
- Go Live: `Start a live stream or audio space`

Each row uses a familiar icon, title, one-line description, accessible tap
target, and clear pressed state. The sheet uses neutral dark surfaces and
restrained accent color rather than the reference screenshot's pink-heavy
palette.

Video and Photo+ route directly into the approved single-route full-screen
composer with the appropriate capture or gallery affordances. Story routes to
the existing story creator. Go Live opens a second bottom sheet containing:

- Video Live
- Audio Space

Choosing either live mode opens its native preparation flow. Back closes only
the current sheet or preparation step and does not expose a duplicate Create
window.

## Premium Animated Gift System

### Gift marketplace

The gift action opens a draggable in-feed sheet above the current post. The
post remains recognizable behind it. The sheet contains three tabs with
visually distinct atmospheres:

- Basic: sapphire and dark-blue lighting, representing playful luxury.
- Premium: deep violet lighting with stronger energy and reflective effects.
- Exclusive: black and deep-gold lighting, representing cinematic prestige.

Gift cards use a compact mobile grid. The animated collectible dominates each
card, followed by its name, rarity indicator, and a metallic/glass credit badge.
Selecting a card enters its Preview state and reveals the Send action. The
current credit balance and an unobtrusive add-credits route remain visible, but
opening the marketplace does not navigate to Wallet.

### Canonical collection

The initial remotely managed catalog contains exactly these gifts and server
prices:

| Tier | Gift | Credits | Motion signature |
| --- | --- | ---: | --- |
| Basic | Pulse Heart | 10 | Heartbeat pulse and crystal particles |
| Basic | Golden Star | 30 | Radiant spin and gold starburst |
| Basic | Coffee Break | 35 | Floating cup, rising steam, warm lift |
| Basic | Pizza Slice | 40 | Playful spin, heat, toppings and sparks |
| Basic | Ice Cream | 12 | Gentle wobble, cool mist and sparkle |
| Basic | Dream Moon | 50 | Orbital drift, stars and moonlight burst |
| Premium | Lightning | 75 | Electrical arcs and energy strike |
| Premium | Champion Trophy | 100 | Rising championship reveal |
| Premium | Blazing Fire | 120 | Expanding magical flare and glowing core |
| Premium | Party Blast | 150 | Charged cannon and celebration burst |
| Premium | Celebration Cake | 175 | Candle, balloon and confetti celebration |
| Premium | Rainbow Vibes | 200 | Expanding holographic wave |
| Exclusive | Galaxy Rocket | 300 | Cinematic launch through a cosmic portal |
| Exclusive | Royal Crown | 500 | Royal descent and golden shockwave |
| Exclusive | Legendary Diamond | 750 | Camera push-in and prism explosion |
| Exclusive | The Universe | 1,000 | Cosmic formation, expansion and collapse |

No client constant is authoritative for these prices. The table is the launch
configuration loaded into the remote catalog.

### Animation states and asset pipeline

Every gift has three distinct states:

- Idle: a short transparent animated WebP loop with gentle motion suitable for
  browsing several gifts at once.
- Preview: a higher-detail animated WebP or short muted video with stronger
  lighting and the gift's signature movement.
- Send: a unique 2-6 second MP4 cinematic activation rendered over the post.

Optional signature sound is remotely hosted and user-controllable. Sound never
autoplays when the user has muted gift effects or the device is in an applicable
silent state. Reduced-motion mode replaces continuous loops with a high-quality
poster frame and uses a brief dissolve or restrained activation instead of the
full cinematic sequence.

The final assets require a real 3D production and rendering pipeline using
original modeled geometry, physically based materials, lighting, particles,
and tier-appropriate effects. Generated concept images may guide art direction
but are not production deliverables. Models and render sources remain editable;
mobile delivery assets are compressed, dimension-capped, and validated on
low-memory Android devices before catalog activation.

Each catalog item includes poster, idle, preview, send, and optional sound URLs,
their content hashes, dimensions, duration, byte size, version, minimum client
version, and bundled fallback asset key. Remote media is cached by version and
hash. A failed or invalid download falls back to the bundled asset without
blocking selection or payment.

### Sending a gift

The client submits only `gift_id`, `post_id`, and an idempotency key to
`send_post_gift`. The authenticated server transaction:

1. locks or otherwise serializes the sender's spendable balance;
2. validates that the post, recipient, and catalog gift are eligible;
3. resolves the active server price;
4. rejects self-gifting unless a future server policy explicitly permits it;
5. deducts the full price once;
6. records the 20% platform fee and credits 80% to the creator's gift earnings;
7. records the immutable gift event and post aggregate;
8. creates the recipient notification;
9. returns the canonical transaction, balances, and animation manifest.

The activation begins only after the transaction succeeds. A repeated request
with the same idempotency key returns the original result and never charges
again. Insufficient credits keep the sheet open, identify the required amount,
and offer the existing add-credits route. Creator earnings follow the existing
conversion and payout rules; the app does not represent gifted credits as cash
before conversion eligibility is satisfied.

## Promote Post Experience

### Eligibility and entry points

Any authenticated user may promote an eligible public post, including another
creator's post. Private, deleted, blocked, policy-restricted, or otherwise
ineligible posts cannot be promoted. The server is authoritative for
eligibility.

Promote appears in the post overflow menu and relevant post-management
surfaces. Promotion never changes ownership of the post. Campaign records keep
both the promoter and creator identities for disclosure, analytics, rewards,
and moderation.

### Native campaign flow

Promotion uses one native step flow:

1. Plans: remotely managed plan options display price, duration, and estimated
   reach.
2. Targeting: the user chooses the allowed audience, location, age, interests,
   or an automatic audience according to the selected plan.
3. Preview: the actual post appears with its promoted disclosure and a summary
   of plan, targeting, dates, spend, and estimated reach.
4. Confirm: the server revalidates eligibility, plan version, balance, and
   targeting before atomically creating and funding the campaign.

Plans, credit prices, constraints, duration, and reach estimates come from the
remote catalog. The client stores the selected plan ID and version, not a trusted
price. If a plan changes before confirmation, the server returns the latest
terms and requires the user to review them again.

### Placement and reporting

Active campaigns enter the existing feed/ad ranking path. They do not use a
separate hard-coded Flutter feed or permanently pin all promoted content above
organic content. Ranking receives campaign eligibility, remaining budget,
target match, pacing, frequency limits, and creative/post quality signals.

Campaign records preserve promoter ID, creator ID, post ID, plan version,
targeting snapshot, start and end time, spend, delivery state, estimated reach,
actual impressions, reach, engagement, and terminal reason. A campaign can be
paused or rejected by moderation without losing its audit history.

## Shared Backend Contracts

### Feed read contract

The canonical feed RPC or versioned view returns the post and engagement data
already required by Flutter plus:

- author ID, display name, username, avatar URL, and verified state;
- active subscription badge tier and badge asset metadata;
- visibility, location, and canonical creation time;
- canonical media kind and ordered media records;
- authoritative comment count including replies;
- gift count or value aggregate required by the UI;
- promoted state and disclosure metadata.

Flutter repositories map the versioned contract into domain models. They do not
query optional columns ad hoc from `posts`, which prevents schema-drift failures
such as a missing `media_filter_id` projection from breaking the entire feed.
Migrations deploy server support before a client begins requesting new fields.

### Remote configuration

`gift_catalog` stores gift identity, tier, active server price, sort order,
availability, animation metadata, fallback key, accessibility label, version,
and client compatibility.

`promotion_plans` stores plan identity, active credit price, duration, targeting
capabilities, reach model inputs, display order, version, and availability.

Remote flags independently control the enriched feed header, create menu,
gifts, and promotions. Disabled or incompatible items are omitted by the server
instead of rendered as broken controls.

### Transaction contracts

`send_post_gift(gift_id, post_id, idempotency_key)` owns all gift pricing and
wallet mutations.

`promote_post(post_id, plan_id, plan_version, targeting, idempotency_key)` owns
eligibility, current terms, campaign creation, and campaign funding.

Both RPCs authenticate the caller, use least-privilege database functions,
validate all referenced records, return stable machine-readable error codes,
and write immutable ledger entries. Row-level security prevents clients from
directly inserting successful gift transactions or funded campaigns.

## Failure Handling

- Optional author metadata failure does not hide the post. The UI uses known
  identity fields and omits unavailable location or badge details.
- A versioned feed contract mismatch returns a recoverable compatibility error
  and telemetry rather than repeatedly refreshing a broken query.
- Previous comments remain readable through backward-compatible comment reads;
  the migration does not replace or orphan existing comment rows.
- A failed asset download uses the verified bundled fallback and records the
  catalog version and URL category, without logging signed URLs or secrets.
- A gift send timeout is reconciled by idempotency key before the Send action is
  enabled again.
- A successful gift transaction is not reversed because animation playback or
  sound fails.
- Promotion funding and campaign creation succeed or fail in one server
  transaction. A timeout is reconciled before retry, preventing duplicate
  campaigns or charges.
- Insufficient credits, expired plan versions, ineligible posts, moderation
  rejection, and network failure have distinct messages and recovery actions.
- Publishing a post exits Create after success even if the subsequent feed
  refresh fails; refresh remains retryable on Feed.

## Accessibility and Performance

- Gift cards and actions have semantic names that include gift name, tier, and
  server price.
- Text scales without covering gift media, author identity, or post actions.
- Controls meet mobile tap-target and contrast requirements.
- Animation playback honors reduced-motion and the gift sound preference.
- Only visible Idle loops animate; off-screen cards pause and release decoders.
- Preview and Send assets are prefetched only after likely intent, subject to
  network and device constraints.
- All media playback components have bounded dimensions and stable placeholders
  so loading cannot resize the sheet or feed.
- Exclusive effects may cover most of the screen during activation but keep a
  clear dismiss path and never block emergency system navigation.

## Testing Strategy

### Database and contract tests

- Feed contract returns stable author, badge, media, location, promotion, gift,
  and reply-inclusive comment fields for old and new posts.
- Migrations preserve pre-existing posts and comments and work when optional
  legacy columns are absent.
- Gift sends validate active price, prohibit unauthorized direct writes, apply
  the 80/20 split, and create one ledger event and notification.
- Concurrent or repeated gift requests with one idempotency key charge once.
- Promotion confirmation revalidates eligibility and plan version and creates
  one funded campaign.
- Failed gift and promotion transactions leave balances and ledgers unchanged.
- Row-level security covers catalog administration, gift events, ledgers,
  campaigns, and analytics.

### Flutter unit and widget tests

- Feed model mapping covers badges, username, location, media type, promoted
  disclosure, gift totals, and reply-inclusive comment totals.
- The author header shows the correct badge combinations and omits unavailable
  metadata cleanly.
- The gift action opens the in-feed sheet rather than Wallet.
- Basic, Premium, and Exclusive tabs render remote items, credit badges, loading
  states, fallback assets, reduced motion, and disabled/incompatible items.
- Duplicate Send taps issue one repository request; success plays the returned
  activation and updates balances and totals.
- Create options and the second Go Live sheet route to the intended native
  flows without creating nested composer windows.
- Promotion steps preserve selections, display current remote terms, require
  renewed review after a plan-version conflict, and prevent duplicate confirm.
- Full-screen photo pinch, double-tap, pan, and gallery paging work without
  changing feed classification.

### Integration and device verification

Use live-like Supabase contracts and a signed Android build to verify:

- old and new posts, prior comments, and reply-inclusive counts;
- verified, Pro, Premium, followed, and promoted author-header variants;
- gift browsing on slow and offline networks, insufficient balance, successful
  send, idempotent retry, fallback media, reduced motion, and muted sound;
- promotion of the viewer's post and another creator's eligible public post;
- plan-version change, ineligible post, successful funding, and ranked delivery;
- Photo+, Video, Story, Video Live, and Audio Space routing;
- publish success returning to and focusing the exact new feed post;
- memory, battery, decoder usage, layout, and animation clarity on representative
  low-, mid-, and high-tier Android devices.

## Observability and Rollout

Structured telemetry records feed contract version, mapping failures, gift
catalog version, asset state, gift RPC outcome code, animation playback failure,
promotion plan version, campaign RPC outcome code, and create-route result. It
must not record captions, private targeting detail, access tokens, signed asset
URLs, or payment secrets.

Rollout proceeds in this order:

1. Deploy backward-compatible schema, versioned reads, catalogs, RPCs, and
   server tests while all new client flags remain disabled.
2. Release feed identity and create menu to internal testers, then a small
   production cohort.
3. Activate Basic gift browsing without spending, validate asset delivery, then
   enable transactions before Premium and Exclusive tiers.
4. Activate promotions for internal campaigns, then limited public cohorts with
   pacing and financial monitoring.
5. Expand only when feed refresh errors, duplicate transaction rate, asset
   fallback rate, crash-free sessions, ledger reconciliation, and campaign
   delivery remain within agreed operational thresholds.

Each flag can disable its UI entry point without disabling reads of previously
created gifts or campaigns. Financial ledger records are never rolled back by a
client feature flag.

## Acceptance Criteria

- Every feed post exposes a clear top-left author identity with avatar, display
  name, username, applicable verified and subscription badges, age, privacy,
  and optional location.
- The right rail no longer duplicates the avatar.
- Photo posts support native full-screen zoom and videos do not appear in the
  photo section.
- Comment counts include non-deleted replies and existing comments remain
  visible after migration.
- The `+` menu offers Video, Photo+, Story, and Go Live, with Video Live and
  Audio Space in the second live sheet.
- Photo and video creation remain in the approved single full-screen composer,
  and successful publication opens the exact new post in Feed.
- Tapping Gift opens the in-feed marketplace and never redirects directly to
  Wallet.
- The catalog contains the exact 16 approved proprietary gifts with distinct
  Idle, Preview, and Send animations and the approved launch prices.
- Gift pricing and the 80% creator / 20% platform split are applied atomically
  by the server with idempotent retries and auditable ledger records.
- Any authenticated user can promote an eligible public post through the native
  Plans, Targeting, Preview, and Confirm flow.
- Promotion terms are remotely managed, server-validated, and delivered through
  the existing ranked feed/ad path.
- Remote asset, network, and optional metadata failures degrade cleanly without
  hiding posts, losing drafts, double-charging users, or creating duplicate
  campaigns.
