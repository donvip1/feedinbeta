import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/wallet_models.dart';
import '../wallet_presenter.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

typedef FinanceBuybackRequestCallback = Future<bool> Function(int credits);
typedef FinanceBuybackCancelCallback =
    Future<void> Function(FinanceBuybackRequest request);

class WalletBuybackSection extends StatefulWidget {
  const WalletBuybackSection({
    super.key,
    required this.balance,
    required this.requests,
    required this.state,
    required this.mutationState,
    required this.blockedReason,
    required this.cancelingRequestId,
    required this.onRequest,
    required this.onCancel,
    required this.onRetry,
  });

  final CreditBalance balance;
  final List<FinanceBuybackRequest> requests;
  final WalletLoadState state;
  final WalletLoadState mutationState;
  final String? blockedReason;
  final String? cancelingRequestId;
  final FinanceBuybackRequestCallback onRequest;
  final FinanceBuybackCancelCallback onCancel;
  final VoidCallback onRetry;

  @override
  State<WalletBuybackSection> createState() => _WalletBuybackSectionState();
}

class _WalletBuybackSectionState extends State<WalletBuybackSection> {
  final _creditsController = TextEditingController();
  String? _validationMessage;

  bool get _submitting =>
      widget.mutationState == WalletLoadState.loading &&
      widget.cancelingRequestId == null;

  @override
  void dispose() {
    _creditsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final credits = int.tryParse(_creditsController.text.trim());
    if (credits == null || credits <= 0) {
      setState(() => _validationMessage = 'Enter a valid number of credits.');
      return;
    }
    if (credits > widget.balance.balance) {
      setState(
        () => _validationMessage =
            'You do not have enough credits for this request.',
      );
      return;
    }

    setState(() => _validationMessage = null);
    final submitted = await widget.onRequest(credits);
    if (submitted && mounted) _creditsController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final inputEnabled = widget.blockedReason == null && !_submitting;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        WalletSectionHeader(
          title: 'Finance team buyback',
          trailing: IconButton(
            tooltip: 'Refresh buyback history',
            onPressed: widget.state == WalletLoadState.loading
                ? null
                : widget.onRetry,
            icon: const Icon(
              Icons.refresh_rounded,
              color: WalletColors.mutedForeground,
              size: 20,
            ),
          ),
        ),
        const SizedBox(height: WalletSpacing.sm),
        WalletCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Available credits', style: WalletTextStyles.rowMuted),
              const SizedBox(height: WalletSpacing.xs),
              Text(
                formatCredits(widget.balance.balance),
                style: WalletTextStyles.cardTitle.copyWith(fontSize: 24),
              ),
              const SizedBox(height: WalletSpacing.md),
              TextField(
                key: const Key('finance_buyback_credits_input'),
                controller: _creditsController,
                enabled: inputEnabled,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onSubmitted: inputEnabled ? (_) => _submit() : null,
                onChanged: (_) {
                  if (_validationMessage != null) {
                    setState(() => _validationMessage = null);
                  }
                },
                style: const TextStyle(color: WalletColors.foreground),
                decoration: InputDecoration(
                  labelText: 'Credits to sell',
                  labelStyle: const TextStyle(
                    color: WalletColors.mutedForeground,
                  ),
                  errorText: _validationMessage,
                  filled: true,
                  fillColor: WalletColors.background,
                  border: const OutlineInputBorder(
                    borderRadius: WalletRadii.inner,
                    borderSide: BorderSide(color: WalletColors.border),
                  ),
                  enabledBorder: const OutlineInputBorder(
                    borderRadius: WalletRadii.inner,
                    borderSide: BorderSide(color: WalletColors.border),
                  ),
                  suffixIcon: TextButton(
                    onPressed: inputEnabled && widget.balance.balance > 0
                        ? () {
                            _creditsController.text = widget.balance.balance
                                .toString();
                            setState(() => _validationMessage = null);
                          }
                        : null,
                    child: const Text('Max'),
                  ),
                ),
              ),
              if (widget.blockedReason != null) ...[
                const SizedBox(height: WalletSpacing.sm),
                Text(
                  widget.blockedReason!,
                  style: WalletTextStyles.rowMuted.copyWith(
                    color: WalletColors.warning,
                  ),
                ),
              ],
              const SizedBox(height: WalletSpacing.md),
              WalletPrimaryButton(
                key: const Key('finance_buyback_submit'),
                label: _submitting ? 'Submitting request' : 'Request buyback',
                icon: Icons.currency_exchange_rounded,
                busy: _submitting,
                onPressed: inputEnabled ? _submit : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: WalletSpacing.lg),
        const WalletSectionHeader(title: 'Buyback history'),
        const SizedBox(height: WalletSpacing.sm),
        if (widget.state == WalletLoadState.loading && widget.requests.isEmpty)
          const WalletLoading()
        else ...[
          if (widget.state == WalletLoadState.error) ...[
            WalletInlineError(
              message: 'Could not refresh buyback history.',
              onRetry: widget.onRetry,
            ),
            const SizedBox(height: WalletSpacing.md),
          ],
          if (widget.requests.isEmpty)
            const WalletEmptyState(
              icon: Icons.currency_exchange_rounded,
              title: 'No buyback requests yet',
              subtitle: 'Your finance-team requests will appear here.',
            )
          else
            for (final request in widget.requests) ...[
              _BuybackRequestRow(
                request: request,
                canceling: widget.cancelingRequestId == request.id,
                mutationInProgress:
                    widget.mutationState == WalletLoadState.loading,
                onCancel: () => widget.onCancel(request),
              ),
              const SizedBox(height: WalletSpacing.sm),
            ],
        ],
      ],
    );
  }
}

