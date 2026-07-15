import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'p2p_models.dart';

typedef P2PRpcInvoker =
    Future<dynamic> Function(
      String functionName,
      Map<String, Object?> parameters,
    );
typedef P2PIdempotencyKeyFactory = String Function();

/// Live data access for the P2P credit marketplace.
///
/// Talks to the credits/P2P schema created in
/// `20260624000500_native_money_p2p_schema.sql`:
/// `p2p_listings`, `p2p_transactions`, `p2p_payment_methods`,
/// `p2p_user_eligibility`, `p2p_chat_messages`, `p2p_disputes`, and the shared
/// `user_credits` / `credit_transactions` tables.
///
/// Follows the same contract as [SocialGraphRemoteDataSource]:
/// * [isConfigured] / [_client] guard every call.
/// * reads degrade to empty lists / neutral values when Supabase is not
///   configured or there is no authenticated user.
/// * transaction and dispute mutations run through server-authoritative RPCs.
class P2PRemoteDataSource {
  const P2PRemoteDataSource({
    required this.isConfigured,
    P2PRpcInvoker? rpcInvoker,
    P2PIdempotencyKeyFactory? idempotencyKeyFactory,
  }) : _rpcInvoker = rpcInvoker,
       _idempotencyKeyFactory = idempotencyKeyFactory;

  /// Detects configuration from whether the Supabase singleton is initialised,
  /// mirroring the social-graph data source factory.
  factory P2PRemoteDataSource.autoDetect() {
    return P2PRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;
  final P2PRpcInvoker? _rpcInvoker;
  final P2PIdempotencyKeyFactory? _idempotencyKeyFactory;

  static const _listingsTable = 'p2p_listings';
  static const _transactionsTable = 'p2p_transactions';
  static const _paymentMethodsTable = 'p2p_payment_methods';
  static const _eligibilityTable = 'p2p_user_eligibility';
  static const _chatTable = 'p2p_chat_messages';
  static const _disputesTable = 'p2p_disputes';
  static const _userCreditsTable = 'user_credits';
  static const _profilesTable = 'profiles';

  static const _profileEmbed = 'id, display_name, username, avatar_url';

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

  Future<dynamic> _rpc(
    String functionName,
    Map<String, Object?> parameters,
  ) async {
    final invoker = _rpcInvoker;
    if (invoker != null) {
      return invoker(functionName, parameters);
    }
    final client = _client;
    if (client == null) {
      throw StateError('Supabase is not configured.');
    }
    return client.rpc<dynamic>(functionName, params: parameters);
  }

  bool get _canInvokeRpc {
    if (_rpcInvoker != null) return true;
    final client = _client;
    return client != null && client.auth.currentUser != null;
  }

  // --- Credits ------------------------------------------------------------

  /// The current user's spendable credit balance, or 0 when unavailable.
  Future<int> fetchCreditBalance() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return 0;

    final row = await client
        .from(_userCreditsTable)
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return 0;
    return int.tryParse(row['balance']?.toString() ?? '0') ?? 0;
  }

  // --- Eligibility --------------------------------------------------------

  /// The current user's trading eligibility, combining the eligibility row,
  /// their payment methods, and profile country into a single view. Returns
  /// [P2PEligibility.unknown] when signed out / unconfigured.
  Future<P2PEligibility> fetchEligibility() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return P2PEligibility.unknown;

    final eligibilityRow = await client
        .from(_eligibilityTable)
        .select(
          'can_buy, can_sell, first_p2p_trade_completed, completed_trades, '
          'dispute_count',
        )
        .eq('user_id', userId)
        .maybeSingle();

