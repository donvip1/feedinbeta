class AppPreferences {
  const AppPreferences({
    required this.privateAccount,
    required this.allowMessageRequests,
    required this.mediaAutoplay,
    required this.saveMediaOnWifiOnly,
  });

  static const defaults = AppPreferences(
    privateAccount: false,
    allowMessageRequests: true,
    mediaAutoplay: true,
    saveMediaOnWifiOnly: true,
  );

  final bool privateAccount;
  final bool allowMessageRequests;
  final bool mediaAutoplay;
  final bool saveMediaOnWifiOnly;

  AppPreferences copyWith({
    bool? privateAccount,
    bool? allowMessageRequests,
    bool? mediaAutoplay,
    bool? saveMediaOnWifiOnly,
  }) {
    return AppPreferences(
      privateAccount: privateAccount ?? this.privateAccount,
      allowMessageRequests:
          allowMessageRequests ?? this.allowMessageRequests,
      mediaAutoplay: mediaAutoplay ?? this.mediaAutoplay,
      saveMediaOnWifiOnly: saveMediaOnWifiOnly ?? this.saveMediaOnWifiOnly,
    );
  }

  factory AppPreferences.fromJson(Map<String, Object?> json) {
    return AppPreferences(
      privateAccount:
          json['privateAccount'] as bool? ?? defaults.privateAccount,
      allowMessageRequests:
          json['allowMessageRequests'] as bool? ??
          defaults.allowMessageRequests,
      mediaAutoplay: json['mediaAutoplay'] as bool? ?? defaults.mediaAutoplay,
      saveMediaOnWifiOnly:
          json['saveMediaOnWifiOnly'] as bool? ??
          defaults.saveMediaOnWifiOnly,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'privateAccount': privateAccount,
      'allowMessageRequests': allowMessageRequests,
      'mediaAutoplay': mediaAutoplay,
      'saveMediaOnWifiOnly': saveMediaOnWifiOnly,
    };
  }
}
