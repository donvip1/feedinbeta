import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'gift_models.dart';
import 'gift_repository.dart';

class GiftRemoteDataSource implements GiftRepository {
  const GiftRemoteDataSource({required this.isConfigured});

  factory GiftRemoteDataSource.autoDetect() {
    try {
      Supabase.instance.client;
      return const GiftRemoteDataSource(isConfigured: true);
    } catch (_) {
      return const GiftRemoteDataSource(isConfigured: false);
    }
  }

  final bool isConfigured;

  SupabaseClient get _client => Supabase.instance.client;

  @override
  Future<List<GiftCatalogItem>> fetchPostGifts() async {
    if (!isConfigured) return const [];
    try {
      final rows = await _client
          .from('gift_catalog')
          .select(
            'id, key, name, tier, credit_cost, poster_url, idle_url, '
            'preview_url, send_url, sound_url, asset_version, asset_hashes, '
            'fallback_asset_key, minimum_client_version, display_order',
          )
          .eq('is_active', true)
          .contains('supported_sources', ['post'])
          .order('display_order');
      return [
        for (final row in rows.whereType<Map>())
          GiftCatalogItem.fromJson(Map<String, dynamic>.from(row)),
      ];
    } on PostgrestException catch (error) {
      throw GiftFailure.fromCode(error.message);
    }
  }

  @override
  Future<GiftSendResult> sendPostGift({
    required String giftId,
    required String postId,
    required String idempotencyKey,
  }) async {
    if (!isConfigured) throw const GiftUnavailable();
    try {
      final raw = await _client.rpc(
        'send_post_gift',
        params: {
          'p_gift_id': giftId,
          'p_post_id': postId,
          'p_idempotency_key': idempotencyKey,
        },
      );
      if (raw is! Map) throw UnknownGiftFailure('INVALID_RESPONSE');
      final map = Map<String, dynamic>.from(raw);
      final assets = map['assets'];
      final giftKey = assets is Map
          ? assets['key']?.toString() ?? 'gift'
          : 'gift';
      return GiftSendResult.fromJson(map, giftKey: giftKey);
    } on TimeoutException {
      throw const GiftTimeout();
    } on PostgrestException catch (error) {
      throw GiftFailure.fromCode(error.message);
    }
  }
}
