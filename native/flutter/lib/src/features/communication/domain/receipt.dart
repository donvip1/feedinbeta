/// Per-message, per-user delivery/read receipt — the primitive the old stack
/// lacked (it faked "delivered" and inferred reads per-conversation). One
/// receipt per (message, recipient) gives accurate ticks and read-by lists.
class Receipt {
  const Receipt({
    required this.messageId,
    required this.userId,
    this.deliveredAtMillis,
    this.readAtMillis,
  });

  final String messageId;
  final String userId;
  final int? deliveredAtMillis;
  final int? readAtMillis;

  bool get isDelivered => deliveredAtMillis != null;
  bool get isRead => readAtMillis != null;

  /// Merge two receipts for the same (message, user), keeping the earliest
  /// delivered and the earliest read timestamps (monotonic, idempotent).
  Receipt mergedWith(Receipt other) {
    assert(other.messageId == messageId && other.userId == userId);
    int? earliest(int? a, int? b) {
      if (a == null) return b;
      if (b == null) return a;
      return a < b ? a : b;
    }

    return Receipt(
      messageId: messageId,
      userId: userId,
      deliveredAtMillis: earliest(deliveredAtMillis, other.deliveredAtMillis),
      readAtMillis: earliest(readAtMillis, other.readAtMillis),
    );
  }
}

/// Aggregates receipts for one message across all recipients to answer
/// "delivered to anyone?" / "read by anyone?" / "read by all?".
class ReceiptSummary {
  const ReceiptSummary(this.receipts, {required this.recipientCount});

  final List<Receipt> receipts;
  final int recipientCount;

  bool get deliveredToAny => receipts.any((r) => r.isDelivered);
  bool get readByAny => receipts.any((r) => r.isRead);
  bool get readByAll =>
      recipientCount > 0 &&
      receipts.where((r) => r.isRead).length >= recipientCount;

  int get readCount => receipts.where((r) => r.isRead).length;
}
