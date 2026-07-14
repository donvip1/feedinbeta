import 'package:feedin/src/features/wallet/data/wallet_models.dart';
import 'package:feedin/src/features/wallet/data/wallet_remote_data_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('WalletServerContract checkout', () {
    test('parses the typed hosted checkout response', () {
      final session = WalletServerContract.parseCheckoutSession(
        {
          'authorization_url': 'https://checkout.example.com/pay',
          'reference': 'fi_reference',
          'payment_intent_id': 'intent-id',
          'idempotency_key': 'idempotency-key',
          'reused': true,
        },
        kind: WalletCheckoutKind.credits,
        itemId: 'package-id',
      );

      expect(session.kind, WalletCheckoutKind.credits);
      expect(session.itemId, 'package-id');
      expect(session.authorizationUri.host, 'checkout.example.com');
      expect(session.reference, 'fi_reference');
      expect(session.paymentIntentId, 'intent-id');
      expect(session.idempotencyKey, 'idempotency-key');
      expect(session.reused, isTrue);
    });

    test('rejects an incomplete or insecure checkout response', () {
      expect(
        () => WalletServerContract.parseCheckoutSession(
          {
            'authorization_url': 'http://checkout.example.com/pay',
            'reference': 'fi_reference',
            'payment_intent_id': 'intent-id',
            'idempotency_key': 'idempotency-key',
          },
          kind: WalletCheckoutKind.credits,
          itemId: 'package-id',
        ),
        throwsA(isA<WalletBackendUnavailable>()),
      );

      expect(
        () => WalletServerContract.parseCheckoutSession(
          {'authorization_url': 'https://checkout.example.com/pay'},
          kind: WalletCheckoutKind.subscription,
          itemId: 'tier-id',
        ),
        throwsA(isA<WalletBackendUnavailable>()),
      );
    });

    test('parses checkout verification details', () {
      final verification = WalletServerContract.parseCheckoutVerification({
        'success': true,
        'payment': {
          'payment_intent_id': 'intent-id',
          'status': 'completed',
          'already_processed': false,
          'purchase_type': 'subscription',
          'balance_after': 250,
          'subscription_id': 'subscription-id',
        },
      });

      expect(verification.isCompleted, isTrue);
      expect(verification.purchaseKind, WalletCheckoutKind.subscription);
      expect(verification.balanceAfter, 250);
      expect(verification.subscriptionId, 'subscription-id');
    });

    test('surfaces a typed verification error', () {
      expect(
        () => WalletServerContract.parseCheckoutVerification({
          'error': 'Payment has not been completed',
          'code': 'PAYMENT_NOT_COMPLETE',
        }),
        throwsA(
          isA<WalletCheckoutVerificationException>()
              .having((error) => error.isPaymentIncomplete, 'retryable', isTrue)
              .having(
                (error) => error.message,
                'message',
                'Payment has not been completed',
              ),
        ),
      );
    });
  });

  test('parses a nested payout request response', () {
    final request = WalletServerContract.parsePayoutRequest({
      'success': true,
      'request': {
        'id': 'payout-id',
        'amount': 20,
        'currency': 'USD',
        'status': 'pending',
        'requested_at': '2026-07-14T12:00:00Z',
      },
    });

    expect(request, isNotNull);
    expect(request!.id, 'payout-id');
    expect(request.isOpen, isTrue);
    expect(request.statusLabel, 'Pending');
  });

  test('parses payout bank and destination responses', () {
    final banks = WalletServerContract.parsePaystackBanks({
      'status': true,
      'data': [
        {'name': 'Zenith Bank', 'code': '057'},
        {'name': 'Access Bank', 'code': '044'},
      ],
    });
    final verified = WalletServerContract.parseVerifiedPayoutAccount({
      'status': true,
      'data': {
        'account_number': '0123456789',
        'account_name': 'FEEDIN CREATOR',
      },
    });
    final destination = WalletServerContract.parsePayoutDestination({
      'success': true,
      'destination': {
        'id': 'destination-id',
        'provider': 'paystack',
        'display_label': 'Access Bank - ****6789',
        'currency': 'NGN',
        'status': 'active',
        'is_default': true,
      },
    });

    expect(banks.map((bank) => bank.name), ['Access Bank', 'Zenith Bank']);
    expect(verified.accountName, 'FEEDIN CREATOR');
    expect(destination.displayLabel, 'Access Bank - ****6789');
    expect(destination.isDefault, isTrue);
  });
}
