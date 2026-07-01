import 'package:flutter/material.dart';

import '../wallet_theme.dart';

/// Small shared building blocks for the wallet surface: number/currency
/// formatting, a gradient primary button, an outlined secondary button, a
/// section header, and an empty/error state. Kept in one file so the wallet
/// widgets import a single helper module.

/// Group a whole number with thin separators, e.g. 12345 -> "12,345".
String formatCredits(int value) {
  final negative = value < 0;
  final digits = value.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i != 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return '${negative ? '-' : ''}$buffer';
}

/// Format a major-unit currency amount with a symbol, e.g. (12.5,'USD') -> "$12.50".
String formatMoney(double amount, String currency) {
  final symbol = currencySymbol(currency);
  final fixed = amount.toStringAsFixed(2);
  return '$symbol$fixed';
}

/// Best-effort currency symbol for the handful of currencies the schema uses.
String currencySymbol(String currency) => switch (currency.toUpperCase()) {
  'USD' => '\$',
  'NGN' => '₦',
  'EUR' => '€',
  'GBP' => '£',
  _ => '',
};

/// Short relative/absolute timestamp, e.g. "Jun 30, 2:14 PM".
String formatTimestamp(int millis) {
  final dt = DateTime.fromMillisecondsSinceEpoch(millis).toLocal();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final month = months[dt.month - 1];
  final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final minute = dt.minute.toString().padLeft(2, '0');
  final ampm = dt.hour < 12 ? 'AM' : 'PM';
  return '$month ${dt.day}, $hour12:$minute $ampm';
}

/// A full-width gradient CTA (web primary Button). Shows a spinner while busy.
class WalletPrimaryButton extends StatelessWidget {
  const WalletPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    this.gradient = WalletGradients.action,
    this.height = 48,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  final Gradient gradient;
  final double height;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: WalletRadii.inner,
          onTap: enabled ? onPressed : null,
          child: Ink(
            height: height,
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: WalletRadii.inner,
            ),
            child: Center(
              child: busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        valueColor: AlwaysStoppedAnimation(
                          WalletColors.primaryForeground,
                        ),
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (icon != null) ...[
                          Icon(
                            icon,
                            size: 18,
                            color: WalletColors.primaryForeground,
                          ),
                          const SizedBox(width: WalletSpacing.sm),
                        ],
                        Text(label, style: WalletTextStyles.button),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// An outlined secondary action (web `variant="outline"`).
class WalletSecondaryButton extends StatelessWidget {
  const WalletSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.height = 44,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: WalletRadii.inner,
          onTap: onPressed,
          child: Container(
            height: height,
            decoration: BoxDecoration(
              color: WalletColors.card,
              borderRadius: WalletRadii.inner,
              border: Border.all(color: WalletColors.border),
            ),
            child: Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 16, color: WalletColors.foreground),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    label,
                    style: WalletTextStyles.rowTitle.copyWith(fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A card-styled surface used across the wallet tabs.
class WalletCard extends StatelessWidget {
  const WalletCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(WalletSpacing.lg),
    this.gradient,
    this.color,
    this.border = true,
  });

  final Widget child;
  final EdgeInsets padding;
  final Gradient? gradient;
  final Color? color;
  final bool border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? WalletColors.card) : null,
        gradient: gradient,
        borderRadius: WalletRadii.card,
        border: border && gradient == null
            ? Border.all(color: WalletColors.border)
            : null,
      ),
      child: child,
    );
  }
}

/// Small titled section header row used above tab content.
class WalletSectionHeader extends StatelessWidget {
  const WalletSectionHeader({super.key, required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: WalletTextStyles.sectionTitle)),
        if (trailing != null) trailing!,
      ],
    );
  }
}

/// Centered empty / error state.
class WalletEmptyState extends StatelessWidget {
  const WalletEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: WalletColors.mutedHover,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: WalletColors.mutedForeground, size: 26),
          ),
          const SizedBox(height: WalletSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: WalletTextStyles.emptyTitle,
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: WalletTextStyles.emptySubtitle,
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: WalletSpacing.lg),
            action!,
          ],
        ],
      ),
    );
  }
}

/// A tappable navigation tile (icon + title + subtitle + chevron), used e.g. to
/// surface the P2P marketplace from the wallet.
class WalletNavTile extends StatelessWidget {
  const WalletNavTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: WalletRadii.card,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(WalletSpacing.md),
          decoration: BoxDecoration(
            color: WalletColors.card,
            borderRadius: WalletRadii.card,
            border: Border.all(color: WalletColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: WalletColors.primarySoft,
                  borderRadius: WalletRadii.inner,
                ),
                child: Icon(icon, color: WalletColors.primary, size: 22),
              ),
              const SizedBox(width: WalletSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: WalletTextStyles.rowTitle),
                    const SizedBox(height: 2),
                    Text(subtitle, style: WalletTextStyles.rowMuted),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: WalletColors.mutedForeground,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A compact inline error strip with an optional retry action, used where a
/// full empty state would be too heavy (e.g. a failed balance refresh).
class WalletInlineError extends StatelessWidget {
  const WalletInlineError({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: WalletSpacing.md,
        vertical: WalletSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: WalletColors.destructiveFaint,
        borderRadius: WalletRadii.inner,
        border: Border.all(
          color: WalletColors.destructive.withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: WalletColors.destructive,
          ),
          const SizedBox(width: WalletSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: WalletTextStyles.rowMuted.copyWith(
                color: WalletColors.foreground,
              ),
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(width: WalletSpacing.sm),
            GestureDetector(
              onTap: onRetry,
              child: const Text(
                'Retry',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: WalletColors.primary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A simple loading placeholder used inside tabs.
class WalletLoading extends StatelessWidget {
  const WalletLoading({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: SizedBox(
          width: 26,
          height: 26,
          child: CircularProgressIndicator(
            strokeWidth: 2.4,
            valueColor: AlwaysStoppedAnimation(WalletColors.primary),
          ),
        ),
      ),
    );
  }
}
