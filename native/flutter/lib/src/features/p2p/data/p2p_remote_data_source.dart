import 'package:supabase_flutter/supabase_flutter.dart';

import 'p2p_models.dart';

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
/// * writes become no-ops in the same conditions.
///
/// BACKEND GAP: there are no P2P escrow/transfer RPCs in the live schema. The
/// credit-moving side of a trade (lock escrow, release credits, refund) must be
/// done server-side (RLS forbids clients writing arbitrary `user_credits`).
/// Until those RPCs exist, [initiatePurchase], [releaseCredits] and
/// [cancelTransaction] insert/patch the tracking rows the client is allowed to
/// touch and surface a [P2PBackendUnavailable] for the money-moving step so the
/// UI can show an honest "pending backend" state rather than silently succeed.
class P2PRemoteDataSource {
  const P2PRemoteDataSource({required this.isConfigured});

  /// Detects configuration from whether the Supabase singleton is initialised,
  /// mirroring the social-graph data source factory.
  factory P2PRemoteDataSource.autoDetect() {
    return P2PRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _listingsTable = 'p2p_listings';
  static const _transactionsTable = 'p2p_transactions';
  static const _paymentMethodsTable = 'p2p_payment_methods';
  static const _eligibilityTable = 'p2p_user_eligibility';
  static const _chatTable = 'p2p_chat_messages';
  static const _disputesTable = 'p2p_disputes';
  static const _userCreditsTable = 'user_credits';
  static const _profilesTable = 'profiles';

  static const _profileEmbed =
      'id, display_name, username, avatar_url';

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

  /// Initiate a purchase against [listing]. Inserts the `p2p_transactions`
  /// tracking row the buyer is allowed to create (RLS: "Buyers can create p2p
  /// transactions"). Returns the created transaction.
  ///
  /// BACKEND GAP: this does NOT lock seller credits into escrow — that requires
  /// a server-side RPC (clients cannot mutate the seller's `user_credits`). The
  /// returned transaction therefore starts `pending` with `escrow_locked` left
  /// to whatever the backend sets. Throws [P2PBackendUnavailable] if the insert
  /// is refused so the UI can present an honest failure.
  Future<P2PTransaction?> initiatePurchase(P2PListing listing) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;

    try {
      final inserted = await client
          .from(_transactionsTable)
          .insert({
            'listing_id': listing.id,
            'buyer_id': userId,
            'seller_id': listing.sellerId,
            'credits_amount': listing.creditsAmount,
            'price_cents': listing.priceCents,
            'currency': listing.currency,
            'status': 'pending',
          })
          .select(
            'id, listing_id, buyer_id, seller_id, credits_amount, '
            'price_cents, currency, status, escrow_locked, expires_at, '
            'created_at',
          )
          .maybeSingle();
      if (inserted == null) return null;
      return P2PTransaction.fromJson(Map<String, Object?>.from(inserted));
    } on PostgrestException catch (error) {
      throw P2PBackendUnavailable(
        'Could not start this order. Escrow requires a server-side transfer '
        'that is not available yet.',
        cause: error,
      );
    }
  }

  /// Mark a transaction's payment proof as submitted (buyer side).
  ///
  /// BACKEND GAP: the live schema has no UPDATE policy on `p2p_transactions`
  /// (only INSERT for buyers + SELECT for parties), so a client-side status
  /// change is refused by RLS and affects zero rows. We `select()` the row back
  /// and throw [P2PBackendUnavailable] when the change did not persist, so the
  /// UI shows an honest "needs a server contract" state instead of a fake
  /// success. Wire this to a `submit_p2p_payment_proof` RPC when available.
  Future<void> markProofSubmitted(String transactionId) =>
      _updateTransactionStatus(transactionId, 'proof_submitted');

  /// Cancel a transaction (buyer or seller). Same RLS caveat as
  /// [markProofSubmitted]: credit refunds and the status flip are a backend
  /// concern, so an unpermitted no-op is surfaced honestly.
  Future<void> cancelTransaction(String transactionId) =>
      _updateTransactionStatus(transactionId, 'cancelled');

  /// Attempts a client-side status change and verifies it persisted. Throws
  /// [P2PBackendUnavailable] when RLS refuses the write (row unchanged / not
  /// returned) or the RPC/table is missing.
  Future<void> _updateTransactionStatus(
    String transactionId,
    String status,
  ) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const P2PBackendUnavailable('Sign in to update this order.');
    }
    try {
      final updated = await client
          .from(_transactionsTable)
          .update({'status': status})
          .eq('id', transactionId)
          .select('id, status')
          .maybeSingle();
      if (updated == null || updated['status']?.toString() != status) {
        throw const P2PBackendUnavailable(
          'This step needs a server-side transfer that is not available yet. '
          'Your order status is managed by the backend.',
        );
      }
    } on PostgrestException catch (error) {
      throw P2PBackendUnavailable(
        'Could not update this order. It needs a server-side contract that is '
        'not available in this build yet.',
        cause: error,
      );
    }
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
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;

    final inserted = await client
        .from(_disputesTable)
        .insert({
          'transaction_id': transactionId,
          'initiated_by': userId,
          'reason': reason,
          'status': 'open',
        })
        .select(
          'id, transaction_id, initiated_by, moderator_id, reason, status, '
          'resolution, created_at, resolved_at',
        )
        .maybeSingle();

    if (inserted == null) return null;
    return P2PDispute.fromJson(Map<String, Object?>.from(inserted));
  }
}

/// Raised when a money-moving P2P operation cannot complete because the
/// required server-side RPC (escrow lock / credit release / refund) does not
/// exist in the live schema. The UI treats this as a soft, honest failure.
class P2PBackendUnavailable implements Exception {
  const P2PBackendUnavailable(this.message, {this.cause});
  final String message;
  final Object? cause;

  @override
  String toString() => 'P2PBackendUnavailable: $message';
}
