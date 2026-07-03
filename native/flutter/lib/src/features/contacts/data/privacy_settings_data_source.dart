import 'package:supabase_flutter/supabase_flutter.dart';

/// Who can see a given piece of profile information — WhatsApp-style privacy.
///
/// Maps to the `'everyone' | 'friends' | 'nobody'` text values stored in the
/// `privacy_*` columns on `profiles`.
enum ContactPrivacyVisibility {
  everyone('everyone', 'Everyone'),
  friends('friends', 'My friends'),
  nobody('nobody', 'Nobody');

  const ContactPrivacyVisibility(this.value, this.label);

  /// The value persisted in the DB column.
  final String value;

  /// The human label shown in the picker.
  final String label;

  /// Parse a stored column value, defaulting to [friends] (the column default)
  /// for null / unknown values.
  static ContactPrivacyVisibility fromValue(Object? raw) {
    final value = raw?.toString();
    for (final option in values) {
      if (option.value == value) return option;
    }
    return ContactPrivacyVisibility.friends;
  }
}

/// The four contact-privacy settings for the current user, one per column.
class ContactPrivacySettings {
  const ContactPrivacySettings({
    this.lastSeen = ContactPrivacyVisibility.friends,
    this.photo = ContactPrivacyVisibility.friends,
    this.status = ContactPrivacyVisibility.friends,
    this.about = ContactPrivacyVisibility.friends,
  });

  final ContactPrivacyVisibility lastSeen;
  final ContactPrivacyVisibility photo;
  final ContactPrivacyVisibility status;
  final ContactPrivacyVisibility about;

  /// The `profiles` columns this maps to. Also the select list used on read.
  static const String colLastSeen = 'privacy_last_seen';
  static const String colPhoto = 'privacy_photo';
  static const String colStatus = 'privacy_status';
  static const String colAbout = 'privacy_about';

  static const ContactPrivacySettings defaults = ContactPrivacySettings();

  factory ContactPrivacySettings.fromRow(Map<dynamic, dynamic> row) {
    return ContactPrivacySettings(
      lastSeen: ContactPrivacyVisibility.fromValue(row[colLastSeen]),
      photo: ContactPrivacyVisibility.fromValue(row[colPhoto]),
      status: ContactPrivacyVisibility.fromValue(row[colStatus]),
      about: ContactPrivacyVisibility.fromValue(row[colAbout]),
    );
  }

  ContactPrivacySettings copyWith({
    ContactPrivacyVisibility? lastSeen,
    ContactPrivacyVisibility? photo,
    ContactPrivacyVisibility? status,
    ContactPrivacyVisibility? about,
  }) {
    return ContactPrivacySettings(
      lastSeen: lastSeen ?? this.lastSeen,
      photo: photo ?? this.photo,
      status: status ?? this.status,
      about: about ?? this.about,
    );
  }
}

/// Live read/write access to the four `privacy_*` columns on `profiles`.
///
/// Modelled on [SocialGraphRemoteDataSource] / the settings data sources: reads
/// return [ContactPrivacySettings.defaults] and writes are no-ops when Supabase
/// is unconfigured or there is no authenticated user, so the screen using
/// [autoDetect] builds and runs offline.
class PrivacySettingsDataSource {
  const PrivacySettingsDataSource({required this.isConfigured});

  factory PrivacySettingsDataSource.autoDetect() {
    return PrivacySettingsDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const String _profilesTable = 'profiles';

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

  String? get _currentUserId => _client?.auth.currentUser?.id;

  /// Whether a live backend is reachable for this source right now. The UI uses
  /// this to choose between a "synced" and a local-only notice.
  bool get isLive => _client != null && _currentUserId != null;

  /// Loads the four privacy columns for the current user, or defaults when
  /// unavailable / not yet set.
  Future<ContactPrivacySettings> load() async {
    final client = _client;
    final userId = _currentUserId;
    if (client == null || userId == null) {
      return ContactPrivacySettings.defaults;
    }

    final row = await client
        .from(_profilesTable)
        .select(
          '${ContactPrivacySettings.colLastSeen}, '
          '${ContactPrivacySettings.colPhoto}, '
          '${ContactPrivacySettings.colStatus}, '
          '${ContactPrivacySettings.colAbout}',
        )
        .eq('id', userId)
        .maybeSingle();
    if (row == null) return ContactPrivacySettings.defaults;
    return ContactPrivacySettings.fromRow(row);
  }

  /// Updates a single privacy [column] to [visibility] for the current user.
  /// No-op when offline / signed out. Returns whether the write was attempted.
  Future<bool> updateColumn(
    String column,
    ContactPrivacyVisibility visibility,
  ) async {
    final client = _client;
    final userId = _currentUserId;
    if (client == null || userId == null) return false;

    await client
        .from(_profilesTable)
        .update({column: visibility.value})
        .eq('id', userId);
    return true;
  }
}
