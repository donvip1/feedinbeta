import 'dart:async';

import '../core/encryption/encryption_codec.dart';
import '../data/message_store.dart';
import '../data/outbox.dart';
import '../data/sync_cursor_store.dart';
import '../domain/delivery_state.dart';
import '../domain/message_envelope.dart';
import '../domain/result.dart';
import 'delivery_transport.dart';

/// The one outgoing/incoming message pipeline for every conversation type.
///
/// Send path (Compose → Validation → Local Queue → Persistence → [Media, later]
/// → Encryption-Ready → Delivery → Confirmation):
///   [send] validates, persists optimistically (the UI can render immediately),
///   enqueues in the durable [Outbox], and triggers a drain. [drain] encrypts
///   each due envelope through the [EncryptionCodec] seam and hands it to the
///   [DeliveryTransport]; acknowledgements update the store, failures follow the
///   outbox's backoff/dead-letter policy — a message is never stuck and never
///   silently lost.
///
/// Receive path (Realtime Sync → History Sync → Archive):
///   [applyRemote] merges one pushed envelope; [reconcile] pages
///   `fetchChanges` from the persisted cursor until caught up — the multi-device
///   and missed-event recovery mechanism.
class MessagePipeline {
  MessagePipeline({
    required MessageStore store,
    required Outbox outbox,
    required SyncCursorStore cursors,
    required DeliveryTransport transport,
    required EncryptionCodec codec,
    int Function()? nowMillis,
  }) : _store = store,
       _outbox = outbox,
       _cursors = cursors,
       _transport = transport,
       _codec = codec,
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch);

  final MessageStore _store;
  final Outbox _outbox;
  final SyncCursorStore _cursors;
  final DeliveryTransport _transport;
  final EncryptionCodec _codec;
  final int Function() _now;

  static const String messagesCursorScope = 'messages';

  final _updates = StreamController<MessageEnvelope>.broadcast();

  /// Every stored change (local echo, ack, remote apply) — the thread UI's feed.
  Stream<MessageEnvelope> get updates => _updates.stream;

  Future<int>? _drainInFlight;

  // -- Send ------------------------------------------------------------------

  /// Validate + persist + enqueue [envelope]; returns the optimistic stored
  /// copy (state `queued`) or a validation error. Triggers an async drain.
  ///
  /// Idempotent: re-sending an id the server already acknowledged is a no-op
  /// (the merged stored copy is returned and nothing is re-enqueued).
  Future<Result<MessageEnvelope>> send(MessageEnvelope envelope) async {
    final valid = envelope.validate();
    if (valid.isErr) return Err(valid.errorOrNull!);

    final queued = envelope.copyWith(deliveryState: DeliveryState.queued);
    final stored = await _store.upsert(queued);
    if (stored.isAcknowledged) {
      // Duplicate of an already-delivered message — nothing to do.
      return Ok(stored);
    }
    await _outbox.enqueue(
      messageId: stored.id,
      conversationId: stored.conversationId,
      nowMillis: _now(),
    );
    _updates.add(stored);
    unawaited(drain());
    return Ok(stored);
  }

  /// Attempt delivery of every due outbox entry. Concurrent calls coalesce onto
  /// the SAME in-flight pass (awaiting `drain()` always means "a full pass has
  /// completed"). Returns the number of messages acknowledged by that pass.
  Future<int> drain() {
    final inFlight = _drainInFlight;
    if (inFlight != null) return inFlight;
    final pass = _drainPass();
    _drainInFlight = pass;
    pass.whenComplete(() {
      if (identical(_drainInFlight, pass)) _drainInFlight = null;
    });
    return pass;
  }

  Future<int> _drainPass() async {
    var acknowledged = 0;
    final due = await _outbox.claimDue(nowMillis: _now());
    for (final entry in due) {
      final envelope = await _store.getById(entry.messageId);
      if (envelope == null) {
        // Store row vanished (e.g. deleted locally) — drop the orphan.
        await _outbox.remove(entry.messageId);
        continue;
      }
      final payload = _codec.encrypt(
        envelope.conversationId,
        envelope.content.toJson(),
      );
      final result = await _transport.deliver(
        envelope.copyWith(encryption: payload.info),
        payload,
      );
      await result.fold(
        (revision) async {
          final acked = await _store.upsert(
            envelope.copyWith(
              revision: revision,
              deliveryState: DeliveryState.sent,
              encryption: payload.info,
            ),
          );
          await _outbox.markSent(envelope.id);
          _updates.add(acked);
          acknowledged += 1;
        },
        (error) async {
          await _outbox.markFailed(
            messageId: envelope.id,
            error: error,
            nowMillis: _now(),
          );
          final deadNow = (await _outbox.deadLetters())
              .any((d) => d.messageId == envelope.id);
          if (deadNow) {
            final failed = await _store.upsert(
              envelope.copyWith(deliveryState: DeliveryState.failed),
            );
            _updates.add(failed);
          }
        },
      );
    }
    return acknowledged;
  }

  /// User-initiated retry of a dead-lettered message.
  Future<void> retryFailed(String messageId) async {
    await _outbox.retryDeadLetter(messageId, nowMillis: _now());
    await _store.setDeliveryState(messageId, DeliveryState.queued);
    final refreshed = await _store.getById(messageId);
    if (refreshed != null) _updates.add(refreshed);
    unawaited(drain());
  }

  // -- Receive ---------------------------------------------------------------

  /// Merge one envelope pushed by realtime. Conflict-safe: the store's merge
  /// keeps the authoritative copy, so a stale echo never regresses state.
  Future<MessageEnvelope> applyRemote(MessageEnvelope remote) async {
    final stored = await _store.upsert(remote);
    _updates.add(stored);
    return stored;
  }

  /// Page changes from the persisted cursor until the server says caught-up.
  /// Applies every envelope through the same merge as realtime, then persists
  /// the advanced cursor after EVERY page — so a crash mid-reconcile resumes,
  /// never re-diverges, and the final page is never refetched. Returns the
  /// number of envelopes applied.
  Future<Result<int>> reconcile({int pageLimit = 100}) async {
    var applied = 0;
    var cursor = await _cursors.read(messagesCursorScope);
    while (true) {
      final page = await _transport.fetchChanges(
        cursor: cursor,
        limit: pageLimit,
      );
      if (page.isErr) return Err(page.errorOrNull!);
      final value = page.valueOrNull!;
      for (final envelope in value.envelopes) {
        await applyRemote(envelope);
        applied += 1;
      }
      if (value.nextCursor != null) {
        cursor = value.nextCursor;
        await _cursors.write(messagesCursorScope, cursor!, nowMillis: _now());
      }
      if (!value.hasMore) break;
    }
    return Ok(applied);
  }

  Future<void> dispose() async {
    await _updates.close();
  }
}
