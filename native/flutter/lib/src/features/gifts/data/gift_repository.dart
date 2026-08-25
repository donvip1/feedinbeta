import 'gift_models.dart';

abstract interface class GiftRepository {
  Future<List<GiftCatalogItem>> fetchPostGifts();

  Future<GiftSendResult> sendPostGift({
    required String giftId,
    required String postId,
    required String idempotencyKey,
  });
}
