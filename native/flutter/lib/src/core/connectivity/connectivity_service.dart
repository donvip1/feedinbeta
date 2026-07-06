import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Tracks device connectivity so features can react to the app going offline.
///
/// This is a foundation service: it observes [Connectivity] and exposes a
/// simple boolean view of "are we online?". It does NOT gate any actions.
///
/// Test-safe by design: the constructor never touches platform channels
/// eagerly (they throw [MissingPluginException] in unit tests). The change
/// subscription is attached lazily on the first listener, and every plugin
/// call is guarded so failures degrade gracefully to "online". Construct with
/// `isEnabled: false` for a benign instance in tests.
class ConnectivityService {
  ConnectivityService({
    this.isEnabled = true,
    Connectivity? connectivity,
  }) : _connectivity = connectivity ?? Connectivity();

  final bool isEnabled;
  final Connectivity _connectivity;

  final _statusController = StreamController<bool>.broadcast();

  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _isOnline = true;
  bool _wired = false;

  /// Current best-known connectivity state. Defaults to `true` (online) until
  /// proven otherwise, so the app never blocks itself on an unknown state.
  bool get isOnline => _isOnline;

  /// Broadcast stream emitting `true`/`false` as connectivity changes.
  ///
  /// The underlying platform subscription is attached lazily the first time
  /// this getter is read, keeping the constructor free of platform-channel
  /// calls (important for unit tests).
  Stream<bool> get onStatusChange {
    _ensureWired();
    return _statusController.stream;
  }

  void _ensureWired() {
    if (_wired || !isEnabled) return;
    _wired = true;
    try {
      _subscription = _connectivity.onConnectivityChanged.listen(
        _handleResults,
        onError: (Object _) {
          // Degrade gracefully: assume online if the platform stream errors.
          _updateOnline(true);
        },
      );
    } catch (_) {
      // Platform channel unavailable (e.g. unit tests) — stay online.
      _updateOnline(true);
    }
  }

  /// Re-checks connectivity now and returns the resolved online state.
  ///
  /// Safe to call in any environment: if the platform channel is unavailable
  /// the current best-known state is returned unchanged.
  Future<bool> refresh() async {
    if (!isEnabled) return _isOnline;
    _ensureWired();
    try {
      final results = await _connectivity.checkConnectivity();
      _handleResults(results);
    } catch (_) {
      // Platform channel unavailable — keep the best-known state.
    }
    return _isOnline;
  }

  void _handleResults(List<ConnectivityResult> results) {
    // v6 returns a list; online if any interface is not `none`.
    // An empty list is treated as offline as a defensive fallback.
    final online =
        results.any((result) => result != ConnectivityResult.none);
    _updateOnline(online);
  }

  void _updateOnline(bool online) {
    if (online == _isOnline) return;
    _isOnline = online;
    if (!_statusController.isClosed) {
      _statusController.add(online);
    }
  }

  void dispose() {
    _subscription?.cancel();
    _subscription = null;
    _statusController.close();
  }
}
