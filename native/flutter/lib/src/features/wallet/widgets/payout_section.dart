import 'package:flutter/material.dart';

import '../data/wallet_models.dart';
import '../wallet_presenter.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

/// Creator payout balance, request action, and request history.
class WalletPayoutSection extends StatelessWidget {
  const WalletPayoutSection({
    super.key,
    required this.monetization,
    required this.requests,
    required this.state,
    required this.requestState,
    required this.blockedReason,
    required this.destination,
    required this.onRequest,
    required this.onConfigureDestination,
    required this.onRetry,
  });

  final CreatorMonetization monetization;
  final List<PayoutRequest> requests;
  final WalletLoadState state;
  final WalletLoadState requestState;
  final String? blockedReason;
  final PayoutDestination? destination;
  final VoidCallback? onRequest;
  final VoidCallback onConfigureDestination;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final submitting = requestState == WalletLoadState.loading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        WalletSectionHeader(
          title: 'Creator payouts',
          trailing: IconButton(
            tooltip: 'Refresh payouts',
            onPressed: state == WalletLoadState.loading ? null : onRetry,
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
              Row(
                children: [
                  Expanded(
                    child: _PayoutStat(
                      label: 'Available',
                      value: formatMoney(monetization.availableBalance, 'USD'),
                    ),
                  ),
                  const SizedBox(width: WalletSpacing.md),
                  Expanded(
                    child: _PayoutStat(
                      label: 'Total earned',
                      value: formatMoney(monetization.totalEarnings, 'USD'),
                    ),
                  ),
                ],
              ),
              if (monetization.nextEligiblePayoutMillis != null) ...[
                const SizedBox(height: WalletSpacing.md),
                Text(
                  'Next eligible: ${formatTimestamp(monetization.nextEligiblePayoutMillis!)}',
                  style: WalletTextStyles.rowMuted,
                ),
              ],
              const SizedBox(height: WalletSpacing.md),
              Row(
                children: [
                  const Icon(
                    Icons.account_balance_outlined,
                    size: 19,
                    color: WalletColors.mutedForeground,
                  ),
                  const SizedBox(width: WalletSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          destination == null
                              ? 'No payout account'
                              : destination!.displayLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: WalletTextStyles.rowTitle,
                        ),
                        Text(
                          destination == null
                              ? 'Add a verified Nigerian bank account'
                              : 'Paystack bank transfer',
                          style: WalletTextStyles.rowMuted,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: destination == null
                        ? 'Add payout account'
                        : 'Change payout account',
                    onPressed: onConfigureDestination,
                    icon: Icon(
                      destination == null
                          ? Icons.add_circle_outline_rounded
                          : Icons.edit_outlined,
                      color: WalletColors.primary,
                    ),
                  ),
                ],
              ),
              if (blockedReason != null) ...[
                const SizedBox(height: WalletSpacing.md),
                Text(
                  blockedReason!,
                  style: WalletTextStyles.rowMuted.copyWith(
                    color: WalletColors.warning,
                  ),
                ),
              ],
              const SizedBox(height: WalletSpacing.lg),
              WalletPrimaryButton(
                label: destination == null
                    ? 'Add bank account'
                    : submitting
                    ? 'Submitting request'
                    : 'Request payout',
                icon: destination == null
                    ? Icons.add_card_rounded
                    : Icons.account_balance_rounded,
                busy: destination != null && submitting,
                onPressed: destination == null
                    ? onConfigureDestination
                    : blockedReason == null
                    ? onRequest
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: WalletSpacing.lg),
        const WalletSectionHeader(title: 'Payout history'),
        const SizedBox(height: WalletSpacing.sm),
        if (state == WalletLoadState.loading && requests.isEmpty)
          const WalletLoading()
        else ...[
          if (state == WalletLoadState.error) ...[
            WalletInlineError(
              message: 'Could not refresh payout history.',
              onRetry: onRetry,
            ),
            const SizedBox(height: WalletSpacing.md),
          ],
          if (requests.isEmpty)
            const WalletEmptyState(
              icon: Icons.account_balance_wallet_outlined,
              title: 'No payout requests yet',
              subtitle: 'Submitted requests and their status will appear here.',
            )
          else
            for (final request in requests) ...[
              _PayoutRequestRow(request: request),
              const SizedBox(height: WalletSpacing.sm),
            ],
        ],
      ],
    );
  }
}

class _PayoutStat extends StatelessWidget {
  const _PayoutStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: WalletTextStyles.rowMuted),
        const SizedBox(height: 3),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: WalletTextStyles.cardTitle.copyWith(fontSize: 20),
          ),
        ),
      ],
    );
  }
}

class _PayoutRequestRow extends StatelessWidget {
  const _PayoutRequestRow({required this.request});

  final PayoutRequest request;

  Color get _statusColor {
    if (request.isSuccessful) return WalletColors.success;
    if (request.isOpen) return WalletColors.warning;
    return WalletColors.destructive;
  }

  IconData get _statusIcon {
    if (request.isSuccessful) return Icons.check_circle_rounded;
    if (request.isOpen) return Icons.schedule_rounded;
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
                  formatMoney(request.amount, request.currency),
                  style: WalletTextStyles.rowTitle,
                ),
                const SizedBox(height: 2),
                Text(
                  formatTimestamp(request.requestedAtMillis),
                  style: WalletTextStyles.rowMuted,
                ),
                if (request.payoutMethod != null &&
                    request.payoutMethod!.trim().isNotEmpty)
                  Text(
                    request.payoutMethod!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: WalletTextStyles.rowMuted,
                  ),
                if (request.failureReason != null &&
                    request.failureReason!.trim().isNotEmpty)
                  Text(
                    request.failureReason!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: WalletTextStyles.rowMuted.copyWith(
                      color: WalletColors.destructive,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: WalletSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.14),
              borderRadius: WalletRadii.chip,
            ),
            child: Text(
              request.statusLabel,
              style: WalletTextStyles.badge.copyWith(color: statusColor),
            ),
          ),
        ],
      ),
    );
  }
}
