import '../../domain/message_envelope.dart';

/// The encrypted (or, today, pass-through) form of a message payload as it
/// crosses the wire. [body] is what the delivery service actually sends.
class EncryptedPayload {
  const EncryptedPayload({
    required this.alg,
    required this.body,
    this.keyRef,
  });

  final String alg;
  final String? keyRef;
  final Map<String, Object?> body;

  EncryptionInfo get info => EncryptionInfo(alg: alg, keyRef: keyRef);

  Map<String, Object?> toJson() => {
    'alg': alg,
    if (keyRef != null) 'keyRef': keyRef,
    'body': body,
  };

  factory EncryptedPayload.fromJson(Map<String, Object?> json) => EncryptedPayload(
    alg: json['alg']?.toString() ?? 'none',
    keyRef: json['keyRef']?.toString(),
    body: (json['body'] as Map?)?.cast<String, Object?>() ?? const {},
  );
}

/// The E2EE seam. Every message payload passes through [encrypt] before the
/// Delivery Service sends it and [decrypt] after Realtime Sync receives it —
/// wired from day one so turning on real end-to-end encryption later is a codec
/// swap plus a key-management service, with NO change to the pipeline.
abstract interface class EncryptionCodec {
  /// The encryption metadata this codec stamps onto envelopes.
  EncryptionInfo get info;

  /// Encrypt [plaintextJson] for [conversationId].
  EncryptedPayload encrypt(String conversationId, Map<String, Object?> plaintextJson);

  /// Decrypt [payload] for [conversationId] back to the plaintext json.
  Map<String, Object?> decrypt(String conversationId, EncryptedPayload payload);
}

/// The default no-op codec: passes the payload through unchanged and stamps
/// `alg: none`. It exists so the entire pipeline is encryption-shaped today
/// (every message is encrypt()'d and decrypt()'d) without yet doing crypto.
///
/// A future `SignalEncryptionCodec` / `MlsEncryptionCodec` implements the same
/// interface; nothing else in the platform changes.
class IdentityEncryptionCodec implements EncryptionCodec {
  const IdentityEncryptionCodec();

  @override
  EncryptionInfo get info => EncryptionInfo.none;

  @override
  EncryptedPayload encrypt(String conversationId, Map<String, Object?> plaintextJson) =>
      EncryptedPayload(alg: 'none', body: Map<String, Object?>.from(plaintextJson));

  @override
  Map<String, Object?> decrypt(String conversationId, EncryptedPayload payload) =>
      Map<String, Object?>.from(payload.body);
}
