import 'package:supabase_flutter/supabase_flutter.dart';

import 'wallet_models.dart';

/// Live data access for the Wallet / credit-token feature.
///
/// Talks to the credits/monetization schema created in
/// `20260624000500_native_money_p2p_schema.sql`: `user_credits`,
/// `credit_packages`, `credit_transactions`, `subscription_tiers`,
/// `user_subscriptions`, `creator_monetization`, `creator_payout_requests`.
///
/// Follows the same contract as `SocialGraphRemoteDataSource` /
/// `P2PRemoteDataSource`:
/// * [isConfigured] / [_client] guard every call.
/// * reads degrade to empty / neutral values when Supabase is unconfigured or
///   there is no authenticated user.
/// * writes become no-ops in the same conditions.
///
/// SERVER-OWNED MONEY MOVES (no client-side payment keys):
/// * Buying credits and subscribing go through the server-owned Supabase Edge
///   Function `paystack-checkout` (matches the web `functions.invoke(
///   'paystack-checkout', ...)`), which returns a hosted `authorization_url`.
///   No secret keys ever touch the client.
/// * Gifting/transferring credits and requesting payouts go through server
///   RPCs (`transfer_credits`, `send_direct_gift`) that enforce balance/RLS.
///
/// BACKEND GAP: at the time of writing, the live native migrations define the
/// TABLES above but NOT the RPCs the web calls (`get_user_credits`,
/// `transfer_credits`, `send_direct_gift`) nor is the `paystack-checkout` Edge
/// Function guaranteed deployed for the native project. Every money-moving call
/// is wrapped so a missing contract surfaces as [WalletBackendUnavailable] and
/// the UI shows an honest "coming soon / server not ready" state instead of
/// silently succeeding.
class WalletRemoteDataSource {
  const WalletRemoteDataSource({required this.isConfigured});

  /// Detects configuration from whether the Supabase singleton is initialised,
  /// mirroring the social-graph / p2p data-source factories.
  factory WalletRemoteDataSource.autoDetect() {
    return WalletRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _userCreditsTable = 'user_credits';
  static const _packagesTable = 'credit_packages';
  static const _transactionsTable = 'credit_transactions';
  static const _tiersTable = 'subscription_tiers';
  static const _subscriptionsTable = 'user_subscriptions';
  static const _monetizationTable = 'creator_monetization';
  static const _payoutRequestsTable = 'creator_payout_requests';

  /// Server-owned checkout Edge Function (hosted payment; no client keys).
  static const _checkoutFunction = 'paystack-checkout';

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

  // --- Balance ------------------------------------------------------------

  /// The current user's credit balance + lifetime stats, or [CreditBalance.empty]
  /// when signed-out / unconfigured / no row yet.
  Future<CreditBalance> fetchBalance() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return CreditBalance.empty;

    final row = await client
        .from(_userCreditsTable)
        .select('balance, lifetime_earned, lifetime_spent')
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return CreditBalance.empty;
    return CreditBalance.fromJson(Map<String, Object?>.from(row));
  }

  // --- Packages -----------------------------------------------------------

  /// Active credit packages, cheapest first (so "Starter" leads).
  Future<List<CreditPackage>> fetchPackages() async {
    final client = _client;
    if (client == null) return const [];

    final rows = await client
        .from(_packagesTable)
        .select('id, name, credits, bonus_credits, price_cents, currency')
        .eq('is_active', true)
        .order('price_cents', ascending: true);

    return rows
        .whereType<Map>()
        .map((row) => CreditPackage.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  // --- Transactions -------------------------------------------------------

  /// The current user's credit ledger, newest first.
  Future<List<CreditTransaction>> fetchTransactions({int limit = 100}) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_transactionsTable)
        .select(
          'id, amount, balance_after, type, description, payment_reference, '
          'stripe_payment_intent_id, created_at',
        )
        .eq('user_id', userId)
        .order('created_at', ascending: false)
        .limit(limit);

    return rows
        .whereType<Map>()
        .map(
          (row) => CreditTransaction.fromJson(Map<String, Object?>.from(row)),
        )
        .toList();
  }

