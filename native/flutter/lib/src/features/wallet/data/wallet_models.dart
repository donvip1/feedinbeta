/// Domain models for the Wallet / credit-token feature.
///
/// These mirror the LIVE Supabase schema in
/// `supabase/migrations/20260624000500_native_money_p2p_schema.sql`:
/// `user_credits`, `credit_packages`, `credit_transactions`, `payment_history`,
/// `subscription_tiers`, `user_subscriptions`, `creator_monetization`,
/// `creator_payout_requests`, `finance_credit_buyback_requests`.
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

/// A masked, client-readable creator payout destination. Provider recipient
/// codes and raw account details remain in the service-role-only secrets table.
class PayoutDestination {
  const PayoutDestination({
    required this.id,
    required this.provider,
    required this.displayLabel,
    required this.currency,
    required this.status,
    required this.isDefault,
    this.accountLast4,
    this.countryCode,
  });

  final String id;
  final String provider;
  final String displayLabel;
  final String currency;
  final String status;
  final bool isDefault;
  final String? accountLast4;
  final String? countryCode;

  bool get isActive => status == 'active';

  factory PayoutDestination.fromJson(Map<String, Object?> json) {
    return PayoutDestination(
      id: json['id'].toString(),
      provider: json['provider']?.toString() ?? 'paystack',
      displayLabel: json['display_label']?.toString() ?? 'Bank account',
      accountLast4: json['account_last4']?.toString(),
      currency: json['currency']?.toString() ?? 'NGN',
      countryCode: json['country_code']?.toString(),
      status: (json['status']?.toString() ?? 'pending').toLowerCase(),
      isDefault: json['is_default'] == true,
    );
  }
}

/// A bank returned by Paystack's Nigerian bank directory.
class PaystackBank {
  const PaystackBank({required this.name, required this.code});

  final String name;
  final String code;

  factory PaystackBank.fromJson(Map<String, Object?> json) {
    return PaystackBank(
      name: json['name']?.toString() ?? 'Bank',
      code: json['code']?.toString() ?? '',
    );
  }
}

/// Result of resolving an account number against a selected Paystack bank.
class VerifiedPayoutAccount {
  const VerifiedPayoutAccount({
    required this.accountNumber,
    required this.accountName,
  });

  final String accountNumber;
  final String accountName;

  factory VerifiedPayoutAccount.fromJson(Map<String, Object?> json) {
    return VerifiedPayoutAccount(
      accountNumber: json['account_number']?.toString() ?? '',
      accountName: json['account_name']?.toString() ?? '',
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
    this.providerReference,
    this.failureReason,
    this.processedAtMillis,
  });

  final String id;
  final double amount;
  final String currency;
  final String status;
  final int requestedAtMillis;
  final String? payoutMethod;
  final String? providerReference;
  final String? failureReason;
  final int? processedAtMillis;

  bool get isOpen =>
      status == 'pending' || status == 'processing' || status == 'queued';

  bool get isSuccessful =>
      status == 'approved' || status == 'paid' || status == 'completed';

  String get statusLabel => _humanizeType(status);

  factory PayoutRequest.fromJson(Map<String, Object?> json) {
    return PayoutRequest(
      id: json['id'].toString(),
      amount: _asDouble(json['amount']),
      currency: json['currency']?.toString() ?? 'USD',
      status: (json['status']?.toString() ?? 'pending').toLowerCase(),
      payoutMethod: json['payout_method']?.toString(),
      providerReference: json['provider_reference']?.toString(),
      failureReason: json['failure_reason']?.toString(),
      requestedAtMillis: _asMillis(json['requested_at']),
      processedAtMillis: _asNullableMillis(json['processed_at']),
    );
  }
}

/// A request for Feedin's finance team to buy credits back from the user.
///
/// The buyback migration is additive to the original wallet schema. The
/// required client-facing fields are `id`, `credits_amount`, `status`, and a
/// request timestamp (`requested_at` or `created_at`).
class FinanceBuybackRequest {
  const FinanceBuybackRequest({
    required this.id,
    required this.creditsAmount,
    required this.status,
    required this.requestedAtMillis,
    this.updatedAtMillis,
    this.resolvedAtMillis,
    this.note,
  });

  final String id;
  final int creditsAmount;
  final String status;
  final int requestedAtMillis;
  final int? updatedAtMillis;
  final int? resolvedAtMillis;
  final String? note;

  bool get isPending => status == 'pending';

  bool get isSuccessful =>
      status == 'approved' || status == 'paid' || status == 'completed';

  bool get isCanceled => status == 'canceled' || status == 'cancelled';

  String get statusLabel => _humanizeType(status);

  factory FinanceBuybackRequest.fromJson(Map<String, Object?> json) {
    return FinanceBuybackRequest(
      id: json['id'].toString(),
      creditsAmount: _asInt(
        json['credits_amount'] ?? json['credit_amount'] ?? json['amount'],
      ),
      status: (json['status']?.toString() ?? 'pending').toLowerCase(),
      requestedAtMillis: _asMillis(json['requested_at'] ?? json['created_at']),
      updatedAtMillis: _asNullableMillis(json['updated_at']),
      resolvedAtMillis: _asNullableMillis(
        json['completed_at'] ??
            json['processed_at'] ??
            json['reviewed_at'] ??
            json['canceled_at'] ??
            json['cancelled_at'],
      ),
      note:
          json['finance_note']?.toString() ??
          json['review_notes']?.toString() ??
          json['failure_reason']?.toString(),
    );
  }
}

/// Hosted checkout category understood by the server-owned payment function.
enum WalletCheckoutKind { credits, subscription }

/// A typed checkout initialization response.
///
/// The Paystack function returns all fields required to safely resume and
/// verify a hosted checkout after the app regains focus.
class WalletCheckoutSession {
  const WalletCheckoutSession({
    required this.kind,
    required this.itemId,
    required this.authorizationUri,
    required this.reference,
    required this.paymentIntentId,
    required this.idempotencyKey,
    required this.reused,
  });

  final WalletCheckoutKind kind;
  final String itemId;
  final Uri authorizationUri;
  final String reference;
  final String paymentIntentId;
  final String idempotencyKey;
  final bool reused;
}

/// Successful response from the server-owned checkout verification action.
class WalletCheckoutVerification {
  const WalletCheckoutVerification({
    required this.paymentIntentId,
    required this.status,
    required this.alreadyProcessed,
    this.purchaseKind,
    this.balanceAfter,
    this.subscriptionId,
  });

  final String paymentIntentId;
  final String status;
  final bool alreadyProcessed;
  final WalletCheckoutKind? purchaseKind;
  final int? balanceAfter;
  final String? subscriptionId;

  bool get isCompleted => status == 'completed';
}

/// Result of refreshing wallet state after returning from hosted checkout.
enum WalletCheckoutRefreshOutcome { confirmed, processing, failed }

/// Raised when the provider verification action returns a known checkout
/// failure. [isPaymentIncomplete] is retryable; other codes are treated as
/// terminal for the current checkout attempt.
class WalletCheckoutVerificationException implements Exception {
  const WalletCheckoutVerificationException(
    this.message, {
    this.code,
    this.cause,
  });

  final String message;
  final String? code;
  final Object? cause;

  bool get isPaymentIncomplete => code == 'PAYMENT_NOT_COMPLETE';

  @override
  String toString() => 'WalletCheckoutVerificationException: $message';
}

/// Raised when a money-moving wallet operation cannot complete because the
/// required server-side contract (purchase edge function / transfer / gift /
/// payout / buyback RPC) is not available in the live schema. The UI treats
/// this as a soft, honest failure rather than pretending success.
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
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}