class _BuybackRequestRow extends StatelessWidget {
  const _BuybackRequestRow({
    required this.request,
    required this.canceling,
    required this.mutationInProgress,
    required this.onCancel,
  });

  final FinanceBuybackRequest request;
  final bool canceling;
  final bool mutationInProgress;
  final VoidCallback onCancel;

  Color get _statusColor {
    if (request.isSuccessful) return WalletColors.success;
    if (request.isPending) return WalletColors.warning;
    if (request.isCanceled) return WalletColors.mutedForeground;
    return WalletColors.destructive;
  }

  IconData get _statusIcon {
    if (request.isSuccessful) return Icons.check_circle_rounded;
    if (request.isPending) return Icons.schedule_rounded;
    if (request.isCanceled) return Icons.block_rounded;
    return Icons.cancel_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor;
    return Container(
      padding: const EdgeInsets.all(WalletSpacing.md),
      decoration: BoxDecoration(
        color: WalletColors.cardFaint,
        borderRadius: WalletRadii.inner,
        border: Border.all(color: WalletColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(_statusIcon, size: 19, color: statusColor),
          ),
          const SizedBox(width: WalletSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${formatCredits(request.creditsAmount)} credits',
                  style: WalletTextStyles.rowTitle,
                ),
                const SizedBox(height: 2),
                Text(
                  formatTimestamp(request.requestedAtMillis),
                  style: WalletTextStyles.rowMuted,
                ),
                if (request.note != null && request.note!.trim().isNotEmpty)
                  Text(
                    request.note!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: WalletTextStyles.rowMuted,
                  ),
              ],
            ),
          ),
          const SizedBox(width: WalletSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: WalletSpacing.sm,
                  vertical: WalletSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.14),
                  borderRadius: WalletRadii.chip,
                ),
                child: Text(
                  request.statusLabel,
                  style: WalletTextStyles.badge.copyWith(color: statusColor),
                ),
              ),
              if (request.isPending) ...[
                const SizedBox(height: WalletSpacing.xs),
                if (canceling)
                  const SizedBox(
                    width: 40,
                    height: 40,
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: WalletColors.mutedForeground,
                        ),
                      ),
                    ),
                  )
                else
                  IconButton(
                    key: Key('finance_buyback_cancel_${request.id}'),
                    tooltip: 'Cancel buyback',
                    onPressed: mutationInProgress ? null : onCancel,
                    icon: const Icon(
                      Icons.close_rounded,
                      color: WalletColors.mutedForeground,
                    ),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
