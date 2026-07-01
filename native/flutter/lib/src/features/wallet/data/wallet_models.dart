/// Domain models for the Wallet / credit-token feature.
///
/// These mirror the LIVE Supabase schema in
/// `supabase/migrations/20260624000500_native_money_p2p_schema.sql`:
/// `user_credits`, `credit_packages`, `credit_transactions`, `payment_history`,
/// `subscription_tiers`, `user_subscriptions`, `creator_monetization`,
/// `creator_payout_requests`.
///
/// Where the web components need richer data than the live schema provides
/// (e.g. per-package promotion labels, discount percentages, "isPopular"),
/// those fields are surfaced as optional/nullable or derived, and documented as
/// backend gaps so the UI degrades gracefully.
library;

// ---------------------------------------------------------------------------
// Credit conversion constants (mirrors the web `CREDITS_PER_USD` = 100).
// ---------------------------------------------------------------------------

/// Web `CREDITS_PER_USD` — 100 credits == $1. Used to render the local-currency
/// approximation under the balance and per-credit price on packages.
const int kCreditsPerUsd = 100;

/// The current user's spendable credit/token balance plus lifetime stats.
///
/// Column mapping to live `user_credits`: `balance`, `lifetime_earned`,
/// `lifetime_spent`.
class CreditBalance {
  const CreditBalance({
    required this.balance,
    required this.lifetimeEarned,
    required this.lifetimeSpent,
  });

  final int balance;
  final int lifetimeEarned;
  final int lifetimeSpent;

  /// Neutral value used when signed-out / unconfigured / no row yet.
  static const CreditBalance empty = CreditBalance(
    balance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
  );

  /// Approx USD value of [balance] (100 credits == $1).
  double get approxUsd => balance / kCreditsPerUsd;

  factory CreditBalance.fromJson(Map<String, Object?> json) {
    return CreditBalance(
      balance: _asInt(json['balance']),
      lifetimeEarned: _asInt(json['lifetime_earned']),
      lifetimeSpent: _asInt(json['lifetime_spent']),
    );
  }
}

/// A purchasable credit/token package.
///
/// Column mapping to live `credit_packages`: `id`, `name`, `credits`,
/// `bonus_credits`, `price_cents`, `currency`, `is_active`.
class CreditPackage {
  const CreditPackage({
    required this.id,
    required this.name,
    required this.credits,
    required this.bonusCredits,
    required this.priceCents,
    required this.currency,
  });

  final String id;
  final String name;
  final int credits;
  final int bonusCredits;
  final int priceCents;
  final String currency;

  int get totalCredits => credits + bonusCredits;

  double get priceMajor => priceCents / 100.0;

  /// Bonus as a whole-percent of base credits (0 when no bonus).
  int get bonusPercent =>
      credits <= 0 ? 0 : ((bonusCredits / credits) * 100).round();

  /// Price per credit in major units of [currency] (for the "per credit" tag).
  double get pricePerCredit =>
      totalCredits <= 0 ? 0 : priceMajor / totalCredits;

  /// Web PackageCard heuristics (name/price based) reused for native accents.
  bool get isReseller => name.toLowerCase().contains('reseller');
  bool get isPremium =>
      name.toLowerCase().contains('ultimate') || isReseller || priceMajor >= 50;
  bool get isPopular =>
      name.toLowerCase().contains('pro') ||
      name.toLowerCase().contains('popular') ||
      name.toLowerCase().contains('mega');

  factory CreditPackage.fromJson(Map<String, Object?> json) {
    return CreditPackage(
      id: json['id'].toString(),
      name: json['name']?.toString() ?? 'Credit Pack',
      credits: _asInt(json['credits']),
      bonusCredits: _asInt(json['bonus_credits']),
      priceCents: _asInt(json['price_cents']),
      currency: json['currency']?.toString() ?? 'USD',
    );
  }
}

/// A single credit-ledger entry.
///
/// Column mapping to live `credit_transactions`: `id`, `amount`,
/// `balance_after`, `type`, `description`, `payment_reference`,
/// `stripe_payment_intent_id`, `created_at`.
class CreditTransaction {
  const CreditTransaction({
    required this.id,
    required this.amount,
    required this.type,
    required this.createdAtMillis,
    this.balanceAfter,
    this.description,
    this.paymentReference,
  });

  final String id;
  final int amount;
  final String type;
  final int createdAtMillis;
  final int? balanceAfter;
  final String? description;
  final String? paymentReference;

  bool get isPurchase => type == 'purchase';
  bool get isCredit => amount > 0;

  /// Best human label (web falls back to `type` when no description).
  String get label {
    final desc = description?.trim();
    if (desc != null && desc.isNotEmpty) return desc;
    return _humanizeType(type);
  }

  factory CreditTransaction.fromJson(Map<String, Object?> json) {
    return CreditTransaction(
      id: json['id'].toString(),
      amount: _asInt(json['amount']),
      type: json['type']?.toString() ?? 'transaction',
      balanceAfter: json['balance_after'] == null
          ? null
          : _asInt(json['balance_after']),
      description: json['description']?.toString(),
      paymentReference:
          json['payment_reference']?.toString() ??
          json['stripe_payment_intent_id']?.toString(),
      createdAtMillis: _asMillis(json['created_at']),
    );
  }
}

/// Filter used by the transaction list (mirrors the web filter pills).
enum TransactionFilter { all, purchases, earned, spent }

extension TransactionFilterX on TransactionFilter {
  String get label => switch (this) {
    TransactionFilter.all => 'All',
    TransactionFilter.purchases => 'Purchases',
    TransactionFilter.earned => 'Earned',
    TransactionFilter.spent => 'Spent',
  };

