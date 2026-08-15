import 'package:feedin/src/features/gifts/data/gift_remote_data_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'sendPostGift forwards one idempotency key and parses the receipt',
    () async {
      String? functionName;
      Map<String, dynamic>? parameters;
      final dataSource = GiftRemoteDataSource(
        isConfigured: true,
        rpcInvoker: (name, params) async {
          functionName = name;
          parameters = params;
          return {
            'gift_record_id': 'receipt-1',
            'balance_after': 70,
            'recipient_balance_after': 24,
            'notification_id': 'notification-1',
            'recipient_credit_value': 24,
            'platform_fee_credits': 6,
            'assets': {'key': 'golden-star', 'version': 2},
          };
        },
      );

      final result = await dataSource.sendPostGift(
        giftId: 'gift-1',
        postId: 'post-1',
        idempotencyKey: 'attempt-1',
      );

      expect(functionName, 'send_post_gift');
      expect(parameters, {
        'p_gift_id': 'gift-1',
        'p_post_id': 'post-1',
        'p_idempotency_key': 'attempt-1',
      });
      expect(result.giftRecordId, 'receipt-1');
      expect(result.balanceAfter, 70);
      expect(result.recipientBalanceAfter, 24);
      expect(result.notificationId, 'notification-1');
      expect(result.recipientCreditValue, 24);
      expect(result.platformFeeCredits, 6);
      expect(result.assets.version, 2);
    },
  );

  test('sendPostGift rejects a malformed RPC response', () async {
    final dataSource = GiftRemoteDataSource(
      isConfigured: true,
      rpcInvoker: (_, _) async => const ['not-a-receipt'],
    );

    expect(
      () => dataSource.sendPostGift(
        giftId: 'gift-1',
        postId: 'post-1',
        idempotencyKey: 'attempt-1',
      ),
      throwsA(
        predicate((error) => error.toString().contains('INVALID_RESPONSE')),
      ),
    );
  });
}
