import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureSessionStore {
  const SecureSessionStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _storage = storage;

  static const _accessTokenKey = 'feedin.access_token';
  static const _refreshTokenKey = 'feedin.refresh_token';

  /// Epoch millis of the last time the session was seen active (sign-in or a
  /// successful restore). Backs the app-level 7-day inactivity logout.
  static const _lastActiveKey = 'feedin.last_active_ms';

  final FlutterSecureStorage _storage;

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await saveLastActive(DateTime.now());
  }

  /// Stamp "now" (or [when]) as the last-active moment. Called on sign-in and on
  /// every successful session restore so the 7-day window slides with use.
  Future<void> saveLastActive([DateTime? when]) async {
    final millis = (when ?? DateTime.now()).millisecondsSinceEpoch;
    await _storage.write(key: _lastActiveKey, value: '$millis');
  }

  /// The last-active timestamp, or null if never stamped (e.g. legacy session
  /// saved before this key existed).
  Future<DateTime?> readLastActive() async {
    final raw = await _storage.read(key: _lastActiveKey);
    if (raw == null) return null;
    final millis = int.tryParse(raw);
    if (millis == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(millis);
  }

  Future<StoredSession?> readSession() async {
    final accessToken = await _storage.read(key: _accessTokenKey);
    final refreshToken = await _storage.read(key: _refreshTokenKey);

    if (accessToken == null || refreshToken == null) return null;

    return StoredSession(accessToken: accessToken, refreshToken: refreshToken);
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _lastActiveKey);
  }
}

class StoredSession {
  const StoredSession({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}
