enum WalletGiftState { sent, refunded }

class WalletGiftReceipt {
  const WalletGiftReceipt({
    required this.id,
    required this.giftName,
    required this.giftKey,
    required this.senderId,
    required this.grossCredits,
    required this.recipientCredits,
    required this.state,
    required this.createdAtMillis,
    this.senderDisplayName,
    this.senderUsername,
    this.senderAvatarUrl,
    this.recipientDisplayName,
    this.recipientUsername,
  });

  factory WalletGiftReceipt.fromJson(Map<String, Object?> json) {
    final sender = _map(json['sender']);
    final recipient = _map(json['recipient']);
    final state = json['state']?.toString().toLowerCase();
    return WalletGiftReceipt(
      id: json['id']?.toString() ?? '',
      giftName: json['gift_name']?.toString() ?? 'Gift',
      giftKey: json['gift_key']?.toString() ?? '',
      senderId: json['sender_id']?.toString() ?? '',
      senderDisplayName: _text(sender?['display_name']),
      senderUsername: _text(sender?['username']),
      senderAvatarUrl: _text(sender?['avatar_url']),
      recipientDisplayName: _text(recipient?['display_name']),
      recipientUsername: _text(recipient?['username']),
      grossCredits: _integer(json['credit_cost']),
      recipientCredits: _integer(json['recipient_credit_value']),
      state: state == 'refunded'
          ? WalletGiftState.refunded
          : WalletGiftState.sent,
      createdAtMillis:
          DateTime.tryParse(
            json['created_at']?.toString() ?? '',
          )?.millisecondsSinceEpoch ??
          _integer(json['created_at_millis']),
    );
  }

  final String id;
  final String giftName;
  final String giftKey;
  final String senderId;
  final String? senderDisplayName;
  final String? senderUsername;
  final String? senderAvatarUrl;
  final String? recipientDisplayName;
  final String? recipientUsername;
  final int grossCredits;
  final int recipientCredits;
  final WalletGiftState state;
  final int createdAtMillis;

  String get senderLabel =>
      senderDisplayName ??
      (senderUsername == null ? 'Feedin user' : '@$senderUsername');

  String get recipientLabel =>
      recipientDisplayName ??
      (recipientUsername == null ? 'Feedin creator' : '@$recipientUsername');

  bool get isConverted => state == WalletGiftState.sent;
}

Map<String, Object?>? _map(Object? value) =>
    value is Map ? Map<String, Object?>.from(value) : null;

String? _text(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

int _integer(Object? value) {
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
