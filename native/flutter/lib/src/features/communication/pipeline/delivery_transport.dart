import '../core/encryption/encryption_codec.dart';
import '../domain/message_envelope.dart';
import '../domain/result.dart';

/// A page of changed envelopes from the server plus the cursor state after
/// consuming it. [nextCursor] is the resume point covering everything in this
/// page (null only when the page is empty); [hasMore] tells the caller whether
/// another page should be fetched immediately.
class SyncPage {
  const SyncPage({
    required this.envelopes,
    this.nextCursor,
    this.hasMore = false,
  });

  final List<MessageEnvelope> envelopes;
  final String? nextCursor;
  final bool hasMore;
}

/// Provider-agnostic delivery + history transport. The Supabase adapter (a later
/// subsystem) implements this over the canonical `send_message` /
/// `get_changed_message_envelopes` RPCs; tests use a fake. This is the ONLY
/// seam through which the messaging backend SDK enters the pipeline.
abstract interface class DeliveryTransport {
  /// Deliver one message. [payload] is the (possibly encrypted) wire body.
  /// Returns the server-assigned revision on success. Must be idempotent on
  /// [envelope.id] — redelivering an already-accepted id returns its revision.
  Future<Result<int>> deliver(MessageEnvelope envelope, EncryptedPayload payload);

  /// Fetch envelopes changed since [cursor] (null = from the beginning),
  /// oldest-first, at most [limit] per page.
  Future<Result<SyncPage>> fetchChanges({String? cursor, int limit});
}
