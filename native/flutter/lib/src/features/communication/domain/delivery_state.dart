/// The lifecycle of an outgoing (or incoming) message as it moves through the
/// pipeline. Ordered from compose to read; the ordinal is monotonic so the UI
/// can render "furthest reached" ticks and the outbox can reason about progress.
enum DeliveryState {
  /// Being written in the composer; not yet queued.
  composing,

  /// Accepted into the durable outbox, awaiting drain.
  queued,

  /// Written to the local store (survives app restart).
  persisted,

  /// Attachment bytes are uploading (media messages only).
  uploading,

  /// Handed to the delivery service and accepted by the server.
  sent,

  /// Confirmed delivered to at least one recipient device.
  delivered,

  /// Read by at least one recipient.
  read,

  /// Terminal failure after retries exhausted (dead-letter; user can retry/delete).
  failed;

  bool get isInFlight =>
      this == queued || this == persisted || this == uploading;

  bool get isAcknowledged =>
      this == sent || this == delivered || this == read;

  bool get isTerminalFailure => this == failed;

  /// Whether a user-initiated retry is meaningful from this state.
  bool get canRetry => this == failed;

  /// Furthest-progress comparison for tick rendering.
  bool reached(DeliveryState other) => index >= other.index;
}
