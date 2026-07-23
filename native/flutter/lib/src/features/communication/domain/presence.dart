/// Presence + activity states surfaced by the Presence Engine. A single
/// enum covers connection presence and transient activity so one channel and
/// one TTL policy drive the whole UI.
enum PresenceState {
  online,
  offline,
  idle,
  away,
  typing,
  recording,
  uploading,
  live,
  invisible;

  /// Transient activity states auto-clear after a short TTL; connection states
  /// persist until superseded.
  bool get isTransientActivity =>
      this == typing || this == recording || this == uploading;
}

class Presence {
  const Presence({
    required this.userId,
    required this.state,
    required this.updatedAtMillis,
    this.conversationId,
  });

  final String userId;
  final PresenceState state;
  final int updatedAtMillis;

  /// Non-null for scoped activity (e.g. typing in a specific conversation).
  final String? conversationId;

  /// Whether this record should be treated as stale (fall back to offline /
  /// clear the activity) given a TTL. Keeps a dropped "stop typing" or a lost
  /// heartbeat from sticking forever.
  bool isStale(int nowMillis, {required int ttlSeconds}) =>
      nowMillis - updatedAtMillis > ttlSeconds * 1000;

  /// The effective state after applying TTL staleness.
  PresenceState effective(int nowMillis, {required int ttlSeconds}) {
    if (!isStale(nowMillis, ttlSeconds: ttlSeconds)) return state;
    return state.isTransientActivity ? PresenceState.online : PresenceState.offline;
  }

  Presence copyWith({PresenceState? state, int? updatedAtMillis}) => Presence(
    userId: userId,
    state: state ?? this.state,
    updatedAtMillis: updatedAtMillis ?? this.updatedAtMillis,
    conversationId: conversationId,
  );
}
