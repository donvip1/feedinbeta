import 'package:supabase_flutter/supabase_flutter.dart';

import 'wallet_models.dart';

/// Testable wallet boundary. Server contract details remain in the remote
/// implementation while presenters can use deterministic fakes.
abstract interface class WalletDataSource {
  Future<CreditBalance> fetchBalance();

  Future<List<CreditPackage>> fetchPackages();

  Future<List<CreditTransaction>> fetchTransactions({int limit = 100});

  Future<List<SubscriptionTier>> fetchTiers();

  Future<UserSubscription?> fetchActiveSubscription();

  Future<CreatorMonetization> fetchMonetization();

  Future<List<PayoutRequest>> fetchMyPayoutRequests({int limit = 20});

  Future<List<PayoutDestination>> fetchPayoutDestinations();

  Future<List<PaystackBank>> fetchPaystackBanks();

  Future<VerifiedPayoutAccount> verifyPayoutAccount({
    required String bankCode,
    required String accountNumber,
  });

  Future<PayoutDestination> savePayoutDestination({
    required PaystackBank bank,
    required String accountNumber,
  });

  Future<WalletCheckoutSession> startCreditCheckout(String packageId);

  Future<WalletCheckoutSession> startSubscriptionCheckout(String tierId);

  Future<WalletCheckoutVerification> verifyCheckout(String reference);

  Future<void> transferCredits({
    required String recipientUsername,
    required int amount,
  });

  Future<void> sendDirectGift({
    required String recipientIdentifier,
    required String giftType,
    required int creditValue,
  });

  Future<PayoutRequest> requestPayout({required double amount});

  Future<List<FinanceBuybackRequest>> fetchFinanceBuybackRequests({
    int limit = 20,
  });

  Future<void> requestFinanceBuyback({required int creditsAmount});

  Future<void> cancelFinanceBuyback(String requestId);
}

/// Central definition of the native wallet's server-owned contracts.
abstract final class WalletServerContract {
  static const checkoutFunction = 'paystack-checkout';
  static const creatorPayoutRequestRpc = 'request_creator_payout';
  static const creatorPayoutRequestsTable = 'creator_payout_requests';
  static const creatorPayoutDestinationsTable = 'creator_payout_destinations';
  static const payoutFunction = 'paystack-withdrawal';
  static const financeBuybackRequestsTable = 'finance_credit_buyback_requests';
  static const financeBuybackRequestRpc = 'request_finance_buyback';
  static const financeBuybackCancelRpc = 'cancel_finance_buyback';

  static const checkoutTypeKey = 'type';
  static const checkoutItemIdKey = 'itemId';
  static const checkoutUrlKey = 'authorization_url';
  static const checkoutReferenceKey = 'reference';
  static const checkoutPaymentIntentIdKey = 'payment_intent_id';
  static const checkoutIdempotencyKey = 'idempotency_key';
  static const checkoutReusedKey = 'reused';
  static const checkoutActionKey = 'action';
  static const checkoutVerifyAction = 'verify';

  static const payoutAmountParam = 'p_amount';
  static const payoutIdempotencyParam = 'p_idempotency_key';
  static const payoutActionKey = 'action';
  static const payoutListBanksAction = 'list-banks';
  static const payoutVerifyAccountAction = 'verify-account';
  static const payoutSaveDestinationAction = 'save-creator-payout-destination';
  static const payoutProcessAction = 'process-creator-payout';
  static const payoutRequestIdKey = 'request_id';
  static const financeBuybackCreditsParam = 'p_credits_amount';
  static const financeBuybackIdempotencyParam = 'p_idempotency_key';
  static const financeBuybackRequestIdParam = 'p_request_id';

  static WalletCheckoutSession parseCheckoutSession(
    Object? raw, {
    required WalletCheckoutKind kind,
    required String itemId,
  }) {
    final data = _objectMap(raw);
    final serverError = _string(data?['error']);
    if (serverError != null) {
      throw WalletBackendUnavailable(serverError);
    }

    final rawUrl = _string(data?[checkoutUrlKey]);
    final uri = rawUrl == null ? null : Uri.tryParse(rawUrl);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      throw const WalletBackendUnavailable(
        'Checkout did not return a secure payment link. Please try again.',
      );
    }