  // --- Subscriptions ------------------------------------------------------

  /// Active subscription tiers, cheapest first.
  Future<List<SubscriptionTier>> fetchTiers() async {
    final client = _client;
    if (client == null) return const [];

    final rows = await client
        .from(_tiersTable)
        .select('id, name, description, price_cents, currency, features')
        .eq('is_active', true)
        .order('price_cents', ascending: true);

    return rows
        .whereType<Map>()
        .map((row) => SubscriptionTier.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  /// The current user's active subscription, or null.
  Future<UserSubscription?> fetchActiveSubscription() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;

    final row = await client
        .from(_subscriptionsTable)
        .select('id, tier_id, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (row == null) return null;
    return UserSubscription.fromJson(Map<String, Object?>.from(row));
  }

  // --- Creator monetization / payouts ------------------------------------

  /// The current user's monetization state, or [CreatorMonetization.empty].
  Future<CreatorMonetization> fetchMonetization() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return CreatorMonetization.empty;

    final row = await client
        .from(_monetizationTable)
        .select(
          'is_monetized, total_earnings, available_balance, last_payout_at, '
          'next_eligible_payout',
        )
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return CreatorMonetization.empty;
    return CreatorMonetization.fromJson(Map<String, Object?>.from(row));
  }

  /// The current user's own payout requests, newest first.
  Future<List<PayoutRequest>> fetchMyPayoutRequests({int limit = 20}) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_payoutRequestsTable)
        .select('id, amount, currency, payout_method, status, requested_at, '
            'processed_at')
        .eq('user_id', userId)
        .order('requested_at', ascending: false)
        .limit(limit);

