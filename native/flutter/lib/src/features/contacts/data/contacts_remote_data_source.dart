import 'package:supabase_flutter/supabase_flutter.dart';

/// A feedIn user surfaced by contact matching: the profile fields the "On
/// feedIn" list needs to render a row + a Follow button.
///
/// Returned by [ContactsRemoteDataSource.matchContacts], mapped 1:1 from the
/// `match_contacts` RPC rows `{id, username, display_name, avatar_url}`.
class MatchedContact {
  const MatchedContact({
    required this.id,
    required this.username,
    this.displayName,
    this.avatarUrl,
  });

  final String id;
  final String username;
  final String? displayName;
  final String? avatarUrl;

  /// A human label for the row, preferring the display name and falling back to
  /// the @handle (or a generic placeholder if somehow both are blank).
  String get title {
    final name = displayName?.trim();
    if (name != null && name.isNotEmpty) return name;
    if (username.isNotEmpty) return '@$username';
    return 'feedIn user';
  }

  static MatchedContact? fromRow(Map<dynamic, dynamic> row) {
    final id = row['id']?.toString();
    if (id == null || id.isEmpty) return null;

    String? text(String key) {
      final value = row[key]?.toString();
      if (value != null && value.isNotEmpty) return value;
      return null;
    }

    return MatchedContact(
      id: id,
      username: text('username') ?? '',
      displayName: text('display_name'),
      avatarUrl: text('avatar_url'),
    );
  }
}

/// Live backend access for the "find friends from contacts" feature.
///
/// Talks to two deployed RPCs (privacy-preserving: only opaque phone hashes
/// ever leave the device):
///   * `set_my_phone_hash(p_hash text)` — registers the CURRENT user's own
///     phone hash so others can discover them.
///   * `match_contacts(p_hashes text[])` — returns feedIn users whose stored
///     `phone_hash` is in the supplied batch (excludes self).
///
/// Following a matched user is delegated to `SocialGraphRemoteDataSource.follow`
/// by the screen — this source deliberately does not duplicate the follow graph.
///
/// Modelled on [SocialGraphRemoteDataSource] / the other feature sources: every
/// method degrades gracefully when Supabase is unconfigured, there is no auth
/// session, or the RPC is unavailable — writes become no-ops and reads return
/// empty — so the screen using [autoDetect] builds and runs offline.
class ContactsRemoteDataSource {
  const ContactsRemoteDataSource({required this.isConfigured});

  /// Convenience factory for hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton was initialised. Mirrors
  /// [SocialGraphRemoteDataSource.autoDetect].
  factory ContactsRemoteDataSource.autoDetect() {
    return ContactsRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  /// Postgres arrays / RPC payloads should stay bounded; cap the batch we send
  /// to `match_contacts` so a huge phone book cannot blow the request size.
  static const int maxHashesPerBatch = 2000;

  static const String _setHashRpc = 'set_my_phone_hash';
  static const String _matchRpc = 'match_contacts';

  static bool _supabaseAvailable() {
    try {
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  String? get currentUserId => _client?.auth.currentUser?.id;

  /// Whether a live backend + signed-in user are available. The UI uses this to
  /// gate the follow / register affordances and choose honest empty copy.
  bool get hasSession => _client != null && currentUserId != null;

  /// Registers the current user's OWN phone hash so other users who have this
  /// number in their contacts can discover them. No-op when offline / signed
  /// out, or when [hash] is empty (junk number). Returns whether it succeeded.
  Future<bool> registerMyPhoneHash(String hash) async {
    final client = _client;
    if (client == null || currentUserId == null || hash.isEmpty) return false;

    try {
      await client.rpc<void>(_setHashRpc, params: {'p_hash': hash});
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Matches [hashes] against feedIn users' stored phone hashes, returning the
  /// (self-excluded) profiles that share a number with the phone book.
  ///
  /// The input is deduped and capped at [maxHashesPerBatch] before the call.
  /// Returns an empty list when offline / signed out / on any RPC error.
  Future<List<MatchedContact>> matchContacts(List<String> hashes) async {
    final client = _client;
    if (client == null || currentUserId == null) return const [];

    final batch = hashes.toSet().where((h) => h.isNotEmpty).toList();
    if (batch.isEmpty) return const [];
    final capped = batch.length > maxHashesPerBatch
        ? batch.sublist(0, maxHashesPerBatch)
        : batch;

    try {
      final rows = await client.rpc<dynamic>(
        _matchRpc,
        params: {'p_hashes': capped},
      );
      if (rows is! List) return const [];
      return [
        for (final row in rows.whereType<Map>())
          if (MatchedContact.fromRow(row) case final contact?) contact,
      ];
    } catch (_) {
      return const [];
    }
  }
}