    final reference = _string(data?[checkoutReferenceKey]);
    final paymentIntentId = _string(data?[checkoutPaymentIntentIdKey]);
    final idempotencyKey = _string(data?[checkoutIdempotencyKey]);
    if (reference == null ||
        paymentIntentId == null ||
        idempotencyKey == null) {
      throw const WalletBackendUnavailable(
        'Checkout did not return the details needed for verification. '
        'Please try again.',
      );
    }

    return WalletCheckoutSession(
      kind: kind,
      itemId: itemId,
      authorizationUri: uri,
      reference: reference,
      paymentIntentId: paymentIntentId,
      idempotencyKey: idempotencyKey,
      reused: data?[checkoutReusedKey] == true,
    );
  }

  static WalletCheckoutVerification parseCheckoutVerification(Object? raw) {
    final data = _objectMap(raw);
    final serverError = _string(data?['error']);
    if (serverError != null) {
      throw WalletCheckoutVerificationException(
        serverError,
        code: _string(data?['code']),
      );
    }
    if (data?['success'] != true) {
      throw const WalletCheckoutVerificationException(
        'Payment verification returned an invalid response.',
      );
    }

    final payment = _objectMap(data?['payment']);
    final paymentIntentId = _string(payment?['payment_intent_id']);
    final status = _string(payment?['status'])?.toLowerCase();
    if (paymentIntentId == null || status == null) {
      throw const WalletCheckoutVerificationException(
        'Payment verification returned incomplete details.',
      );
    }

    return WalletCheckoutVerification(
      paymentIntentId: paymentIntentId,
      status: status,
      alreadyProcessed: payment?['already_processed'] == true,
      purchaseKind: switch (_string(payment?['purchase_type'])) {
        'credits' => WalletCheckoutKind.credits,
        'subscription' => WalletCheckoutKind.subscription,
        _ => null,
      },
      balanceAfter: _nullableInt(payment?['balance_after']),
      subscriptionId: _string(payment?['subscription_id']),
    );
  }

  static PayoutRequest? parsePayoutRequest(Object? raw) {
    final data = _objectMap(raw);
    if (data == null) return null;
    final serverError = _string(data['error']);
    if (serverError != null) {
      throw WalletBackendUnavailable(serverError);
    }

    final nested =
        _objectMap(data['request']) ??
        _objectMap(data['payout']) ??
        _objectMap(data['data']);
    final row = nested ?? data;
    if (row['id'] == null || row['amount'] == null) return null;
    return PayoutRequest.fromJson(row);
  }

  static FinanceBuybackRequest? parseFinanceBuybackRequest(Object? raw) {
    final data = _objectMap(raw);
    if (data == null) return null;
    final serverError = _string(data['error']);
    if (serverError != null) {
      throw WalletBackendUnavailable(serverError);
    }

    final nested =
        _objectMap(data['request']) ??
        _objectMap(data['buyback']) ??
        _objectMap(data['data']);
    final row = nested ?? data;
    if (row['id'] == null || row['credits_amount'] == null) return null;
    return FinanceBuybackRequest.fromJson(row);
  }

  static List<PaystackBank> parsePaystackBanks(Object? raw) {
    final data = _objectMap(raw);
    final serverError = _string(data?['error']);
    if (serverError != null) throw WalletBackendUnavailable(serverError);
    final rows = data?['data'];
    if (rows is! List) {
      throw const WalletBackendUnavailable(
        'The bank directory returned an invalid response.',
      );
    }
    return rows
        .whereType<Map>()
        .map((row) => PaystackBank.fromJson(Map<String, Object?>.from(row)))
        .where((bank) => bank.code.isNotEmpty)
        .toList()
      ..sort((left, right) => left.name.compareTo(right.name));
  }

  static VerifiedPayoutAccount parseVerifiedPayoutAccount(Object? raw) {
    final data = _objectMap(raw);
    final serverError = _string(data?['error']);
    if (serverError != null) throw WalletBackendUnavailable(serverError);
    if (data?['status'] != true) {
      throw WalletBackendUnavailable(
        _string(data?['message']) ?? 'Could not verify this bank account.',
      );
    }
    final account = _objectMap(data?['data']);
    final parsed = account == null
        ? null
        : VerifiedPayoutAccount.fromJson(account);
    if (parsed == null ||
        parsed.accountName.isEmpty ||
        parsed.accountNumber.isEmpty) {
      throw const WalletBackendUnavailable(
        'The bank account verification response was incomplete.',
      );
    }
    return parsed;
  }

  static PayoutDestination parsePayoutDestination(Object? raw) {
    final data = _objectMap(raw);
    final serverError = _string(data?['error']);
    if (serverError != null) throw WalletBackendUnavailable(serverError);
    final destination = _objectMap(data?['destination']) ?? data;
    if (destination == null || destination['id'] == null) {
      throw const WalletBackendUnavailable(
        'The payout destination was not returned by the server.',
      );
    }
    return PayoutDestination.fromJson(destination);
  }

  static String? functionErrorMessage(Object? details) {
    final data = _objectMap(details);
    return _string(data?['error']) ?? _string(data?['message']);
  }

  static String? functionErrorCode(Object? details) {
    return _string(_objectMap(details)?['code']);
  }

  static Map<String, Object?>? _objectMap(Object? value) {
    if (value is! Map) return null;
    return Map<String, Object?>.from(value);
  }

  static String? _string(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }

  static int? _nullableInt(Object? value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }
}

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
class WalletRemoteDataSource implements WalletDataSource {
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
  static const _payoutRequestsTable =
      WalletServerContract.creatorPayoutRequestsTable;
  static const _payoutDestinationsTable =
      WalletServerContract.creatorPayoutDestinationsTable;
  static const _financeBuybackRequestsTable =
      WalletServerContract.financeBuybackRequestsTable;

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
  @override
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
  @override
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
  @override
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
  @override
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
  @override
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
  @override
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
  @override
  Future<List<PayoutRequest>> fetchMyPayoutRequests({int limit = 20}) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_payoutRequestsTable)
        .select(
          'id, amount, currency, payout_method, status, requested_at, '
          'processed_at, provider_reference, failure_reason',
        )
        .eq('user_id', userId)
        .order('requested_at', ascending: false)
        .limit(limit);

    return rows
        .whereType<Map>()
        .map((row) => PayoutRequest.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  @override
  Future<List<PayoutDestination>> fetchPayoutDestinations() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_payoutDestinationsTable)
        .select(
          'id, provider, display_label, account_last4, currency, '
          'country_code, status, is_default',
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('is_default', ascending: false)
        .order('created_at', ascending: false);

    return rows
        .whereType<Map>()
        .map(
          (row) => PayoutDestination.fromJson(Map<String, Object?>.from(row)),
        )
        .toList();
  }

  @override
  Future<List<PaystackBank>> fetchPaystackBanks() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable(
        'Sign in to configure a payout account.',
      );
    }
    try {
      final response = await client.functions.invoke(
        WalletServerContract.payoutFunction,
        body: {
          WalletServerContract.payoutActionKey:
              WalletServerContract.payoutListBanksAction,
        },
      );
      return WalletServerContract.parsePaystackBanks(response.data);
    } on FunctionException catch (error) {
      throw WalletBackendUnavailable(
        WalletServerContract.functionErrorMessage(error.details) ??
            'Could not load the bank directory.',
        cause: error,
      );
    }
  }

  @override
  Future<VerifiedPayoutAccount> verifyPayoutAccount({
    required String bankCode,
    required String accountNumber,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable(
        'Sign in to verify a payout account.',
      );
    }
    try {
      final response = await client.functions.invoke(
        WalletServerContract.payoutFunction,
        body: {
          WalletServerContract.payoutActionKey:
              WalletServerContract.payoutVerifyAccountAction,
          'bank_code': bankCode,
          'account_number': accountNumber,
        },
      );
      return WalletServerContract.parseVerifiedPayoutAccount(response.data);
    } on FunctionException catch (error) {
      throw WalletBackendUnavailable(
        WalletServerContract.functionErrorMessage(error.details) ??
            'Could not verify this bank account.',
        cause: error,
      );
    }
  }

  @override
  Future<PayoutDestination> savePayoutDestination({
    required PaystackBank bank,
    required String accountNumber,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable('Sign in to save a payout account.');
    }
    try {
      final response = await client.functions.invoke(
        WalletServerContract.payoutFunction,
        body: {
          WalletServerContract.payoutActionKey:
              WalletServerContract.payoutSaveDestinationAction,
          'bank_code': bank.code,
          'bank_name': bank.name,
          'account_number': accountNumber,
        },
      );
      return WalletServerContract.parsePayoutDestination(response.data);
    } on FunctionException catch (error) {
      throw WalletBackendUnavailable(
        WalletServerContract.functionErrorMessage(error.details) ??
            'Could not save this payout account.',
        cause: error,
      );
    }
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
  @override
  Future<WalletCheckoutSession> startCreditCheckout(String packageId) {
    return _startCheckout(kind: WalletCheckoutKind.credits, itemId: packageId);
  }

  /// Start a hosted checkout to subscribe to [tierId]. Same server-owned
  /// contract as [startCreditCheckout].
  @override
  Future<WalletCheckoutSession> startSubscriptionCheckout(String tierId) {
    return _startCheckout(
      kind: WalletCheckoutKind.subscription,
      itemId: tierId,
    );
  }

  Future<WalletCheckoutSession> _startCheckout({
    required WalletCheckoutKind kind,
    required String itemId,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable('Sign in to complete a purchase.');
    }

    try {
      final response = await client.functions.invoke(
        WalletServerContract.checkoutFunction,
        body: {
          WalletServerContract.checkoutTypeKey: switch (kind) {
            WalletCheckoutKind.credits => 'credits',
            WalletCheckoutKind.subscription => 'subscription',
          },
          WalletServerContract.checkoutItemIdKey: itemId,
        },
      );
      return WalletServerContract.parseCheckoutSession(
        response.data,
        kind: kind,
        itemId: itemId,
      );
    } on FunctionException catch (error) {
      final serverMessage = WalletServerContract.functionErrorMessage(
        error.details,
      );
      throw WalletBackendUnavailable(
        serverMessage ??
            'Payments are temporarily unavailable. Please try again shortly.',
        cause: error,
      );
    }
  }

  /// Verify the provider reference after the app returns from hosted checkout.
  ///
  /// The same server-owned function completes the payment intent and performs
  /// the balance or subscription mutation atomically.
  @override
  Future<WalletCheckoutVerification> verifyCheckout(String reference) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletCheckoutVerificationException(
        'Sign in to verify this payment.',
        code: 'UNAUTHORIZED',
      );
    }

    try {
      final response = await client.functions.invoke(
        WalletServerContract.checkoutFunction,
        body: {
          WalletServerContract.checkoutActionKey:
              WalletServerContract.checkoutVerifyAction,
          WalletServerContract.checkoutReferenceKey: reference,
        },
      );
      return WalletServerContract.parseCheckoutVerification(response.data);
    } on FunctionException catch (error) {
      throw WalletCheckoutVerificationException(
        WalletServerContract.functionErrorMessage(error.details) ??
            'Could not verify this payment. Please try again.',
        code: WalletServerContract.functionErrorCode(error.details),
        cause: error,
      );
    }
  }

  /// Transfer [amount] credits to the user identified by [recipientUsername]
  /// via the server RPC `transfer_credits` (mirrors the web wallet "Send"
  /// action). The RPC enforces balance, self-transfer and existence checks
  /// server-side. Throws a typed [WalletTransferException] on a known business
  /// error, or [WalletBackendUnavailable] if the RPC is missing.
  @override
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
  @override
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
          'p_recipient_identifier': recipientIdentifier
              .replaceAll('@', '')
              .trim(),
          'p_gift_type': giftType,
          'p_credit_value': creditValue,
        },
      );
    } on PostgrestException catch (error) {
      throw _mapTransferError(error);
    }
  }

  /// Create a creator payout request through the server-owned validation RPC.
  /// Admin approval and the actual money move remain server-side.
  @override
  Future<PayoutRequest> requestPayout({required double amount}) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable('Sign in to request a payout.');
    }

    if (!amount.isFinite || amount <= 0) {
      throw const WalletBackendUnavailable('Enter a valid payout amount.');
    }

    try {
      final amountMinor = (amount * 100).round();
      final idempotencyKey =
          'native-${userId.substring(0, 8)}-$amountMinor-'
          '${DateTime.now().microsecondsSinceEpoch}';
      final response = await client.rpc<dynamic>(
        WalletServerContract.creatorPayoutRequestRpc,
        params: {
          WalletServerContract.payoutAmountParam: amount,
          WalletServerContract.payoutIdempotencyParam: idempotencyKey,
        },
      );
      final reserved = WalletServerContract.parsePayoutRequest(response);
      if (reserved == null) {
        throw const WalletBackendUnavailable(
          'The payout request was accepted but no request record was returned.',
        );
      }

      try {
        final processResponse = await client.functions.invoke(
          WalletServerContract.payoutFunction,
          body: {
            WalletServerContract.payoutActionKey:
                WalletServerContract.payoutProcessAction,
            WalletServerContract.payoutRequestIdKey: reserved.id,
          },
        );
        return WalletServerContract.parsePayoutRequest(processResponse.data) ??
            reserved;
      } on FunctionException catch (error) {
        final current = await _fetchPayoutRequest(reserved.id);
        if (current != null && (current.isOpen || current.isSuccessful)) {
          return current;
        }
        throw WalletBackendUnavailable(
          WalletServerContract.functionErrorMessage(error.details) ??
              'Could not start the payout transfer.',
          cause: error,
        );
      }
    } on WalletBackendUnavailable {
      rethrow;
    } on PostgrestException catch (error) {
      throw _mapPayoutError(error);
    }
  }

  Future<PayoutRequest?> _fetchPayoutRequest(String requestId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;
    final row = await client
        .from(_payoutRequestsTable)
        .select(
          'id, amount, currency, payout_method, status, requested_at, '
          'processed_at, provider_reference, failure_reason',
        )
        .eq('id', requestId)
        .eq('user_id', userId)
        .maybeSingle();
    return row == null
        ? null
        : PayoutRequest.fromJson(Map<String, Object?>.from(row));
  }

  // --- Finance-team credit buyback ---------------------------------------

  @override
  Future<List<FinanceBuybackRequest>> fetchFinanceBuybackRequests({
    int limit = 20,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_financeBuybackRequestsTable)
        .select()
        .eq('user_id', userId);
    final requests =
        rows
            .whereType<Map>()
            .map(
              (row) => FinanceBuybackRequest.fromJson(
                Map<String, Object?>.from(row),
              ),
            )
            .toList()
          ..sort(
            (left, right) =>
                right.requestedAtMillis.compareTo(left.requestedAtMillis),
          );
    return requests.length <= limit ? requests : requests.take(limit).toList();
  }

  @override
  Future<void> requestFinanceBuyback({required int creditsAmount}) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable(
        'Sign in to request a finance buyback.',
      );
    }
    if (creditsAmount <= 0) {
      throw const WalletBackendUnavailable('Enter a valid number of credits.');
    }

    final userKey = userId.length > 8 ? userId.substring(0, 8) : userId;
    final idempotencyKey =
        'native-buyback-$userKey-$creditsAmount-'
        '${DateTime.now().microsecondsSinceEpoch}';
    try {
      await client.rpc<dynamic>(
        WalletServerContract.financeBuybackRequestRpc,
        params: {
          WalletServerContract.financeBuybackCreditsParam: creditsAmount,
          WalletServerContract.financeBuybackIdempotencyParam: idempotencyKey,
        },
      );
    } on PostgrestException catch (error) {
      throw _mapFinanceBuybackError(error);
    }
  }

  @override
  Future<void> cancelFinanceBuyback(String requestId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const WalletBackendUnavailable(
        'Sign in to cancel a finance buyback.',
      );
    }
    if (requestId.trim().isEmpty) {
      throw const WalletBackendUnavailable(
        'The buyback request could not be identified.',
      );
    }

    try {
      await client.rpc<dynamic>(
        WalletServerContract.financeBuybackCancelRpc,
        params: {WalletServerContract.financeBuybackRequestIdParam: requestId},
      );
    } on PostgrestException catch (error) {
      throw _mapFinanceBuybackError(error, canceling: true);
    }
  }

  WalletBackendUnavailable _mapFinanceBuybackError(
    PostgrestException error, {
    bool canceling = false,
  }) {
    final message = error.message.toLowerCase();
    if (_isMissingContract(error)) {
      return WalletBackendUnavailable(
        'Finance buyback is not available in this build yet.',
        cause: error,
      );
    }
    if (message.contains('insufficient') || message.contains('balance')) {
      return WalletBackendUnavailable(
        'You do not have enough credits for this buyback request.',
        cause: error,
      );
    }
    if (message.contains('pending') || message.contains('already')) {
      return WalletBackendUnavailable(
        canceling
            ? 'Only pending buyback requests can be canceled.'
            : 'You already have a pending finance buyback request.',
        cause: error,
      );
    }
    if (message.contains('cancel') || message.contains('status')) {
      return WalletBackendUnavailable(
        'Only pending buyback requests can be canceled.',
        cause: error,
      );
    }
    if (message.contains('amount') ||
        message.contains('minimum') ||
        message.contains('positive')) {
      return WalletBackendUnavailable(
        'Enter a valid number of credits.',
        cause: error,
      );
    }
    return WalletBackendUnavailable(
      canceling
          ? 'Could not cancel the finance buyback request.'
          : 'Could not submit the finance buyback request.',
      cause: error,
    );
  }

  WalletBackendUnavailable _mapPayoutError(PostgrestException error) {
    final message = error.message.toLowerCase();
    if (_isMissingContract(error)) {
      return WalletBackendUnavailable(
        'Creator payouts are not available in this build yet.',
        cause: error,
      );
    }
    if (message.contains('available') ||
        message.contains('insufficient') ||
        message.contains('balance')) {
      return WalletBackendUnavailable(
        'The requested amount is higher than your available creator balance.',
        cause: error,
      );
    }
    if (message.contains('eligible') || message.contains('cooldown')) {
      return WalletBackendUnavailable(
        'This creator account is not eligible for another payout yet.',
        cause: error,
      );
    }
    if (message.contains('pending') || message.contains('already')) {
      return WalletBackendUnavailable(
        'You already have a payout request being processed.',
        cause: error,
      );
    }
    if (message.contains('destination') || message.contains('bank account')) {
      return WalletBackendUnavailable(
        'Add and verify a bank account before requesting a payout.',
        cause: error,
      );
    }
    if (message.contains('minimum')) {
      return WalletBackendUnavailable(
        'The minimum creator payout is \$10.00.',
        cause: error,
      );
    }
    return WalletBackendUnavailable(
      'Could not submit your payout request. Please try again shortly.',
      cause: error,
    );
  }

  bool _isMissingContract(PostgrestException error) {
    final message = error.message.toLowerCase();
    final code = error.code ?? '';
    return code == 'PGRST202' ||
        code == '42883' ||
        message.contains('could not find the function') ||
        message.contains('does not exist');
  }

  /// Maps a Postgrest error from a credit-moving RPC into a typed, user-facing
  /// [WalletTransferException]. Falls back to [WalletBackendUnavailable] when
  /// the RPC itself is missing (e.g. function does not exist -> 404 / PGRST202).
  Exception _mapTransferError(PostgrestException error) {
    final message = error.message.toLowerCase();

    // Function/relation not found -> the contract is not deployed.
    if (_isMissingContract(error)) {
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
      return const WalletTransferException(
        WalletTransferError.recipientNotFound,
      );
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
