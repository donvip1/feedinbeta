/// Domain models for the P2P credit marketplace.
///
/// These mirror the LIVE Supabase schema in
/// `supabase/migrations/20260624000500_native_money_p2p_schema.sql` — NOT the
/// web component prop shapes, which reference several columns that do not exist
/// on the live tables (e.g. `p2p_listings.price_usd`, `min_amount`,
/// `payment_window_minutes`, `terms`, `currency_code`, `credits_per_dollar`).
/// The live `p2p_listings` table stores `price_cents` + `currency`, so the
/// native module works in cents and exposes a derived USD/major-unit view.
///
/// Where the web needs richer data than the live schema provides, the extra
/// fields are surfaced here as optional/nullable and documented as backend gaps
/// so the UI can render gracefully once the schema catches up.
library;

/// A P2P party (seller/buyer/sender) resolved from an embedded `profiles` row.
class P2PParty {
  const P2PParty({
    required this.userId,
    this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String userId;
  final String? displayName;
  final String? username;
  final String? avatarUrl;

  /// Best human label for this party.
  String get label {
    final name = displayName?.trim();
    if (name != null && name.isNotEmpty) return name;
    final handle = username?.trim();
    if (handle != null && handle.isNotEmpty) return '@$handle';
    return 'feedIn user';
  }

  static P2PParty? fromEmbedded(Object? profile, {String? fallbackId}) {
    if (profile is Map) {
      final id = profile['id']?.toString() ?? fallbackId;
      if (id == null) return null;
      return P2PParty(
        userId: id,
        displayName: profile['display_name']?.toString(),
        username: profile['username']?.toString(),
        avatarUrl: profile['avatar_url']?.toString(),
      );
    }
    if (fallbackId != null) return P2PParty(userId: fallbackId);
    return null;
  }
}

/// An active sell listing on the marketplace.
///
/// Column mapping to live `p2p_listings`: `id`, `seller_id`, `credits_amount`,
/// `price_cents`, `currency`, `status`, `created_at`.
class P2PListing {
  const P2PListing({
    required this.id,
    required this.sellerId,
    required this.creditsAmount,
    required this.priceCents,
    required this.currency,
    required this.status,
    required this.createdAtMillis,
    this.seller,
  });

  final String id;
  final String sellerId;
  final int creditsAmount;
  final int priceCents;
  final String currency;
  final String status;
  final int createdAtMillis;
  final P2PParty? seller;

  /// Price in the listing's major currency unit (e.g. NGN, USD).
  double get price => priceCents / 100;

  /// Credits per one major currency unit (the "rate"). 0 when price is 0.
  int get creditsPerUnit => price > 0 ? (creditsAmount / price).round() : 0;

  bool get isActive => status == 'active';

  factory P2PListing.fromJson(Map<String, Object?> json) {
    return P2PListing(
      id: json['id'].toString(),
      sellerId: json['seller_id'].toString(),
      creditsAmount: _int(json['credits_amount']),
      priceCents: _int(json['price_cents']),
      currency: json['currency']?.toString() ?? 'NGN',
      status: json['status']?.toString() ?? 'active',
      createdAtMillis: _millis(json['created_at']),
      seller: P2PParty.fromEmbedded(
        json['seller'] ?? json['profiles'],
        fallbackId: json['seller_id']?.toString(),
      ),
    );
  }
}

/// A P2P transaction (an order between a buyer and seller).
///
/// Maps to live `p2p_transactions`: `id`, `listing_id`, `buyer_id`,
/// `seller_id`, `credits_amount`, `price_cents`, `currency`, `status`,
/// `escrow_locked`, `expires_at`, `created_at`.
class P2PTransaction {
  const P2PTransaction({
    required this.id,
    required this.buyerId,
    required this.sellerId,
    required this.creditsAmount,
    required this.priceCents,
    required this.currency,
    required this.status,
    required this.escrowLocked,
    required this.createdAtMillis,
    this.listingId,
    this.expiresAtMillis,
    this.buyer,
    this.seller,
  });

  final String id;
  final String? listingId;
  final String buyerId;
  final String sellerId;
  final int creditsAmount;
  final int priceCents;
  final String currency;
  final String status;
  final bool escrowLocked;
  final int createdAtMillis;
  final int? expiresAtMillis;
  final P2PParty? buyer;
  final P2PParty? seller;

  double get price => priceCents / 100;

  bool get isTerminal =>
      status == 'completed' || status == 'cancelled' || status == 'refunded';

  factory P2PTransaction.fromJson(Map<String, Object?> json) {
    return P2PTransaction(
      id: json['id'].toString(),
      listingId: json['listing_id']?.toString(),
      buyerId: json['buyer_id'].toString(),
      sellerId: json['seller_id'].toString(),
      creditsAmount: _int(json['credits_amount']),
      priceCents: _int(json['price_cents']),
      currency: json['currency']?.toString() ?? 'NGN',
      status: json['status']?.toString() ?? 'pending',
      escrowLocked: json['escrow_locked'] == true,
      createdAtMillis: _millis(json['created_at']),
      expiresAtMillis: _nullableMillis(json['expires_at']),
      buyer: P2PParty.fromEmbedded(
        json['buyer'],
        fallbackId: json['buyer_id']?.toString(),
      ),
      seller: P2PParty.fromEmbedded(
        json['seller'],
        fallbackId: json['seller_id']?.toString(),
      ),
    );
  }
}

/// A saved bank/payout method. Maps to `p2p_payment_methods`.
class P2PPaymentMethod {
  const P2PPaymentMethod({
    required this.id,
    required this.methodType,
    required this.countryCode,
    required this.isDefault,
    required this.isActive,
    this.accountName,
    this.accountNumber,
    this.bankName,
    this.bankCode,
  });

  final String id;
  final String methodType;
  final String countryCode;
  final bool isDefault;
  final bool isActive;
  final String? accountName;
  final String? accountNumber;
  final String? bankName;
  final String? bankCode;

  /// Account number masked to the last four digits for display.
  String get maskedAccountNumber {
    final number = accountNumber ?? '';
    if (number.length <= 4) return number;
    return '****${number.substring(number.length - 4)}';
  }

  factory P2PPaymentMethod.fromJson(Map<String, Object?> json) {
    return P2PPaymentMethod(
      id: json['id'].toString(),
      methodType: json['method_type']?.toString() ?? 'bank',
      countryCode: json['country_code']?.toString() ?? 'NG',
      isDefault: json['is_default'] == true,
      isActive: json['is_active'] != false,
      accountName: json['account_name']?.toString(),
      accountNumber: json['account_number']?.toString(),
      bankName: json['bank_name']?.toString(),
      bankCode: json['bank_code']?.toString(),
    );
  }
}

/// The current user's P2P trading eligibility.
///
/// Maps to live `p2p_user_eligibility` (`can_buy`, `can_sell`,
/// `first_p2p_trade_completed`, `completed_trades`, `dispute_count`) enriched
/// with the derived flags the UI needs. The web hook also reads
/// `has_purchased_pack`, `is_reseller`, `total_volume_usd`,
/// `buyer_cancellation_count`, `buyer_ban_until` which do NOT exist on the live
/// table — those are treated as unknown (defaults) here and flagged as a gap.
class P2PEligibility {
  const P2PEligibility({
    required this.canBuy,
    required this.canSell,
    required this.hasPaymentMethod,
    required this.hasCompletedFirstTrade,
    required this.completedTrades,
    required this.disputeCount,
    required this.userCountry,
    required this.reasons,
  });

  final bool canBuy;
  final bool canSell;
  final bool hasPaymentMethod;
  final bool hasCompletedFirstTrade;
  final int completedTrades;
  final int disputeCount;
  final String? userCountry;
  final List<String> reasons;

  /// Whether the user can create sell listings right now.
  bool get canTrade => hasPaymentMethod && (userCountry?.isNotEmpty ?? false);

  bool get requiresPaymentSetup => !hasPaymentMethod;

  /// Minimum trade size in credits, based on first-trade status.
  int get minTradeAmount => hasCompletedFirstTrade ? 100 : 500;

  /// Neutral default used before eligibility loads or when signed out.
  static const P2PEligibility unknown = P2PEligibility(
    canBuy: false,
    canSell: false,
    hasPaymentMethod: false,
    hasCompletedFirstTrade: false,
    completedTrades: 0,
    disputeCount: 0,
    userCountry: null,
    reasons: ['Complete your P2P setup to start trading'],
  );
}

/// A single chat message inside a transaction thread.
/// Maps to `p2p_chat_messages` (`id`, `transaction_id`, `sender_id`,
/// `content`, `created_at`).
class P2PChatMessage {
  const P2PChatMessage({
    required this.id,
    required this.transactionId,
    required this.senderId,
    required this.content,
    required this.createdAtMillis,
    this.sender,
  });

  final String id;
  final String transactionId;
  final String senderId;
  final String content;
  final int createdAtMillis;
  final P2PParty? sender;

  factory P2PChatMessage.fromJson(Map<String, Object?> json) {
    return P2PChatMessage(
      id: json['id'].toString(),
      transactionId: json['transaction_id'].toString(),
      senderId: json['sender_id'].toString(),
      content: json['content']?.toString() ?? '',
      createdAtMillis: _millis(json['created_at']),
      sender: P2PParty.fromEmbedded(
        json['sender'] ?? json['profiles'],
        fallbackId: json['sender_id']?.toString(),
      ),
    );
  }
}

/// A dispute raised on a transaction. Maps to `p2p_disputes`.
class P2PDispute {
  const P2PDispute({
    required this.id,
    required this.transactionId,
    required this.initiatedBy,
    required this.status,
    required this.createdAtMillis,
    this.reason,
    this.resolution,
    this.moderatorId,
    this.resolvedAtMillis,
  });

  final String id;
  final String transactionId;
  final String initiatedBy;
  final String status;
  final int createdAtMillis;
  final String? reason;
  final String? resolution;
  final String? moderatorId;
  final int? resolvedAtMillis;

  bool get isOpen => status != 'resolved' && status != 'cancelled';

  factory P2PDispute.fromJson(Map<String, Object?> json) {
    return P2PDispute(
      id: json['id'].toString(),
      transactionId: json['transaction_id'].toString(),
      initiatedBy: json['initiated_by'].toString(),
      status: json['status']?.toString() ?? 'open',
      createdAtMillis: _millis(json['created_at']),
      reason: json['reason']?.toString(),
      resolution: json['resolution']?.toString(),
      moderatorId: json['moderator_id']?.toString(),
      resolvedAtMillis: _nullableMillis(json['resolved_at']),
    );
  }
}

/// Standard dispute reasons shown in the "open dispute" picker (from web).
class P2PDisputeReason {
  const P2PDisputeReason(this.value, this.label);
  final String value;
  final String label;

  static const List<P2PDisputeReason> all = [
    P2PDisputeReason('no_payment', 'Did not receive payment'),
    P2PDisputeReason('wrong_amount', 'Wrong payment amount'),
    P2PDisputeReason('no_credits', 'Did not receive credits'),
    P2PDisputeReason('fraud', 'Suspected fraud'),
    P2PDisputeReason('unresponsive', 'Other party unresponsive'),
    P2PDisputeReason('other', 'Other issue'),
  ];

  static String labelFor(String? value) {
    for (final r in all) {
      if (r.value == value) return r.label;
    }
    return value ?? 'Dispute';
  }
}

// --- shared parsing helpers ---

int _int(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int _millis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value?.toString() ?? '')?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

int? _nullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}