    final methods = await client
        .from(_paymentMethodsTable)
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);
    final hasPaymentMethod = methods.whereType<Map>().isNotEmpty;

    // Country lives on the profile; treat any read error as "unknown country".
    String? country;
    try {
      final profile = await client
          .from(_profilesTable)
          .select('location')
          .eq('id', userId)
          .maybeSingle();
      country = profile?['location']?.toString();
      if (country != null && country.isEmpty) country = null;
    } catch (_) {
      country = null;
    }

    final canBuy = eligibilityRow?['can_buy'] != false;
    final canSell = eligibilityRow?['can_sell'] == true;
    final firstDone = eligibilityRow?['first_p2p_trade_completed'] == true;
    final completed =
        int.tryParse(eligibilityRow?['completed_trades']?.toString() ?? '0') ??
        0;
    final disputes =
        int.tryParse(eligibilityRow?['dispute_count']?.toString() ?? '0') ?? 0;

    final reasons = <String>[
      if (!hasPaymentMethod) 'Add a payment method to start trading',
      if (country == null) 'Set your country in profile settings',
    ];

    return P2PEligibility(
      canBuy: canBuy,
      canSell: canSell,
      hasPaymentMethod: hasPaymentMethod,
      hasCompletedFirstTrade: firstDone,
      completedTrades: completed,
      disputeCount: disputes,
      userCountry: country,
      reasons: reasons,
    );
  }

  // --- Listings -----------------------------------------------------------

  /// Active marketplace listings, newest first. Optionally excludes the
  /// current user's own listings (default keeps them, as the web does).
  Future<List<P2PListing>> fetchActiveListings({int limit = 50}) async {
    final client = _client;
    if (client == null) return const [];

    final rows = await client
        .from(_listingsTable)
        .select(
          'id, seller_id, credits_amount, price_cents, currency, status, '
          'created_at, seller:$_profilesTable!seller_id($_profileEmbed)',
        )
        .eq('status', 'active')
        .order('created_at', ascending: false)
        .limit(limit);

    return rows
        .whereType<Map>()
        .map((row) => P2PListing.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  /// The current user's own listings (any status), newest first.
  Future<List<P2PListing>> fetchMyListings() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_listingsTable)
        .select(
          'id, seller_id, credits_amount, price_cents, currency, status, '
          'created_at',
        )
        .eq('seller_id', userId)
        .order('created_at', ascending: false);

    return rows
        .whereType<Map>()
        .map((row) => P2PListing.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  /// Create a sell listing. [priceCents] is the total price in minor units of
  /// [currency]. Returns the created listing, or null when unconfigured.
  ///
  /// RLS ("Users can create own p2p listings") allows inserting a row whose
  /// `seller_id` is the current user.
  Future<P2PListing?> createListing({
    required int creditsAmount,
    required int priceCents,
    required String currency,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;

    final inserted = await client
        .from(_listingsTable)
        .insert({
          'seller_id': userId,
          'credits_amount': creditsAmount,
          'price_cents': priceCents,
          'currency': currency,
          'status': 'active',
        })
        .select(
          'id, seller_id, credits_amount, price_cents, currency, status, '
          'created_at',
        )
        .maybeSingle();

    if (inserted == null) return null;
    return P2PListing.fromJson(Map<String, Object?>.from(inserted));
  }

  /// Cancel one of the current user's own listings by flipping its status.
  Future<void> cancelListing(String listingId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return;

    await client
        .from(_listingsTable)
        .update({'status': 'cancelled'})
        .eq('id', listingId)
        .eq('seller_id', userId);
  }

  // --- Transactions -------------------------------------------------------

  /// Every transaction the current user is a party to (buyer or seller),
  /// newest first.
  Future<List<P2PTransaction>> fetchMyTransactions() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_transactionsTable)
        .select(
          'id, listing_id, buyer_id, seller_id, credits_amount, price_cents, '
          'currency, status, escrow_locked, expires_at, created_at, '
          'buyer:$_profilesTable!buyer_id($_profileEmbed), '
          'seller:$_profilesTable!seller_id($_profileEmbed)',
        )
        .or('buyer_id.eq.$userId,seller_id.eq.$userId')
        .order('created_at', ascending: false);

    return rows
        .whereType<Map>()
        .map((row) => P2PTransaction.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  /// Start a transaction and lock the listing's credits server-side.
  Future<P2PTransaction?> initiatePurchase(
    P2PListing listing, {
    String? idempotencyKey,
  }) async {
    if (!_canInvokeRpc) return null;
    final listingId = _requiredValue(listing.id, label: 'listing');
    final key = _requiredValue(
      idempotencyKey ?? _idempotencyKeyFactory?.call() ?? const Uuid().v4(),
      label: 'idempotency key',
    );
    final row = await _invokeRowRpc(
      functionName: 'p2p_start_transaction',
      parameters: {'p_listing_id': listingId, 'p_idempotency_key': key},
      operation: 'start this order',
      nestedKey: 'transaction',
      requiredColumns: _transactionRequiredColumns,
    );
    return P2PTransaction.fromJson(row);
  }

  /// Submit payment proof and return the updated transaction.
  Future<P2PTransaction> submitPaymentProof({
    required String transactionId,
    required String proofUrl,
    String? notes,
  }) {
    return _submitPaymentProof(
      transactionId: transactionId,
      proofUrl: _requiredValue(proofUrl, label: 'payment proof URL'),
      notes: notes,
    );
  }

  /// Backward-compatible entry point for marking buyer payment as submitted.
  Future<void> markProofSubmitted(String transactionId) async {
    await _submitPaymentProof(transactionId: transactionId, proofUrl: null);
  }

  Future<P2PTransaction> _submitPaymentProof({
    required String transactionId,
    required String? proofUrl,
    String? notes,
  }) async {
    _requireRpcAccess('submit payment proof');
    final row = await _invokeRowRpc(
      functionName: 'p2p_submit_payment_proof',
      parameters: {
        'p_transaction_id': _requiredValue(transactionId, label: 'transaction'),
        'p_proof_url': proofUrl,
        'p_notes': _trimmedOrNull(notes),
      },
      operation: 'submit payment proof',
      nestedKey: 'transaction',
      requiredColumns: _transactionRequiredColumns,
    );
    return P2PTransaction.fromJson(row);
  }

  /// Release escrowed credits to the buyer (seller only).
  Future<P2PTransaction> releaseCredits(String transactionId) async {
    _requireRpcAccess('release credits');
    final row = await _invokeRowRpc(
      functionName: 'p2p_release_credits',
      parameters: {
        'p_transaction_id': _requiredValue(transactionId, label: 'transaction'),
      },
      operation: 'release credits',
      nestedKey: 'transaction',
      requiredColumns: _transactionRequiredColumns,
    );
    return P2PTransaction.fromJson(row);
  }

  /// Cancel a transaction, preserving the original void-returning API.
  Future<void> cancelTransaction(String transactionId) async {
    await cancelTransactionWithResult(transactionId);
  }

  /// Cancel a transaction and return the server-updated transaction.
  Future<P2PTransaction> cancelTransactionWithResult(
    String transactionId,
  ) async {
    _requireRpcAccess('cancel this order');
    final row = await _invokeRowRpc(
      functionName: 'p2p_cancel_transaction',
      parameters: {
        'p_transaction_id': _requiredValue(transactionId, label: 'transaction'),
      },
      operation: 'cancel this order',
      nestedKey: 'transaction',
      requiredColumns: _transactionRequiredColumns,
    );
    return P2PTransaction.fromJson(row);
  }

  // --- Payment methods ----------------------------------------------------

  Future<List<P2PPaymentMethod>> fetchPaymentMethods() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final rows = await client
        .from(_paymentMethodsTable)
        .select(
          'id, method_type, account_name, account_number, bank_name, '
          'bank_code, country_code, is_default, is_active',
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', ascending: false)
        .order('created_at', ascending: false);

    return rows
        .whereType<Map>()
        .map((row) => P2PPaymentMethod.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  /// Add a bank payout method for the current user.
  Future<P2PPaymentMethod?> addPaymentMethod({
    required String accountName,
    required String accountNumber,
    required String bankName,
    required String countryCode,
    bool makeDefault = false,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;

    // If this is being set as default, clear the previous default first.
    if (makeDefault) {
      await client
          .from(_paymentMethodsTable)
          .update({'is_default': false})
          .eq('user_id', userId)
          .eq('is_default', true);
    }

    final inserted = await client
        .from(_paymentMethodsTable)
        .insert({
          'user_id': userId,
          'method_type': 'bank',
          'account_name': accountName,
          'account_number': accountNumber,
          'bank_name': bankName,
          'country_code': countryCode,
          'is_default': makeDefault,
          'is_active': true,
        })
        .select(
          'id, method_type, account_name, account_number, bank_name, '
          'bank_code, country_code, is_default, is_active',
        )
        .maybeSingle();

    if (inserted == null) return null;
    return P2PPaymentMethod.fromJson(Map<String, Object?>.from(inserted));
  }

  Future<void> setDefaultPaymentMethod(String methodId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return;

    await client
        .from(_paymentMethodsTable)
        .update({'is_default': false})
        .eq('user_id', userId);
    await client
        .from(_paymentMethodsTable)
        .update({'is_default': true})
        .eq('id', methodId)
        .eq('user_id', userId);
  }

  /// Soft-delete a payment method (keeps history; matches `is_active` flag).
  Future<void> deletePaymentMethod(String methodId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return;
    await client
        .from(_paymentMethodsTable)
        .update({'is_active': false})
        .eq('id', methodId)
        .eq('user_id', userId);
  }

  // --- Chat ---------------------------------------------------------------

  Future<List<P2PChatMessage>> fetchChat(String transactionId) async {
    final client = _client;
    if (client == null) return const [];

    final rows = await client
        .from(_chatTable)
        .select(
          'id, transaction_id, sender_id, content, created_at, '
          'sender:$_profilesTable!sender_id($_profileEmbed)',
        )
        .eq('transaction_id', transactionId)
        .order('created_at');

    return rows
        .whereType<Map>()
        .map((row) => P2PChatMessage.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }

  Future<void> sendChatMessage({
    required String transactionId,
    required String content,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return;

    await client.from(_chatTable).insert({
      'transaction_id': transactionId,
      'sender_id': userId,
      'content': content,
    });
  }

  // --- Disputes -----------------------------------------------------------

  Future<P2PDispute?> fetchDispute(String transactionId) async {
    final client = _client;
    if (client == null) return null;

    final row = await client
        .from(_disputesTable)
        .select(
          'id, transaction_id, initiated_by, moderator_id, reason, status, '
          'resolution, created_at, resolved_at',
        )
        .eq('transaction_id', transactionId)
        .maybeSingle();
    if (row == null) return null;
    return P2PDispute.fromJson(Map<String, Object?>.from(row));
  }

  Future<P2PDispute?> openDispute({
    required String transactionId,
    required String reason,
  }) async {
    if (!_canInvokeRpc) return null;
    final row = await _invokeRowRpc(
      functionName: 'p2p_open_dispute',
      parameters: {
        'p_transaction_id': _requiredValue(transactionId, label: 'transaction'),
        'p_reason': _requiredValue(reason, label: 'dispute reason'),
      },
      operation: 'open this dispute',
      nestedKey: 'dispute',
      requiredColumns: _disputeRequiredColumns,
    );
    return P2PDispute.fromJson(row);
  }

  void _requireRpcAccess(String operation) {
    if (!_canInvokeRpc) {
      throw P2PBackendUnavailable('Sign in to $operation.');
    }
  }

  Future<Map<String, Object?>> _invokeRowRpc({
    required String functionName,
    required Map<String, Object?> parameters,
    required String operation,
    required String nestedKey,
    required Set<String> requiredColumns,
  }) async {
    try {
      final result = await _rpc(functionName, parameters);
      return _parseRpcRow(
        result,
        operation: operation,
        nestedKey: nestedKey,
        requiredColumns: requiredColumns,
      );
    } on P2PBackendUnavailable {
      rethrow;
    } on PostgrestException catch (error) {
      throw P2PBackendUnavailable(
        _postgrestMessage(error, fallback: 'Could not $operation.'),
        cause: error,
      );
    } catch (error) {
      throw P2PBackendUnavailable('Could not $operation.', cause: error);
    }
  }
}

const _transactionRequiredColumns = {
  'id',
  'buyer_id',
  'seller_id',
  'credits_amount',
  'price_cents',
  'currency',
  'status',
  'escrow_locked',
  'created_at',
};

const _disputeRequiredColumns = {
  'id',
  'transaction_id',
  'initiated_by',
  'status',
  'created_at',
};

Map<String, Object?> _parseRpcRow(
  dynamic response, {
  required String operation,
  required String nestedKey,
  required Set<String> requiredColumns,
}) {
  Object? candidate = response;
  if (candidate is List) {
    if (candidate.length != 1) {
      throw P2PBackendUnavailable(
        'Could not $operation because the server returned '
        '${candidate.length} rows.',
      );
    }
    candidate = candidate.single;
  }
  if (candidate is Map && candidate[nestedKey] is Map) {
    candidate = candidate[nestedKey];
  }
  if (candidate is! Map) {
    throw P2PBackendUnavailable(
      'Could not $operation because the server returned an invalid response.',
    );
  }

  final row = Map<String, Object?>.from(candidate);
  final missing = requiredColumns.where((column) {
    final value = row[column];
    return value == null || value.toString().trim().isEmpty;
  }).toList();
  if (missing.isNotEmpty) {
    throw P2PBackendUnavailable(
      'Could not $operation because the server response was missing '
      '${missing.join(', ')}.',
    );
  }
  return row;
}

String _requiredValue(String value, {required String label}) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    throw P2PBackendUnavailable('A valid $label is required.');
  }
  return trimmed;
}

String? _trimmedOrNull(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

String _postgrestMessage(PostgrestException error, {required String fallback}) {
  final message = error.message.trim();
  return message.isEmpty ? fallback : message;
}

/// Raised when a server-authoritative P2P operation cannot complete.
class P2PBackendUnavailable implements Exception {
  const P2PBackendUnavailable(this.message, {this.cause});
  final String message;
  final Object? cause;

  @override
  String toString() => 'P2PBackendUnavailable: $message';
}
