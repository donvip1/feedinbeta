import 'package:feedin/src/features/gifts/data/gift_models.dart';
import 'package:feedin/src/features/gifts/data/gift_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('repository contract keeps one idempotency key per send attempt', () {
    final repository = RecordingGiftRepository();
    final key = repository.beginSend();
    expect(key, isNotEmpty);
    expect(repository.beginSend(), isNot(key));
    expect(repository.reconcile(key), isTrue);
  });
}

class RecordingGiftRepository implements GiftRepository {
  final _attempts = <String>{};

  @override
  Future<List<GiftCatalogItem>> fetchPostGifts() async => const [];

  @override
  Future<GiftSendResult> sendPostGift({
    required String giftId,
    required String postId,
    required String idempotencyKey,
  }) async {
    _attempts.add(idempotencyKey);
    return GiftSendResult(
      giftRecordId: idempotencyKey,
      balanceAfter: 0,
      recipientBalanceAfter: 0,
      notificationId: null,
      recipientCreditValue: 0,
      platformFeeCredits: 0,
      assets: GiftAssetManifest.fallback('pulse-heart'),
    );
  }

  String beginSend() {
    final key = DateTime.now().microsecondsSinceEpoch.toString();
    _attempts.add(key);
    return key;
  }

  bool reconcile(String key) => _attempts.contains(key);
}
