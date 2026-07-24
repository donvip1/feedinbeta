import 'dart:async';

import '../core/realtime/realtime_multiplexer.dart';
import '../domain/presence.dart';
import '../domain/result.dart';

/// Publishes the viewer's presence/activity to the server. Provider-agnostic.
abstract interface class PresenceTransport {
  Future<Result<void>> publish(Presence presence);
}

/// The single presence/typing/activity service, replacing the legacy stack's
/// three uncoordinated timers and per-keystroke RPCs.
///
///  * **Debounced typing** — leading edge fires immediately (the peer sees
///    "typing…" at the first keystroke), then at most one refresh per
///    [typingRefresh]; a [typingIdle] pause publishes the stop. Keystrokes
///    between edges cost ZERO network calls.
///  * **One heartbeat** keeps the viewer online; [goOffline] publishes the
///    definitive offline mark on backgrounding.
///  * **TTL on the read side** — observed states auto-degrade via
///    [Presence.effective], so a dropped "stop typing" or lost heartbeat can
///    never stick a green dot or a typing row forever.
///  * **Scoped subscriptions** — peers are watched through the shared
///    [RealtimeMultiplexer] (`presence:<userId>` topics), so N widgets watching
///    one user share one physical subscription.
class PresenceEngine {
  PresenceEngine({
    required PresenceTransport transport,
    required RealtimeMultiplexer multiplexer,
    required this.selfUserId,
    this.typingRefresh = const Duration(milliseconds: 1500),
    this.typingIdle = const Duration(seconds: 4),
    this.heartbeat = const Duration(seconds: 45),
    this.activityTtlSeconds = 6,
    this.onlineTtlSeconds = 90,
    int Function()? nowMillis,
  }) : _transport = transport,
       _multiplexer = multiplexer,
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch);

  final PresenceTransport _transport;
  final RealtimeMultiplexer _multiplexer;
  final String selfUserId;
  final Duration typingRefresh;
  final Duration typingIdle;
  final Duration heartbeat;
  final int activityTtlSeconds;
  final int onlineTtlSeconds;
  final int Function() _now;

  Timer? _heartbeatTimer;
  Timer? _typingIdleTimer;
  int _lastTypingPublish = 0;
  String? _typingConversationId;
  bool _disposed = false;

  /// Publishes sent this session (exposed for tests/metrics).
  int publishCount = 0;

  // -- Self presence -------------------------------------------------------------

  /// Go online and start the heartbeat. Call on foreground/login.
  Future<void> goOnline() async {
    await _publish(PresenceState.online);
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(heartbeat, (_) {
      _publish(PresenceState.online);
    });
  }

  /// Publish the definitive offline mark and stop heartbeating. Call on
  /// background/logout.
  Future<void> goOffline() async {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _stopTypingTimers();
    await _publish(PresenceState.offline);
  }

  /// Report a keystroke in [conversationId]. Leading-edge + throttled: the
  /// first call publishes immediately; further calls publish at most once per
  /// [typingRefresh]; [typingIdle] of silence publishes the stop.
  void typing(String conversationId) {
    if (_disposed) return;
    final now = _now();
    final conversationChanged = _typingConversationId != conversationId;
    _typingConversationId = conversationId;

    if (conversationChanged ||
        now - _lastTypingPublish >= typingRefresh.inMilliseconds) {
      _lastTypingPublish = now;
      _publish(PresenceState.typing, conversationId: conversationId);
    }
    _typingIdleTimer?.cancel();
    _typingIdleTimer = Timer(typingIdle, () => stopTyping(conversationId));
  }

  /// Explicit stop (send pressed / field cleared / left the thread).
  void stopTyping(String conversationId) {
    if (_typingConversationId != conversationId) return;
    _typingConversationId = null;
    _lastTypingPublish = 0;
    _typingIdleTimer?.cancel();
    _typingIdleTimer = null;
    _publish(PresenceState.online, conversationId: conversationId);
  }

  /// Longer-lived activities (recording a voice note, uploading media, live).
  Future<void> setActivity(
    PresenceState state, {
    String? conversationId,
  }) => _publish(state, conversationId: conversationId);

  // -- Observing peers -------------------------------------------------------------

  /// Watch [userId]'s presence. Emits the TTL-adjusted state on every update.
  /// Cancel the returned subscription when the widget disposes.
  RealtimeSubscription watch(
    String userId,
    void Function(Presence presence) onPresence,
  ) {
    return _multiplexer.subscribe('presence:$userId', (event) {
      final presence = _decode(userId, event.payload);
      if (presence == null) return;
      onPresence(
        presence.copyWith(
          state: presence.effective(
            _now(),
            ttlSeconds: presence.state.isTransientActivity
                ? activityTtlSeconds
                : onlineTtlSeconds,
          ),
        ),
      );
    });
  }

  /// TTL-degrade an already-held presence (for periodic UI refresh of
  /// last-seen rows without any network traffic).
  PresenceState effectiveOf(Presence presence) => presence.effective(
    _now(),
    ttlSeconds: presence.state.isTransientActivity
        ? activityTtlSeconds
        : onlineTtlSeconds,
  );

  // -- Internals --------------------------------------------------------------------

  Future<void> _publish(PresenceState state, {String? conversationId}) async {
    if (_disposed) return;
    publishCount += 1;
    // Best-effort by design: presence is ephemeral; the TTL heals lost writes.
    await _transport.publish(
      Presence(
        userId: selfUserId,
        state: state,
        updatedAtMillis: _now(),
        conversationId: conversationId,
      ),
    );
  }

  Presence? _decode(String userId, Map<String, Object?> payload) {
    final stateName = payload['state']?.toString();
    if (stateName == null) return null;
    return Presence(
      userId: userId,
      state: PresenceState.values.firstWhere(
        (s) => s.name == stateName,
        orElse: () => PresenceState.offline,
      ),
      updatedAtMillis: (payload['updatedAtMillis'] as num?)?.toInt() ?? _now(),
      conversationId: payload['conversationId']?.toString(),
    );
  }

  void _stopTypingTimers() {
    _typingIdleTimer?.cancel();
    _typingIdleTimer = null;
    _typingConversationId = null;
    _lastTypingPublish = 0;
  }

  Future<void> dispose() async {
    _disposed = true;
    _heartbeatTimer?.cancel();
    _stopTypingTimers();
  }
}
