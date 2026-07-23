import 'dart:async';

/// Connection state of the single physical realtime link.
enum RealtimeConnectionState { disconnected, connecting, connected, reconnecting }

/// One realtime event tagged with the logical [topic] it belongs to.
class RealtimeEvent {
  const RealtimeEvent(this.topic, this.payload);
  final String topic;
  final Map<String, Object?> payload;
}

/// Provider-agnostic realtime transport. The Supabase adapter (added in a later
/// subsystem) implements this; tests use a fake. This is the ONLY seam through
/// which realtime provider SDKs enter the platform.
abstract interface class RealtimeTransport {
  Future<void> connect();
  Future<void> disconnect();
  Stream<RealtimeConnectionState> get connectionStates;

  /// Physically join [topic]; returns the raw event stream for it.
  Stream<RealtimeEvent> join(String topic);

  /// Physically leave [topic].
  Future<void> leave(String topic);
}

/// A handle a logical subscriber holds; [cancel] releases its interest and, when
/// it's the last one for a topic, tears the physical subscription down.
class RealtimeSubscription {
  RealtimeSubscription._(this._onCancel);
  final Future<void> Function() _onCancel;
  bool _cancelled = false;

  Future<void> cancel() async {
    if (_cancelled) return;
    _cancelled = true;
    await _onCancel();
  }
}

/// Fans out ONE physical realtime connection to many logical subscribers.
///
/// The old stack opened four uncoordinated channels (whole-table messages,
/// per-conversation presence/typing/receipts, interactions, legacy polling).
/// This multiplexer replaces all of them: N subscribers to the same [topic]
/// share ONE physical `join`, and the physical `leave` fires only when the last
/// subscriber cancels (ref-counted). One connection, one reconnect policy.
class RealtimeMultiplexer {
  RealtimeMultiplexer(this._transport);

  final RealtimeTransport _transport;
  final Map<String, _TopicGroup> _groups = {};

  Stream<RealtimeConnectionState> get connectionStates =>
      _transport.connectionStates;

  Future<void> start() => _transport.connect();

  Future<void> stop() async {
    for (final group in _groups.values.toList()) {
      await group._dispose();
    }
    _groups.clear();
    await _transport.disconnect();
  }

  /// How many physical topic subscriptions are currently open (for tests/metrics).
  int get activeTopicCount => _groups.length;

  int subscriberCount(String topic) => _groups[topic]?._refCount ?? 0;

  /// Subscribe [onEvent] to [topic]. The first subscriber triggers a single
  /// physical [RealtimeTransport.join]; later subscribers just attach.
  RealtimeSubscription subscribe(
    String topic,
    void Function(RealtimeEvent event) onEvent,
  ) {
    final group = _groups.putIfAbsent(
      topic,
      () => _TopicGroup(topic, _transport.join(topic)),
    );
    return group._add(onEvent, onLastCancel: () async {
      await group._dispose();
      _groups.remove(topic);
      await _transport.leave(topic);
    });
  }
}

class _TopicGroup {
  _TopicGroup(this.topic, Stream<RealtimeEvent> source) {
    _sourceSub = source.listen((event) {
      // Fan out to every current logical subscriber.
      for (final sink in List<void Function(RealtimeEvent)>.of(_sinks)) {
        sink(event);
      }
    });
  }

  final String topic;
  late final StreamSubscription<RealtimeEvent> _sourceSub;
  final List<void Function(RealtimeEvent)> _sinks = [];

  int get _refCount => _sinks.length;

  RealtimeSubscription _add(
    void Function(RealtimeEvent) sink, {
    required Future<void> Function() onLastCancel,
  }) {
    _sinks.add(sink);
    return RealtimeSubscription._(() async {
      _sinks.remove(sink);
      if (_sinks.isEmpty) await onLastCancel();
    });
  }

  Future<void> _dispose() async {
    _sinks.clear();
    await _sourceSub.cancel();
  }
}
