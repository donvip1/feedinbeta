enum GiftTier { basic, premium, exclusive }

class GiftAssetManifest {
  const GiftAssetManifest({
    required this.posterUrl,
    required this.idleUrl,
    required this.previewUrl,
    required this.sendUrl,
    required this.version,
    required this.hashes,
    required this.fallbackAssetKey,
    this.soundUrl,
  });

  final String posterUrl;
  final String idleUrl;
  final String previewUrl;
  final String sendUrl;
  final String? soundUrl;
  final int version;
  final Map<String, String> hashes;
  final String fallbackAssetKey;

  factory GiftAssetManifest.fromJson(
    Map<String, dynamic> json, {
    required String key,
  }) {
    return GiftAssetManifest(
      posterUrl: _text(json['poster_url']) ?? 'procedural://$key/poster',
      idleUrl: _text(json['idle_url']) ?? 'procedural://$key/idle',
      previewUrl: _text(json['preview_url']) ?? 'procedural://$key/preview',
      sendUrl: _text(json['send_url']) ?? 'procedural://$key/send',
      soundUrl: _text(json['sound_url']),
      version: _int(json['asset_version'], fallback: 1),
      hashes: _stringMap(json['asset_hashes']),
      fallbackAssetKey: _text(json['fallback_asset_key']) ?? key,
    );
  }

  factory GiftAssetManifest.fromSendJson(
    Map<String, dynamic> json, {
    required String key,
  }) {
    return GiftAssetManifest(
      posterUrl: _text(json['poster_url']) ?? 'procedural://$key/poster',
      idleUrl: _text(json['idle_url']) ?? 'procedural://$key/idle',
      previewUrl: _text(json['preview_url']) ?? 'procedural://$key/preview',
      sendUrl: _text(json['send_url']) ?? 'procedural://$key/send',
      soundUrl: _text(json['sound_url']),
      version: _int(json['version'], fallback: 1),
      hashes: _stringMap(json['hashes']),
      fallbackAssetKey: _text(json['fallback_asset_key']) ?? key,
    );
  }

  factory GiftAssetManifest.fallback(String key) =>
      GiftAssetManifest.fromJson(const {}, key: key);
}

class GiftCatalogItem {
  const GiftCatalogItem({
    required this.id,
    required this.key,
    required this.name,
    required this.tier,
    required this.creditCost,
    required this.assets,
    required this.minimumClientVersion,
    required this.displayOrder,
  });

  final String id;
  final String key;
  final String name;
  final GiftTier tier;
  final int creditCost;
  final GiftAssetManifest assets;
  final int minimumClientVersion;
  final int displayOrder;

  bool isCompatible({required int clientVersion}) =>
      clientVersion >= minimumClientVersion;

  factory GiftCatalogItem.fromJson(Map<String, dynamic> json) {
    final key = _text(json['key']) ?? 'gift';
    return GiftCatalogItem(
      id: _text(json['id']) ?? '',
      key: key,
      name: _text(json['name']) ?? 'Gift',
      tier: switch (_text(json['tier'])?.toLowerCase()) {
        'premium' => GiftTier.premium,
        'exclusive' => GiftTier.exclusive,
        _ => GiftTier.basic,
      },
      creditCost: _int(json['credit_cost']),
      assets: GiftAssetManifest.fromJson(json, key: key),
      minimumClientVersion: _int(json['minimum_client_version'], fallback: 1),
      displayOrder: _int(json['display_order']),
    );
  }
}

class GiftSendResult {
  const GiftSendResult({
    required this.giftRecordId,
    required this.balanceAfter,
    required this.recipientBalanceAfter,
    required this.notificationId,
    required this.recipientCreditValue,
    required this.platformFeeCredits,
    required this.assets,
  });

  final String giftRecordId;
  final int balanceAfter;
  final int recipientBalanceAfter;
  final String? notificationId;
  final int recipientCreditValue;
  final int platformFeeCredits;
  final GiftAssetManifest assets;

  factory GiftSendResult.fromJson(
    Map<String, dynamic> json, {
    required String giftKey,
  }) {
    final rawAssets = json['assets'];
    final assets = rawAssets is Map
        ? Map<String, dynamic>.from(rawAssets)
        : const <String, dynamic>{};
    return GiftSendResult(
      giftRecordId: _text(json['gift_record_id']) ?? '',
      balanceAfter: _int(json['balance_after']),
      recipientBalanceAfter: _int(json['recipient_balance_after']),
      notificationId: _text(json['notification_id']),
      recipientCreditValue: _int(json['recipient_credit_value']),
      platformFeeCredits: _int(json['platform_fee_credits']),
      assets: GiftAssetManifest.fromSendJson(assets, key: giftKey),
    );
  }
}

sealed class GiftFailure implements Exception {
  const GiftFailure(this.message);

  final String message;

  static GiftFailure fromCode(String code) => switch (code.trim()) {
    'INSUFFICIENT_CREDITS' => const InsufficientCredits(),
    'GIFT_NOT_AVAILABLE' => const GiftUnavailable(),
    'POST_NOT_GIFT_ELIGIBLE' ||
    'SELF_GIFT_NOT_ALLOWED' => const IneligiblePost(),
    'TIMEOUT_RECONCILE' => const GiftTimeout(),
    _ => UnknownGiftFailure(code),
  };

  @override
  String toString() => message;
}

class InsufficientCredits extends GiftFailure {
  const InsufficientCredits()
    : super('You need more credits to send this gift.');
}

class GiftUnavailable extends GiftFailure {
  const GiftUnavailable() : super('This gift is currently unavailable.');
}

class IneligiblePost extends GiftFailure {
  const IneligiblePost() : super('This post cannot receive gifts.');
}

class GiftTimeout extends GiftFailure {
  const GiftTimeout()
    : super('The send is still being reconciled. Please do not retry yet.');
}

class UnknownGiftFailure extends GiftFailure {
  UnknownGiftFailure(String code)
    : super('Could not send the gift${code.isEmpty ? '' : ' ($code)'}.');
}

String? _text(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

int _int(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

Map<String, String> _stringMap(Object? value) {
  if (value is! Map) return const {};
  return {
    for (final entry in value.entries)
      entry.key.toString(): entry.value.toString(),
  };
}
