import 'content_block.dart';
import 'delivery_state.dart';
import 'hybrid_clock.dart';
import 'result.dart';

/// Encryption metadata attached to every envelope. Today [alg] is `none`
/// (identity codec); enabling real E2EE later only changes this + the codec,
/// not the pipeline.
class EncryptionInfo {
  const EncryptionInfo({required this.alg, this.keyRef});

  final String alg;
  final String? keyRef;

  static const EncryptionInfo none = EncryptionInfo(alg: 'none');

  bool get isEncrypted => alg != 'none';

  Map<String, Object?> toJson() => {'alg': alg, if (keyRef != null) 'keyRef': keyRef};

  factory EncryptionInfo.fromJson(Map<String, Object?>? json) => json == null
      ? EncryptionInfo.none
      : EncryptionInfo(
          alg: json['alg']?.toString() ?? 'none',
          keyRef: json['keyRef']?.toString(),
        );
}

/// Disappearing-message metadata.
class Ephemeral {
  const Ephemeral({required this.ttlSeconds, this.expiresAtMillis});

  final int ttlSeconds;
  final int? expiresAtMillis;

  Map<String, Object?> toJson() => {
    'ttlSeconds': ttlSeconds,
    if (expiresAtMillis != null) 'expiresAtMillis': expiresAtMillis,
  };

  factory Ephemeral.fromJson(Map<String, Object?> json) => Ephemeral(
    ttlSeconds: (json['ttlSeconds'] as num?)?.toInt() ?? 0,
    expiresAtMillis: (json['expiresAtMillis'] as num?)?.toInt(),
  );
}

/// The canonical message. One immutable value object for every conversation
/// type and every content kind. Identity is the client-generated [id] (a UUID),
/// so the same logical message is deduped across devices and retries without an
/// optimistic-id reconciliation step. Ordering is by [sentAt] (HLC) with the
/// server [revision] breaking conflicts on edits.
class MessageEnvelope {
  const MessageEnvelope({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.sentAt,
    required this.content,
    this.revision = 0,
    this.replyToId,
    this.threadRootId,
    this.mentions = const [],
    this.deliveryState = DeliveryState.composing,
    this.editedAtMillis,
    this.deletedAtMillis,
    this.ephemeral,
    this.encryption = EncryptionInfo.none,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final HybridTimestamp sentAt;
  final ContentBlock content;

  /// Server-assigned monotonic revision; 0 until the server acknowledges.
  final int revision;

  final String? replyToId;
  final String? threadRootId;
  final List<String> mentions;
  final DeliveryState deliveryState;
  final int? editedAtMillis;
  final int? deletedAtMillis;
  final Ephemeral? ephemeral;
  final EncryptionInfo encryption;

  bool get isDeleted => deletedAtMillis != null;
  bool get isEdited => editedAtMillis != null;
  bool get isAcknowledged => revision > 0 && deliveryState.isAcknowledged;

  /// Validate before the message is allowed into the outbox.
  Result<void> validate() {
    if (id.isEmpty) return Err(CommError.validation('Message id is empty'));
    if (conversationId.isEmpty) {
      return Err(CommError.validation('conversationId is empty'));
    }
    if (senderId.isEmpty) {
      return Err(CommError.validation('senderId is empty'));
    }
    return content.validate();
  }

  MessageEnvelope copyWith({
    int? revision,
    DeliveryState? deliveryState,
    ContentBlock? content,
    int? editedAtMillis,
    int? deletedAtMillis,
    EncryptionInfo? encryption,
  }) {
    return MessageEnvelope(
      id: id,
      conversationId: conversationId,
      senderId: senderId,
      sentAt: sentAt,
      content: content ?? this.content,
      revision: revision ?? this.revision,
      replyToId: replyToId,
      threadRootId: threadRootId,
      mentions: mentions,
      deliveryState: deliveryState ?? this.deliveryState,
      editedAtMillis: editedAtMillis ?? this.editedAtMillis,
      deletedAtMillis: deletedAtMillis ?? this.deletedAtMillis,
      ephemeral: ephemeral,
      encryption: encryption ?? this.encryption,
    );
  }

  /// Conflict resolution when the same [id] arrives from two sources: higher
  /// [revision] wins; ties break by [sentAt] then by furthest [deliveryState].
  MessageEnvelope mergedWith(MessageEnvelope other) {
    assert(other.id == id, 'mergedWith requires the same message id');
    if (other.revision != revision) {
      return other.revision > revision ? other : this;
    }
    final byClock = other.sentAt.compareTo(sentAt);
    if (byClock != 0) return byClock > 0 ? other : this;
    return other.deliveryState.index >= deliveryState.index ? other : this;
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'conversationId': conversationId,
    'senderId': senderId,
    'sentAt': sentAt.encode(),
    'revision': revision,
    'content': content.toJson(),
    if (replyToId != null) 'replyToId': replyToId,
    if (threadRootId != null) 'threadRootId': threadRootId,
    if (mentions.isNotEmpty) 'mentions': mentions,
    'deliveryState': deliveryState.name,
    if (editedAtMillis != null) 'editedAtMillis': editedAtMillis,
    if (deletedAtMillis != null) 'deletedAtMillis': deletedAtMillis,
    if (ephemeral != null) 'ephemeral': ephemeral!.toJson(),
    'encryption': encryption.toJson(),
  };

  factory MessageEnvelope.fromJson(Map<String, Object?> json) => MessageEnvelope(
    id: json['id']?.toString() ?? '',
    conversationId: json['conversationId']?.toString() ?? '',
    senderId: json['senderId']?.toString() ?? '',
    sentAt:
        HybridTimestamp.tryDecode(json['sentAt']?.toString()) ??
        const HybridTimestamp(millis: 0, counter: 0, nodeId: '?'),
    revision: (json['revision'] as num?)?.toInt() ?? 0,
    content: ContentBlock.fromJson(
      (json['content'] as Map?)?.cast<String, Object?>() ?? const {},
    ),
    replyToId: json['replyToId']?.toString(),
    threadRootId: json['threadRootId']?.toString(),
    mentions:
        (json['mentions'] as List?)?.map((e) => e.toString()).toList() ??
        const [],
    deliveryState: DeliveryState.values.firstWhere(
      (s) => s.name == json['deliveryState'],
      orElse: () => DeliveryState.sent,
    ),
    editedAtMillis: (json['editedAtMillis'] as num?)?.toInt(),
    deletedAtMillis: (json['deletedAtMillis'] as num?)?.toInt(),
    ephemeral: json['ephemeral'] == null
        ? null
        : Ephemeral.fromJson((json['ephemeral'] as Map).cast<String, Object?>()),
    encryption: EncryptionInfo.fromJson(
      (json['encryption'] as Map?)?.cast<String, Object?>(),
    ),
  );
}