    return rows
        .whereType<Map>()
        .map((row) => PayoutRequest.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  // --- Money moves (server-owned) ----------------------------------------

  /// Start a hosted checkout for a credit [packageId] via the server-owned
  /// `paystack-checkout` Edge Function. Returns the `authorization_url` the UI
  /// should open in an external browser to complete payment. Throws
  /// [WalletBackendUnavailable] if the function is not deployed / errors, so
  /// the UI can surface an honest failure instead of a fake success.
  ///
  /// SECURITY: no payment keys are used here — the Edge Function owns the
  /// provider secret and returns only a redirect URL.
  Future<String> startCreditCheckout(String packageId) {
    return _startCheckout(type: 'credits', itemId: packageId);
  }

  /// Start a hosted checkout to subscribe to [tierId]. Same server-owned
  /// contract as [startCreditCheckout].
  Future<String> startSubscriptionCheckout(String tierId) {
    return _startCheckout(type: 'subscription', itemId: tierId);
  }

  Future<String> _startCheckout({
    required String type,
    required String itemId,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable(
        'Sign in to complete a purchase.',
      );
    }

    try {
      final response = await client.functions.invoke(
        _checkoutFunction,
        body: {'type': type, 'itemId': itemId},
      );
      final data = response.data;
      final url = data is Map ? data['authorization_url']?.toString() : null;
      if (url == null || url.isEmpty) {
        throw const WalletBackendUnavailable(
          'Checkout did not return a payment link. Please try again shortly.',
        );
      }
      return url;
    } on FunctionException catch (error) {
      throw WalletBackendUnavailable(
        'Payments are not available yet. The checkout service is not '
        'reachable for this build.',
        cause: error,
      );
    }
  }

  /// Transfer [amount] credits to the user identified by [recipientUsername]
  /// via the server RPC `transfer_credits` (mirrors the web wallet "Send"
  /// action). The RPC enforces balance, self-transfer and existence checks
  /// server-side. Throws a typed [WalletTransferException] on a known business
  /// error, or [WalletBackendUnavailable] if the RPC is missing.
  Future<void> transferCredits({
    required String recipientUsername,
    required int amount,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable('Sign in to send credits.');
    }

    try {
      await client.rpc<dynamic>(
        'transfer_credits',
        params: {
          'p_recipient_username': recipientUsername.replaceAll('@', '').trim(),
          'p_amount': amount,
        },
      );
    } on PostgrestException catch (error) {
      throw _mapTransferError(error);
    }
  }

  /// Send a direct gift ([giftType], costing [creditValue] credits) to the user
  /// identified by [recipientIdentifier] (username or email) via the server RPC
  /// `send_direct_gift` (mirrors the web `SendDirectGiftModal`). Server applies
  /// the platform fee and moves credits.
  Future<void> sendDirectGift({
    required String recipientIdentifier,
    required String giftType,
    required int creditValue,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable('Sign in to send a gift.');
    }

    try {
      await client.rpc<dynamic>(
        'send_direct_gift',
        params: {
          'p_recipient_identifier':
              recipientIdentifier.replaceAll('@', '').trim(),
          'p_gift_type': giftType,
          'p_credit_value': creditValue,
        },
      );
    } on PostgrestException catch (error) {
      throw _mapTransferError(error);
    }
  }

  /// Create a creator payout request for [amount] (in the creator's earnings
  /// currency). Inserts into `creator_payout_requests` — the row the creator is
  /// permitted to create; admin approval + the actual money move happen
  /// server-side. Returns the created request, or throws
  /// [WalletBackendUnavailable] when the insert is refused.
  Future<PayoutRequest?> requestPayout({
    required double amount,
    required String currency,
    String? payoutMethod,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable('Sign in to request a payout.');
    }

    try {
      final inserted = await client
          .from(_payoutRequestsTable)
          .insert({
            'user_id': userId,
            'amount': amount,
            'currency': currency,
            if (payoutMethod != null) 'payout_method': payoutMethod,
            'status': 'pending',
          })
          .select(
            'id, amount, currency, payout_method, status, requested_at, '
            'processed_at',
          )
          .maybeSingle();
      if (inserted == null) return null;
      return PayoutRequest.fromJson(Map<String, Object?>.from(inserted));
    } on PostgrestException catch (error) {
      throw WalletBackendUnavailable(
        'Could not submit your payout request. Payouts may not be enabled for '
        'your account yet.',
        cause: error,
      );
    }
  }

  /// Maps a Postgrest error from a credit-moving RPC into a typed, user-facing
  /// [WalletTransferException]. Falls back to [WalletBackendUnavailable] when
  /// the RPC itself is missing (e.g. function does not exist -> 404 / PGRST202).
  Exception _mapTransferError(PostgrestException error) {
    final message = error.message.toLowerCase();
    final code = error.code ?? '';

    // Function/relation not found -> the contract is not deployed.
    if (code == 'PGRST202' ||
        code == '42883' ||
        message.contains('could not find the function') ||
        message.contains('does not exist')) {
      return const WalletBackendUnavailable(
        'This action needs a server contract that is not available in this '
        'build yet.',
      );
    }

    if (message.contains('insufficient')) {
      return const WalletTransferException(
        WalletTransferError.insufficientCredits,
      );
    }
    if (message.contains('user not found') || message.contains('not found')) {
      return const WalletTransferException(WalletTransferError.recipientNotFound);
    }
    if (message.contains('yourself')) {
      return const WalletTransferException(WalletTransferError.selfTransfer);
    }
    return WalletTransferException(WalletTransferError.unknown, cause: error);
  }
}

/// Known, user-facing failure reasons for a credit transfer / gift.
enum WalletTransferError {
  insufficientCredits,
  recipientNotFound,
  selfTransfer,
  unknown,
}

extension WalletTransferErrorX on WalletTransferError {
  String get message => switch (this) {
    WalletTransferError.insufficientCredits =>
      'You do not have enough credits for this.',
    WalletTransferError.recipientNotFound =>
      'No user found with that username or email.',
    WalletTransferError.selfTransfer => 'You cannot send credits to yourself.',
    WalletTransferError.unknown => 'Something went wrong. Please try again.',
  };
}

/// Raised when a transfer/gift fails for a known business reason (surfaced to
/// the user via [WalletTransferError.message]).
class WalletTransferException implements Exception {
  const WalletTransferException(this.error, {this.cause});
  final WalletTransferError error;
  final Object? cause;

  String get message => error.message;

  @override
  String toString() => 'WalletTransferException: ${error.name}';
}