  bool matches(CreditTransaction tx) => switch (this) {
    TransactionFilter.all => true,
    TransactionFilter.purchases => tx.isPurchase,
    TransactionFilter.earned => tx.amount > 0,
    TransactionFilter.spent => tx.amount < 0,
  };
}

/// A subscription plan/tier.
///
/// Column mapping to live `subscription_tiers`: `id`, `name`, `description`,
/// `price_cents`, `currency`, `features` (jsonb array), `is_active`.
class SubscriptionTier {
  const SubscriptionTier({
    required this.id,
    required this.name,
    required this.priceCents,
    required this.currency,
    required this.features,
    this.description,
  });

  final String id;
  final String name;
  final int priceCents;
  final String currency;
  final List<String> features;
  final String? description;

  double get priceMajor => priceCents / 100.0;

  /// Middle tier (by name) is the "most popular" per web styling.
  bool get isPopular =>
      name.toLowerCase().contains('pro') ||
      name.toLowerCase().contains('popular');

  factory SubscriptionTier.fromJson(Map<String, Object?> json) {
    return SubscriptionTier(
      id: json['id'].toString(),
      name: json['name']?.toString() ?? 'Plan',
      priceCents: _asInt(json['price_cents']),
      currency: json['currency']?.toString() ?? 'USD',
      description: json['description']?.toString(),
      features: _asStringList(json['features']),
    );
  }
}

/// The current user's active subscription (if any).
///
/// Column mapping to live `user_subscriptions`: `id`, `tier_id`, `status`,
/// `current_period_end`.
class UserSubscription {
  const UserSubscription({
    required this.id,
    required this.tierId,
    required this.status,
    this.currentPeriodEndMillis,
  });

  final String id;
  final String? tierId;
  final String status;
  final int? currentPeriodEndMillis;

  bool get isActive => status == 'active';

  factory UserSubscription.fromJson(Map<String, Object?> json) {
    return UserSubscription(
      id: json['id'].toString(),
      tierId: json['tier_id']?.toString(),
      status: json['status']?.toString() ?? 'inactive',
      currentPeriodEndMillis: _asNullableMillis(json['current_period_end']),
    );
  }
}

/// The current user's creator-monetization / earnings state, used to drive the
/// payout request screen.
///
/// Column mapping to live `creator_monetization`: `is_monetized`,
/// `total_earnings`, `available_balance`, `last_payout_at`,
/// `next_eligible_payout`.
class CreatorMonetization {
  const CreatorMonetization({
    required this.isMonetized,
    required this.totalEarnings,
    required this.availableBalance,
    this.lastPayoutAtMillis,
    this.nextEligiblePayoutMillis,
  });

  final bool isMonetized;
  final double totalEarnings;
  final double availableBalance;
  final int? lastPayoutAtMillis;
  final int? nextEligiblePayoutMillis;

  static const CreatorMonetization empty = CreatorMonetization(
    isMonetized: false,
    totalEarnings: 0,
    availableBalance: 0,
  );

  factory CreatorMonetization.fromJson(Map<String, Object?> json) {
    return CreatorMonetization(
      isMonetized: json['is_monetized'] == true,
      totalEarnings: _asDouble(json['total_earnings']),
      availableBalance: _asDouble(json['available_balance']),
      lastPayoutAtMillis: _asNullableMillis(json['last_payout_at']),
      nextEligiblePayoutMillis: _asNullableMillis(json['next_eligible_payout']),
    );
  }
}

/// A creator payout request row.
///
/// Column mapping to live `creator_payout_requests`: `id`, `amount`,
/// `currency`, `payout_method`, `status`, `requested_at`, `processed_at`.
class PayoutRequest {
  const PayoutRequest({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    required this.requestedAtMillis,
    this.payoutMethod,
    this.processedAtMillis,
  });

  final String id;
  final double amount;
  final String currency;
  final String status;
  final int requestedAtMillis;
  final String? payoutMethod;
  final int? processedAtMillis;

  factory PayoutRequest.fromJson(Map<String, Object?> json) {
    return PayoutRequest(
      id: json['id'].toString(),
      amount: _asDouble(json['amount']),
      currency: json['currency']?.toString() ?? 'USD',
      status: json['status']?.toString() ?? 'pending',
      payoutMethod: json['payout_method']?.toString(),
      requestedAtMillis: _asMillis(json['requested_at']),
      processedAtMillis: _asNullableMillis(json['processed_at']),
    );
  }
}

/// Raised when a money-moving wallet operation cannot complete because the
/// required server-side contract (purchase edge function / transfer / gift /
/// payout RPC) is not available in the live schema. The UI treats this as a
/// soft, honest failure rather than pretending success.
class WalletBackendUnavailable implements Exception {
  const WalletBackendUnavailable(this.message, {this.cause});
  final String message;
  final Object? cause;

  @override
  String toString() => 'WalletBackendUnavailable: $message';
}

// ---------------------------------------------------------------------------
// JSON coercion helpers (shared by the models above).
// ---------------------------------------------------------------------------

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double _asDouble(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

int _asMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value?.toString() ?? '')?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

int? _asNullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}

List<String> _asStringList(Object? value) {
  if (value is List) {
    return [
      for (final item in value)
        if (item != null && item.toString().trim().isNotEmpty)
          item.toString().trim(),
    ];
  }
  return const [];
}

String _humanizeType(String type) {
  if (type.isEmpty) return 'Transaction';
  final words = type.replaceAll('_', ' ').split(' ');
  return words
      .map(
        (w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
      )
      .join(' ');
}
