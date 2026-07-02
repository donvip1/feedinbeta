import 'package:supabase_flutter/supabase_flutter.dart';

/// Client contract for the server-authoritative username policy
/// (migration 20260702200000): standard users may set a username once, premium
/// users may change it every 90 days. The RPCs are the real enforcement; this
/// only surfaces state + performs the change.
///
/// Auto-detects the Supabase singleton and degrades gracefully when the backend
/// is unconfigured (offline/demo builds) so the editor still renders.
class UsernamePolicyDataSource {
  const UsernamePolicyDataSource({required this.isConfigured});

  factory UsernamePolicyDataSource.autoDetect() {
    var configured = false;
    try {
      // Throws if Supabase.initialize was never called.
      Supabase.instance.client;
      configured = true;
    } catch (_) {
      configured = false;
    }
    return UsernamePolicyDataSource(isConfigured: configured);
  }

  final bool isConfigured;

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  /// Reads the current change eligibility. Returns null when unconfigured.
  Future<UsernameChangeStatus?> fetchStatus() async {
    final client = _client;
    if (client == null) return null;
    try {
      final data = await client.rpc<dynamic>('username_change_status');
      if (data is Map) {
        return UsernameChangeStatus.fromJson(Map<String, dynamic>.from(data));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Attempts to change the username. Returns a [UsernameChangeResult]; on a
  /// server rejection the [UsernameChangeResult.error] carries the reason
  /// (already user-friendly — raised by the RPC).
  Future<UsernameChangeResult> changeUsername(String username) async {
    final client = _client;
    if (client == null) {
      return const UsernameChangeResult.failure(
        'You need to be online to change your username.',
      );
    }
    try {
      final data = await client.rpc<dynamic>(
        'change_username',
        params: {'p_username': username},
      );
      if (data is Map && data['username'] != null) {
        return UsernameChangeResult.success(data['username'].toString());
      }
      return const UsernameChangeResult.failure(
        'Could not change your username. Please try again.',
      );
    } on PostgrestException catch (e) {
      return UsernameChangeResult.failure(_clean(e.message));
    } catch (_) {
      return const UsernameChangeResult.failure(
        'Could not change your username. Please try again.',
      );
    }
  }

  /// Strips the Postgres "ERROR: ... " prefix some drivers include.
  static String _clean(String message) {
    final idx = message.indexOf(':');
    if (message.toLowerCase().startsWith('error') && idx != -1) {
      return message.substring(idx + 1).trim();
    }
    return message.trim();
  }
}

/// Snapshot of the user's username-change eligibility from the server.
class UsernameChangeStatus {
  const UsernameChangeStatus({
    required this.canChange,
    required this.reason,
    required this.isPremium,
    required this.daysRemaining,
    this.nextChangeAt,
  });

  final bool canChange;

  /// One of: first_time, locked_standard, cooldown, premium_eligible,
  /// not_authenticated.
  final String reason;
  final bool isPremium;
  final int daysRemaining;
  final DateTime? nextChangeAt;

  bool get isFirstTime => reason == 'first_time';
  bool get isLockedStandard => reason == 'locked_standard';
  bool get isCooldown => reason == 'cooldown';

  factory UsernameChangeStatus.fromJson(Map<String, dynamic> json) {
    DateTime? next;
    final raw = json['next_change_at'];
    if (raw is String && raw.isNotEmpty) next = DateTime.tryParse(raw);
    return UsernameChangeStatus(
      canChange: json['can_change'] == true,
      reason: json['reason']?.toString() ?? '',
      isPremium: json['is_premium'] == true,
      daysRemaining: (json['days_remaining'] is num)
          ? (json['days_remaining'] as num).round()
          : 0,
      nextChangeAt: next,
    );
  }
}

/// Result of a change attempt.
class UsernameChangeResult {
  const UsernameChangeResult.success(this.username)
    : error = null,
      ok = true;
  const UsernameChangeResult.failure(this.error)
    : username = null,
      ok = false;

  final bool ok;
  final String? username;
  final String? error;
}
