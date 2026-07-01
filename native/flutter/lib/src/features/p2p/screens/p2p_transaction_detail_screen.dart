import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../data/p2p_remote_data_source.dart';
import '../p2p_config.dart';
import '../p2p_theme.dart';
import '../widgets/p2p_common.dart';
import '../widgets/p2p_transaction_card.dart';
import '../widgets/p2p_transaction_timeline.dart';
import 'p2p_transaction_chat_screen.dart';

/// Full detail view for a single transaction: summary, progress timeline,
/// primary actions (submit proof / cancel), chat entry, and dispute state.
/// Combines the web `P2PTransactionTimeline`, `P2PDisputePanel`,
/// `CancelOrderModal`, and the chat entry point into one native screen.
class P2PTransactionDetailScreen extends StatefulWidget {
  const P2PTransactionDetailScreen({
    super.key,
    required this.dataSource,
    required this.transaction,
    required this.currentUserId,
  });

  final P2PRemoteDataSource dataSource;
  final P2PTransaction transaction;
  final String currentUserId;

  @override
  State<P2PTransactionDetailScreen> createState() =>
      _P2PTransactionDetailScreenState();
}

class _P2PTransactionDetailScreenState
    extends State<P2PTransactionDetailScreen> {
  late P2PTransaction _transaction = widget.transaction;
  late Future<P2PDispute?> _disputeFuture;
  bool _busy = false;

  bool get _isBuyer => _transaction.buyerId == widget.currentUserId;

  @override
  void initState() {
    super.initState();
    _disputeFuture = widget.dataSource.fetchDispute(_transaction.id);
  }

  Future<void> _submitProof() async {
    setState(() => _busy = true);
    await widget.dataSource.markProofSubmitted(_transaction.id);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _transaction = _clone(status: 'proof_submitted');
    });
    _toast('Payment proof marked as submitted.');
  }

  Future<void> _cancel() async {
    final reason = await _promptCancel();
    if (reason == null) return;
    setState(() => _busy = true);
    await widget.dataSource.cancelTransaction(_transaction.id);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _transaction = _clone(status: 'cancelled');
    });
    _toast('Order cancelled.');
  }

  Future<void> _openDispute() async {
    final reason = await _promptDisputeReason();
    if (reason == null) return;
    setState(() => _busy = true);
    final dispute = await widget.dataSource.openDispute(
      transactionId: _transaction.id,
      reason: reason,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _transaction = _clone(status: 'disputed');
      _disputeFuture = Future.value(dispute);
    });
    _toast('Dispute opened. A moderator will review it.');
  }

  Future<String?> _promptCancel() {
    final controller = TextEditingController();
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black87,
      builder: (sheetContext) => _CancelSheet(controller: controller),
    );
  }

  Future<String?> _promptDisputeReason() {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black87,
      builder: (sheetContext) => const _DisputeReasonSheet(),
    );
  }

  P2PTransaction _clone({required String status}) {
    return P2PTransaction(
      id: _transaction.id,
      listingId: _transaction.listingId,
      buyerId: _transaction.buyerId,
      sellerId: _transaction.sellerId,
      creditsAmount: _transaction.creditsAmount,
      priceCents: _transaction.priceCents,
      currency: _transaction.currency,
      status: status,
      escrowLocked: _transaction.escrowLocked,
      createdAtMillis: _transaction.createdAtMillis,
      expiresAtMillis: _transaction.expiresAtMillis,
      buyer: _transaction.buyer,
      seller: _transaction.seller,
    );
  }

  void _openChat() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => P2PTransactionChatScreen(
          dataSource: widget.dataSource,
          transaction: _transaction,
          currentUserId: widget.currentUserId,
        ),
      ),
    );
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: P2PTheme.card),
    );
  }

  @override
  Widget build(BuildContext context) {
    final country = P2PConfig.supportedCountries.firstWhere(
      (c) => c.currency == _transaction.currency,
      orElse: () => P2PConfig.supportedCountries.first,
    );
    final counterparty = _isBuyer ? _transaction.seller : _transaction.buyer;

    return ColoredBox(
      color: P2PTheme.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(
              title: 'Order details',
              onBack: () => Navigator.of(context).maybePop(),
              onChat: _openChat,
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: P2PTheme.xl),
                children: [
                  _SummaryCard(
                    transaction: _transaction,
                    isBuyer: _isBuyer,
                    counterpartyName:
                        counterparty?.label ?? (_isBuyer ? 'Seller' : 'Buyer'),
                    currencySymbol: country.symbol,
                  ),
                  const _SectionLabel('Progress'),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: P2PTheme.lg),
                    padding: const EdgeInsets.all(P2PTheme.lg),
                    decoration: BoxDecoration(
                      color: P2PTheme.card,
                      borderRadius: P2PTheme.cardRadius,
                      border: Border.all(color: P2PTheme.border),
                    ),
                    child: P2PTransactionTimeline(
                      transaction: _transaction,
                      isBuyer: _isBuyer,
                    ),
                  ),
                  _DisputeSection(disputeFuture: _disputeFuture),
                  const SizedBox(height: P2PTheme.lg),
                  _Actions(
                    transaction: _transaction,
                    isBuyer: _isBuyer,
                    busy: _busy,
                    onSubmitProof: _submitProof,
                    onCancel: _cancel,
                    onOpenDispute: _openDispute,
                    onChat: _openChat,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.onBack,
    required this.onChat,
  });
  final String title;
  final VoidCallback onBack;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: P2PTheme.xs),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back, color: P2PTheme.foreground),
          ),
          Expanded(child: Text(title, style: P2PTheme.sectionTitle)),
          IconButton(
            tooltip: 'Open chat',
            onPressed: onChat,
            icon: const Icon(
              Icons.chat_bubble_outline,
              color: P2PTheme.foreground,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.transaction,
    required this.isBuyer,
    required this.counterpartyName,
    required this.currencySymbol,
  });

  final P2PTransaction transaction;
  final bool isBuyer;
  final String counterpartyName;
  final String currencySymbol;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(P2PTheme.lg),
      padding: const EdgeInsets.all(P2PTheme.lg),
      decoration: BoxDecoration(
        color: P2PTheme.card,
        borderRadius: P2PTheme.cardRadius,
        border: Border.all(color: P2PTheme.border),
        boxShadow: P2PTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              P2PStatusPill(status: transaction.status),
              const Spacer(),
              P2PChip(label: isBuyer ? 'You are buying' : 'You are selling'),
            ],
          ),
          const SizedBox(height: P2PTheme.md),
          Row(
            children: [
              Expanded(
                child: _Metric(
                  label: 'Credits',
                  value: p2pFormatInt(transaction.creditsAmount),
                ),
              ),
              Expanded(
                child: _Metric(
                  label: 'Price',
                  value: p2pFormatMoney(
                    transaction.price,
                    symbol: currencySymbol,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: P2PTheme.md),
          Row(
            children: [
              P2PAvatar(label: counterpartyName, size: 28),
              const SizedBox(width: P2PTheme.sm),
              Expanded(
                child: Text(
                  '${isBuyer ? 'Seller' : 'Buyer'}: $counterpartyName',
                  style: P2PTheme.muted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: P2PTheme.meta),
        const SizedBox(height: 2),
        Text(value, style: P2PTheme.amount),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        P2PTheme.lg,
        P2PTheme.md,
        P2PTheme.lg,
        P2PTheme.sm,
      ),
      child: Text(label, style: P2PTheme.muted),
    );
  }
}

class _DisputeSection extends StatelessWidget {
  const _DisputeSection({required this.disputeFuture});
  final Future<P2PDispute?> disputeFuture;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<P2PDispute?>(
      future: disputeFuture,
      builder: (context, snapshot) {
        final dispute = snapshot.data;
        if (dispute == null) return const SizedBox.shrink();
        return Container(
          margin: const EdgeInsets.fromLTRB(
            P2PTheme.lg,
            P2PTheme.md,
            P2PTheme.lg,
            0,
          ),
          padding: const EdgeInsets.all(P2PTheme.lg),
          decoration: BoxDecoration(
            color: P2PTheme.danger.withValues(alpha: 0.08),
            borderRadius: P2PTheme.cardRadius,
            border: Border.all(color: P2PTheme.danger.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    color: P2PTheme.danger,
                    size: 18,
                  ),
                  const SizedBox(width: P2PTheme.sm),
                  Text(
                    'Dispute ${dispute.status}',
                    style: P2PTheme.cardTitle.copyWith(color: P2PTheme.danger),
                  ),
                ],
              ),
              const SizedBox(height: P2PTheme.sm),
              Text(
                'Reason: ${P2PDisputeReason.labelFor(dispute.reason)}',
                style: P2PTheme.muted,
              ),
              if (dispute.resolution != null) ...[
                const SizedBox(height: 4),
                Text('Resolution: ${dispute.resolution}', style: P2PTheme.muted),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.transaction,
    required this.isBuyer,
    required this.busy,
    required this.onSubmitProof,
    required this.onCancel,
    required this.onOpenDispute,
    required this.onChat,
  });

  final P2PTransaction transaction;
  final bool isBuyer;
  final bool busy;
  final VoidCallback onSubmitProof;
  final VoidCallback onCancel;
  final VoidCallback onOpenDispute;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    final status = transaction.status;
    final isOpen = !transaction.isTerminal && status != 'disputed';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: P2PTheme.lg),
      child: Column(
        children: [
          if (isBuyer && status == 'pending')
            P2PPrimaryButton(
              label: 'Mark payment sent',
              icon: Icons.receipt_long_outlined,
              busy: busy,
              onPressed: onSubmitProof,
            ),
          if (isBuyer && status == 'pending')
            const SizedBox(height: P2PTheme.sm),
          P2PPrimaryButton(
            label: 'Open transaction chat',
            icon: Icons.chat_bubble_outline,
            onPressed: onChat,
          ),
          if (isOpen) ...[
            const SizedBox(height: P2PTheme.sm),
            _SecondaryButton(
              label: 'Open dispute',
              icon: Icons.gavel_outlined,
              color: P2PTheme.danger,
              onPressed: busy ? null : onOpenDispute,
            ),
            const SizedBox(height: P2PTheme.sm),
            _SecondaryButton(
              label: 'Cancel order',
              icon: Icons.close,
              color: P2PTheme.mutedForeground,
              onPressed: busy ? null : onCancel,
            ),
          ],
        ],
      ),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  const _SecondaryButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: P2PTheme.chipRadius,
        onTap: onPressed,
        child: Container(
          width: double.infinity,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: P2PTheme.surface,
            borderRadius: P2PTheme.chipRadius,
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cancel-order sheet requiring a >= 10 char reason (mirrors web
/// `CancelOrderModal`). Returns the reason on confirm, null otherwise.
class _CancelSheet extends StatefulWidget {
  const _CancelSheet({required this.controller});
  final TextEditingController controller;

  @override
  State<_CancelSheet> createState() => _CancelSheetState();
}

class _CancelSheetState extends State<_CancelSheet> {
  @override
  Widget build(BuildContext context) {
    final length = widget.controller.text.trim().length;
    final valid = length >= 10;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: P2PTheme.card,
          borderRadius: P2PTheme.sheetTop,
        ),
        padding: const EdgeInsets.all(P2PTheme.lg),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.warning_amber_rounded,
                    color: P2PTheme.danger,
                    size: 20,
                  ),
                  SizedBox(width: P2PTheme.sm),
                  Text(
                    'Cancel order',
                    style: TextStyle(
                      color: P2PTheme.danger,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: P2PTheme.sm),
              const Text(
                'Please provide a reason for cancelling this order.',
                style: P2PTheme.muted,
              ),
              const SizedBox(height: P2PTheme.md),
              TextField(
                controller: widget.controller,
                onChanged: (_) => setState(() {}),
                maxLines: 4,
                style: P2PTheme.body,
                cursorColor: P2PTheme.primary,
                decoration: InputDecoration(
                  hintText: 'Explain why (minimum 10 characters)…',
                  hintStyle:
                      P2PTheme.muted.copyWith(color: P2PTheme.faintForeground),
                  filled: true,
                  fillColor: P2PTheme.surface,
                  border: OutlineInputBorder(
                    borderRadius: P2PTheme.chipRadius,
                    borderSide: const BorderSide(color: P2PTheme.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: P2PTheme.chipRadius,
                    borderSide: const BorderSide(color: P2PTheme.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: P2PTheme.chipRadius,
                    borderSide: const BorderSide(color: P2PTheme.primary),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text('$length/10 characters minimum', style: P2PTheme.meta),
              const SizedBox(height: P2PTheme.md),
              Row(
                children: [
                  Expanded(
                    child: _SecondaryButton(
                      label: 'Keep order',
                      icon: Icons.undo,
                      color: P2PTheme.mutedForeground,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                  const SizedBox(width: P2PTheme.sm),
                  Expanded(
                    child: _SecondaryButton(
                      label: 'Cancel order',
                      icon: Icons.close,
                      color: P2PTheme.danger,
                      onPressed: valid
                          ? () => Navigator.of(context)
                              .pop(widget.controller.text.trim())
                          : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dispute-reason picker sheet. Returns the selected reason value.
class _DisputeReasonSheet extends StatelessWidget {
  const _DisputeReasonSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: P2PTheme.card,
        borderRadius: P2PTheme.sheetTop,
      ),
      padding: const EdgeInsets.all(P2PTheme.lg),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Open a dispute', style: P2PTheme.sectionTitle),
            const SizedBox(height: P2PTheme.sm),
            const Text(
              'A moderator will review the transaction. Choose the closest '
              'reason.',
              style: P2PTheme.muted,
            ),
            const SizedBox(height: P2PTheme.md),
            for (final reason in P2PDisputeReason.all)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(reason.label, style: P2PTheme.body),
                trailing: const Icon(
                  Icons.chevron_right,
                  color: P2PTheme.faintForeground,
                ),
                onTap: () => Navigator.of(context).pop(reason.value),
              ),
          ],
        ),
      ),
    );
  }
}
