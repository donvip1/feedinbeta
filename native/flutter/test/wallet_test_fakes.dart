import 'package:feedin/src/features/wallet/data/wallet_models.dart';
import 'package:feedin/src/features/wallet/data/wallet_remote_data_source.dart';

class FakeWalletDataSource implements WalletDataSource {
  CreditBalance balance = CreditBalance.empty;
  List<CreditPackage> packages = const [];
  List<CreditTransaction> transactions = const [];
  List<SubscriptionTier> tiers = const [];
  UserSubscription? activeSubscription;
  CreatorMonetization monetization = CreatorMonetization.empty;
  List<PayoutRequest> payoutRequests = const [];
  List<PayoutDestination> payoutDestinations = const [];
  List<PaystackBank> payoutBanks = const [];
  VerifiedPayoutAccount? verifiedPayoutAccount;
  PayoutDestination? savedPayoutDestination;

  WalletCheckoutSession? creditCheckout;
  WalletCheckoutSession? subscriptionCheckout;
  WalletCheckoutVerification? verification;
  Object? verificationError;
  PayoutRequest? payoutResponse;
  Object? payoutError;

  int verifyCalls = 0;
  int payoutCalls = 0;
  String? verifiedReference;

  @override
  Future<CreditBalance> fetchBalance() async => balance;

  @override
  Future<List<CreditPackage>> fetchPackages() async => packages;

  @override
  Future<List<CreditTransaction>> fetchTransactions({int limit = 100}) async {
    return transactions.take(limit).toList();
  }

  @override
  Future<List<SubscriptionTier>> fetchTiers() async => tiers;

  @override
  Future<UserSubscription?> fetchActiveSubscription() async {
    return activeSubscription;
  }

  @override
  Future<CreatorMonetization> fetchMonetization() async => monetization;

  @override
  Future<List<PayoutRequest>> fetchMyPayoutRequests({int limit = 20}) async {
    return payoutRequests.take(limit).toList();
  }

  @override
  Future<List<PayoutDestination>> fetchPayoutDestinations() async {
    return payoutDestinations;
  }

  @override
  Future<List<PaystackBank>> fetchPaystackBanks() async => payoutBanks;

  @override
  Future<VerifiedPayoutAccount> verifyPayoutAccount({
    required String bankCode,
    required String accountNumber,
  }) async {
    final account = verifiedPayoutAccount;
    if (account == null) throw StateError('Missing verified payout account');
    return account;
  }

  @override
  Future<PayoutDestination> savePayoutDestination({
    required PaystackBank bank,
    required String accountNumber,
  }) async {
    final destination = savedPayoutDestination;
    if (destination == null) throw StateError('Missing payout destination');
    payoutDestinations = [destination];
    return destination;
  }

  @override
  Future<WalletCheckoutSession> startCreditCheckout(String packageId) async {
    final session = creditCheckout;
    if (session == null || session.itemId != packageId) {
      throw StateError('Missing credit checkout for $packageId');
    }
    return session;
  }

  @override
  Future<WalletCheckoutSession> startSubscriptionCheckout(String tierId) async {
    final session = subscriptionCheckout;
    if (session == null || session.itemId != tierId) {
      throw StateError('Missing subscription checkout for $tierId');
    }
    return session;
  }

  @override
  Future<WalletCheckoutVerification> verifyCheckout(String reference) async {
    verifyCalls++;
    verifiedReference = reference;
    final error = verificationError;
    if (error != null) throw error;
    final result = verification;
    if (result == null) throw StateError('Missing checkout verification');
    return result;
  }

  @override
  Future<void> transferCredits({
    required String recipientUsername,
    required int amount,
  }) async {}

  @override
  Future<void> sendDirectGift({
    required String recipientIdentifier,
    required String giftType,
    required int creditValue,
  }) async {}

  @override
  Future<PayoutRequest> requestPayout({required double amount}) async {
    payoutCalls++;
    final error = payoutError;
    if (error != null) throw error;
    final response = payoutResponse;
    if (response == null) throw StateError('Missing payout response');
    payoutRequests = [
      response,
      ...payoutRequests.where((request) => request.id != response.id),
    ];
    return response;
  }
}

WalletCheckoutSession fakeCheckoutSession({
  required WalletCheckoutKind kind,
  required String itemId,
  String reference = 'fi_reference',
  String paymentIntentId = 'intent-id',
}) {
  return WalletCheckoutSession(
    kind: kind,
    itemId: itemId,
    authorizationUri: Uri.parse('https://checkout.example.com/pay'),
    reference: reference,
    paymentIntentId: paymentIntentId,
    idempotencyKey: 'idempotency-key',
    reused: false,
  );
}
