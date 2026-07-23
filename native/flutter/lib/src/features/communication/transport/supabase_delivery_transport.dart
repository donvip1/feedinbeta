import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/encryption/encryption_codec.dart';
import '../domain/message_envelope.dart';
import '../domain/result.dart';
import '../pipeline/delivery_transport.dart';
import 'supabase_wire_codec.dart';

/// The Supabase implementation of [DeliveryTransport], speaking the canonical
/// `send_message` / `get_changed_message_envelopes` RPC contract.
///
/// Deliberately THIN: every mapping/classification decision lives in the pure
/// [SupabaseWireCodec] (unit-tested without a network); this class only invokes
/// RPCs and forwards results. The [client] is injectable for integration tests.
class SupabaseDeliveryTransport implements DeliveryTransport {
  SupabaseDeliveryTransport({SupabaseClient? client}) : _client = client;

  final SupabaseClient? _client;

  SupabaseClient? get _resolved {
    if (_client != null) return _client;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null; // Supabase not configured (e.g. tests, offline builds)
    }
  }

  @override
  Future<Result<int>> deliver(
    MessageEnvelope envelope,
    EncryptedPayload payload,
  ) async {
    final client = _resolved;
    if (client == null) {
      return Err(CommError.network('Backend not configured'));
    }
    final wire = SupabaseWireCodec.toWire(envelope);
    if (wire.isErr) return Err(wire.errorOrNull!);

    try {
      final response = await client.rpc<dynamic>(
        'send_message',
        params: {'p_message': wire.valueOrNull},
      );
      if (response is! Map) {
        return Err(CommError.network('Malformed send_message response'));
      }
      final revision = SupabaseWireCodec.revisionFromWire(
        response.cast<String, Object?>(),
      );
      // The server always bumps revision to >=1 on insert; 0 would mean we
      // failed to read the ack — treat as transient so the outbox retries
      // (idempotent by id, so a retry is safe).
      if (revision <= 0) {
        return Err(CommError.network('Missing revision in ack'));
      }
      return Ok(revision);
    } on PostgrestException catch (error) {
      return Err(SupabaseWireCodec.classifyError(error.message));
    } catch (error) {
      return Err(CommError.network('send_message failed', cause: error));
    }
  }

  @override
  Future<Result<SyncPage>> fetchChanges({String? cursor, int limit = 100}) async {
    final client = _resolved;
    if (client == null) {
      return Err(CommError.network('Backend not configured'));
    }
    final decoded = SupabaseWireCodec.decodeCursor(cursor);
    try {
      final response = await client.rpc<dynamic>(
        'get_changed_message_envelopes',
        params: {
          'p_after_updated_at': decoded?.updatedAt,
          'p_after_id': decoded?.id,
          'p_limit': limit,
        },
      );
      final rows = (response as List?)?.whereType<Map>().toList() ?? const [];
      final envelopes = <MessageEnvelope>[];
      String? nextCursor;
      for (final row in rows) {
        final wire = row.cast<String, Object?>();
        envelopes.add(SupabaseWireCodec.fromWire(wire));
        nextCursor = SupabaseWireCodec.cursorForWire(wire) ?? nextCursor;
      }
      return Ok(
        SyncPage(
          envelopes: envelopes,
          nextCursor: nextCursor,
          // A full page implies more may follow; a short page means caught up.
          hasMore: rows.length >= limit,
        ),
      );
    } on PostgrestException catch (error) {
      return Err(SupabaseWireCodec.classifyError(error.message));
    } catch (error) {
      return Err(CommError.network('fetchChanges failed', cause: error));
    }
  }
}
