/// Locally-persisted, device-scoped preferences.
///
/// Persisted verbatim via the app's `PreferencesRepositoryContract` (a simple
/// JSON blob). Every field is nullable-tolerant through [fromJson] so adding a
/// new key never breaks an older stored payload — unknown keys fall back to
/// [defaults]. These are DEVICE preferences (things that make sense per install
/// or that have no server table yet); server-backed settings (notification
/// preferences, profile fields, block lists) live behind their own Supabase
/// data sources under `settings/data/` and are NOT stored here.
///
/// Web parity references:
///   - src/pages/PrivacySettings.tsx     (private account, activity/read
///     receipts, messages-from-strangers — mirrored locally until the
///     `privacy_settings` table exists in the native schema)
///   - src/pages/Settings.tsx            (Dark Mode toggle -> [darkMode])
///   - src/components/settings/CacheSettings.tsx (Wi-Fi-only media caching)
class AppPreferences {
  const AppPreferences({
    required this.privateAccount,
    required this.allowMessageRequests,
    required this.mediaAutoplay,
    required this.saveMediaOnWifiOnly,
    required this.showOnlineStatus,
    required this.showActivityStatus,
    required this.showReadReceipts,
    required this.allowFriendRequests,
    required this.darkMode,
    required this.reduceMotion,
    required this.language,
  });

  static const defaults = AppPreferences(
    privateAccount: false,
    allowMessageRequests: true,
    mediaAutoplay: true,
    saveMediaOnWifiOnly: true,
    showOnlineStatus: true,
    showActivityStatus: true,
    showReadReceipts: true,
    allowFriendRequests: true,
    darkMode: true,
    reduceMotion: false,
    language: 'en',
  );

  // Privacy (web PrivacySettings.tsx).
  final bool privateAccount;
  final bool allowMessageRequests;
  final bool showOnlineStatus;
  final bool showActivityStatus;
  final bool showReadReceipts;
  final bool allowFriendRequests;

  // Media / data.
  final bool mediaAutoplay;
  final bool saveMediaOnWifiOnly;

  // Appearance / language (web Settings.tsx Dark Mode + LanguageSettings).
  final bool darkMode;
  final bool reduceMotion;
  final String language;

  AppPreferences copyWith({
    bool? privateAccount,
    bool? allowMessageRequests,
    bool? mediaAutoplay,
    bool? saveMediaOnWifiOnly,
    bool? showOnlineStatus,
    bool? showActivityStatus,
    bool? showReadReceipts,
    bool? allowFriendRequests,
    bool? darkMode,
    bool? reduceMotion,
    String? language,
  }) {
    return AppPreferences(
      privateAccount: privateAccount ?? this.privateAccount,
      allowMessageRequests: allowMessageRequests ?? this.allowMessageRequests,
      mediaAutoplay: mediaAutoplay ?? this.mediaAutoplay,
      saveMediaOnWifiOnly: saveMediaOnWifiOnly ?? this.saveMediaOnWifiOnly,
      showOnlineStatus: showOnlineStatus ?? this.showOnlineStatus,
      showActivityStatus: showActivityStatus ?? this.showActivityStatus,
      showReadReceipts: showReadReceipts ?? this.showReadReceipts,
      allowFriendRequests: allowFriendRequests ?? this.allowFriendRequests,
      darkMode: darkMode ?? this.darkMode,
      reduceMotion: reduceMotion ?? this.reduceMotion,
      language: language ?? this.language,
    );
  }

  factory AppPreferences.fromJson(Map<String, Object?> json) {
    bool boolOr(String key, bool fallback) => json[key] as bool? ?? fallback;
    return AppPreferences(
      privateAccount: boolOr('privateAccount', defaults.privateAccount),
      allowMessageRequests: boolOr(
        'allowMessageRequests',
        defaults.allowMessageRequests,
      ),
      mediaAutoplay: boolOr('mediaAutoplay', defaults.mediaAutoplay),
      saveMediaOnWifiOnly: boolOr(
        'saveMediaOnWifiOnly',
        defaults.saveMediaOnWifiOnly,
      ),
      showOnlineStatus: boolOr('showOnlineStatus', defaults.showOnlineStatus),
      showActivityStatus: boolOr(
        'showActivityStatus',
        defaults.showActivityStatus,
      ),
      showReadReceipts: boolOr('showReadReceipts', defaults.showReadReceipts),
      allowFriendRequests: boolOr(
        'allowFriendRequests',
        defaults.allowFriendRequests,
      ),
      darkMode: boolOr('darkMode', defaults.darkMode),
      reduceMotion: boolOr('reduceMotion', defaults.reduceMotion),
      language: json['language'] as String? ?? defaults.language,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'privateAccount': privateAccount,
      'allowMessageRequests': allowMessageRequests,
      'mediaAutoplay': mediaAutoplay,
      'saveMediaOnWifiOnly': saveMediaOnWifiOnly,
      'showOnlineStatus': showOnlineStatus,
      'showActivityStatus': showActivityStatus,
      'showReadReceipts': showReadReceipts,
      'allowFriendRequests': allowFriendRequests,
      'darkMode': darkMode,
      'reduceMotion': reduceMotion,
      'language': language,
    };
  }
}
