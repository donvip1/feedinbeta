/// Hybrid Logical Clock (HLC) — the ordering primitive for the communication
/// platform.
///
/// Wall-clock time alone can't order events across devices (clock skew, offline
/// sends). An HLC combines a physical millisecond reading with a monotonic
/// [counter] and a [nodeId] tiebreak so every event has a globally-comparable,
/// causally-consistent timestamp. This is what lets two devices — and offline
/// queued messages — converge on the same order without a central sequencer.
///
/// Pure Dart, no platform dependencies. Deterministic and injectable for tests.
class HybridTimestamp implements Comparable<HybridTimestamp> {
  const HybridTimestamp({
    required this.millis,
    required this.counter,
    required this.nodeId,
  });

  /// Physical time component (ms since epoch).
  final int millis;

  /// Monotonic tiebreak within the same [millis].
  final int counter;

  /// Stable per-device id; final tiebreak so distinct devices never collide.
  final String nodeId;

  @override
  int compareTo(HybridTimestamp other) {
    if (millis != other.millis) return millis.compareTo(other.millis);
    if (counter != other.counter) return counter.compareTo(other.counter);
    return nodeId.compareTo(other.nodeId);
  }

  bool operator >(HybridTimestamp other) => compareTo(other) > 0;
  bool operator <(HybridTimestamp other) => compareTo(other) < 0;

  /// Compact wire form `millis:counter:nodeId`.
  String encode() => '$millis:$counter:$nodeId';

  static HybridTimestamp? tryDecode(String? value) {
    if (value == null) return null;
    final parts = value.split(':');
    if (parts.length < 3) return null;
    final millis = int.tryParse(parts[0]);
    final counter = int.tryParse(parts[1]);
    if (millis == null || counter == null) return null;
    // nodeId may itself contain ':' — rejoin the remainder.
    final nodeId = parts.sublist(2).join(':');
    return HybridTimestamp(millis: millis, counter: counter, nodeId: nodeId);
  }

  @override
  bool operator ==(Object other) =>
      other is HybridTimestamp &&
      other.millis == millis &&
      other.counter == counter &&
      other.nodeId == nodeId;

  @override
  int get hashCode => Object.hash(millis, counter, nodeId);

  @override
  String toString() => 'HLC(${encode()})';
}

/// Generates monotonically non-decreasing [HybridTimestamp]s for one device and
/// merges remote timestamps to preserve causality.
///
/// [nowMillis] is injectable so tests are fully deterministic.
class HybridClock {
  HybridClock(this.nodeId, {int Function()? nowMillis})
    : _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch);

  final String nodeId;
  final int Function() _now;

  int _lastMillis = 0;
  int _counter = 0;

  /// Issue a timestamp for a locally-originated event.
  HybridTimestamp issueLocal() {
    final wall = _now();
    if (wall > _lastMillis) {
      _lastMillis = wall;
      _counter = 0;
    } else {
      // Wall clock didn't advance (or went backwards) — bump the counter so the
      // timestamp still strictly increases.
      _counter += 1;
    }
    return HybridTimestamp(
      millis: _lastMillis,
      counter: _counter,
      nodeId: nodeId,
    );
  }

  /// Merge a [remote] timestamp on receive, advancing local state so subsequent
  /// local events sort after everything observed so far.
  HybridTimestamp observe(HybridTimestamp remote) {
    final wall = _now();
    final maxMillis = [
      wall,
      _lastMillis,
      remote.millis,
    ].reduce((a, b) => a > b ? a : b);

    if (maxMillis == _lastMillis && maxMillis == remote.millis) {
      _counter = (_counter > remote.counter ? _counter : remote.counter) + 1;
    } else if (maxMillis == _lastMillis) {
      _counter += 1;
    } else if (maxMillis == remote.millis) {
      _counter = remote.counter + 1;
    } else {
      _counter = 0;
    }
    _lastMillis = maxMillis;
    return HybridTimestamp(
      millis: _lastMillis,
      counter: _counter,
      nodeId: nodeId,
    );
  }
}
