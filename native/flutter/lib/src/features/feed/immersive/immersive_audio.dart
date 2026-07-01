import 'package:flutter/foundation.dart';

/// App-wide mute state for the immersive (TikTok-style) reel feed.
///
/// The web `ImmersivePostCard` keeps a single global mute flag so that toggling
/// sound on one reel persists to every other reel you swipe to (see
/// `src/components/feed/ImmersivePostCard.tsx`, `globalMuted`). The native pager
/// builds each [ImmersiveVideoPlayer] independently and — because the pager
/// lives in `feed_shell.dart`, which is owned by the navigation coordinator — we
/// cannot thread a shared value down through the widget tree. Instead every
/// immersive video listens to this shared notifier, which gives us the same
/// "mute once, stays muted" behaviour without touching the shell.
///
/// Defaults to **sound ON** (`false`): the active reel autoplays with audio, and
/// the user can mute/unmute from the on-reel toggle. Muting is remembered for
/// the rest of the session.
final ValueNotifier<bool> immersiveFeedMuted = ValueNotifier<bool>(false);
