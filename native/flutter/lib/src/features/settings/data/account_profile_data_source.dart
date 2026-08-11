import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

/// The account-editable slice of the current user's `profiles` row plus the
/// read-only auth email. Only columns that exist in the native core schema
/// (`supabase/migrations/20260624000100_native_core_schema.sql`) are modelled;
/// richer web fields (country/city/phone/gender/occupation/timezone) are NOT
/// present in the native `profiles` table yet and are intentionally omitted —
/// see the backend-gap note in the settings screen for the AccountSettings
/// parity fields that require shared schema changes.
class AccountProfile {
  const AccountProfile({
    required this.userId,
    this.email,
    this.displayName = '',
    this.username = '',
    this.bio = '',
    this.avatarUrl,
  });

  final String userId;
  final String? email;
  final String displayName;
  final String username;
  final String bio;
  final String? avatarUrl;

  AccountProfile copyWith({
    String? displayName,
    String? username,
    String? bio,
    String? avatarUrl,
  }) {
    return AccountProfile(
      userId: userId,
      email: email,
      displayName: displayName ?? this.displayName,
      username: username ?? this.username,
      bio: bio ?? this.bio,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }

  /// A short, display-friendly FeedIn id derived from the auth uuid, matching
  /// the web AccountSettings "FI-XXXX-XXXX" affordance.
  String get shortId {
    final compact = userId.replaceAll('-', '');
    if (compact.length < 8) return userId;
    final a = compact.substring(0, 4).toUpperCase();
    final b = compact.substring(4, 8).toUpperCase();
    return 'FI-$a-$b';
  }
}

/// Live read/write access to the account-editable `profiles` columns.
///
/// Modelled on `data/remote/social_graph_remote_data_source.dart`. Degrades to
/// null / no-op when Supabase is unconfigured or unauthenticated so hosts that
/// build the account screen without DI still render (fields simply come up
/// empty and saves are skipped).
class AccountProfileDataSource {
  const AccountProfileDataSource({required this.isConfigured});

  factory AccountProfileDataSource.autoDetect() {
    return AccountProfileDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _table = 'profiles';

  /// Storage bucket for profile imagery. Matches `ProfileRemoteDataSource`.
  static const _avatarBucket = 'post-media';

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

  User? get _authUser => _client?.auth.currentUser;

  bool get isLive => _client != null && _authUser != null;

  /// Load the current user's account profile, or null when unavailable.
  Future<AccountProfile?> load() async {
    final client = _client;
    final user = _authUser;
    if (client == null || user == null) return null;

    final row = await client
        .from(_table)
        .select('display_name, username, bio, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

    return AccountProfile(
      userId: user.id,
      email: user.email,
      displayName: (row?['display_name'] as String?) ?? '',
      username: (row?['username'] as String?) ?? '',
      bio: (row?['bio'] as String?) ?? '',
      avatarUrl: row?['avatar_url'] as String?,
    );
  }

  /// Persist editable fields. Only non-null args are written. No-op when
  /// offline. Returns true when a write was attempted.
  Future<bool> save({
    String? displayName,
    String? username,
    String? bio,
  }) async {
    final client = _client;
    final user = _authUser;
    if (client == null || user == null) return false;

    final update = <String, Object?>{
      if (displayName != null) 'display_name': displayName,
      if (username != null) 'username': username,
      if (bio != null) 'bio': bio,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    };
    if (update.length == 1) return false; // only updated_at -> nothing to do

    await client.from(_table).update(update).eq('id', user.id);
    return true;
  }

  /// Upload [file] as the signed-in user's avatar and persist the resulting
  /// public URL to `profiles.avatar_url`. Returns the new URL.
  ///
  /// Deliberately mirrors `ProfileRemoteDataSource.uploadProfileImage` — same
  /// `post-media` bucket and same `<uid>/profile/avatar-<ts>.<ext>` key — so a
  /// photo changed here is byte-for-byte equivalent to one changed from the
  /// profile tab or the web app. Keep the two in sync if either moves.
  ///
  /// Throws [StateError] when Supabase is unconfigured, nobody is signed in, or
  /// the picked file vanished, so the caller can surface an honest failure
  /// rather than a silent no-op.
  Future<String> uploadAvatar(File file) async {
    final client = _client;
    final user = _authUser;
    if (client == null || user == null) {
      throw StateError('Sign in before changing your profile photo.');
    }
    if (!file.existsSync()) {
      throw StateError('Selected image file is no longer available.');
    }

    final extension = _extensionFor(file.path);
    final storagePath =
        '${user.id}/profile/avatar-${DateTime.now().millisecondsSinceEpoch}'
        '.$extension';

    await client.storage
        .from(_avatarBucket)
        .upload(
          storagePath,
          file,
          fileOptions: FileOptions(
            contentType: _contentTypeFor(extension),
            upsert: true,
          ),
        );

    final publicUrl = client.storage
        .from(_avatarBucket)
        .getPublicUrl(storagePath);

    await client
        .from(_table)
        .update({
          'avatar_url': publicUrl,
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', user.id);

    return publicUrl;
  }

  /// Normalizes a picked file's extension to the small set the storage bucket
  /// serves, defaulting to `jpg` for anything unrecognized.
  static String _extensionFor(String path) {
    final raw = path.split('.').last.toLowerCase();
    return switch (raw) {
      'jpeg' => 'jpg',
      'jpg' || 'png' || 'webp' || 'gif' => raw,
      _ => 'jpg',
    };
  }

  static String _contentTypeFor(String extension) {
    return switch (extension.toLowerCase()) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      _ => 'image/jpeg',
    };
  }
}
