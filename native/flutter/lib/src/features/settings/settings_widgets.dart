/// Presentational building blocks for the Settings parity refinement.
///
/// These widgets port the web settings primitives into the native surface:
///   - [SettingsCard]      -> src/components/ui/card.tsx titled card
///                            (header icon + title + description + body)
///   - [SettingsToggleRow] -> PrivacySettingsPanel `PrivacyToggle`
///                            (tinted icon bubble + label/description + Switch)
///   - [SettingsStatusBanner] -> EncryptionSettings tinted status banners
///   - [SettingsActionButton] -> CacheSettings outline/destructive/primary btns
///   - [SettingsStat]      -> CacheSettings stat row / diagnostic value
///
/// Pure presentational: every widget renders inputs + emits callbacks only.
/// Styling comes exclusively from `settings_theme.dart`.
library;

import 'package:flutter/material.dart';

import 'settings_theme.dart';

/// A titled settings card: rounded bordered surface with a header
/// (tinted icon bubble + title + optional description) above its [children].
class SettingsCard extends StatelessWidget {
  const SettingsCard({
    super.key,
    required this.icon,
    required this.title,
    required this.children,
    this.description,
    this.accent = SettingsColors.foreground,
    this.accentBubble = SettingsColors.iconBubble,
  });

  final IconData icon;
  final String title;
  final String? description;
  final List<Widget> children;

  /// Header icon tint (defaults to neutral foreground).
  final Color accent;

  /// Header icon bubble fill.
  final Color accentBubble;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SettingsColors.card,
        borderRadius: SettingsRadii.card,
        border: Border.all(color: SettingsColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SettingsSpacing.lg,
              SettingsSpacing.lg,
              SettingsSpacing.lg,
              SettingsSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: SettingsSpacing.iconBubble,
                  height: SettingsSpacing.iconBubble,
                  decoration: BoxDecoration(
                    color: accentBubble,
                    borderRadius: SettingsRadii.tile,
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 20, color: accent),
                ),
                const SizedBox(width: SettingsSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title, style: SettingsTextStyles.cardTitle),
                      if (description != null && description!.isNotEmpty) ...[
                        const SizedBox(height: SettingsSpacing.xs),
                        Text(
                          description!,
                          style: SettingsTextStyles.cardDescription,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

/// A horizontal hairline divider matching the web `Separator` between rows.
class SettingsDivider extends StatelessWidget {
  const SettingsDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return const Divider(
      height: 1,
      thickness: 1,
      color: SettingsColors.border,
    );
  }
}

/// A single toggle row: tinted icon bubble + title/description + Switch.
///
/// Mirrors PrivacySettingsPanel's `PrivacyToggle`. When [sensitive] is true the
/// icon bubble takes the amber 'sensitive' tint and a small pill is shown.
class SettingsToggleRow extends StatelessWidget {
  const SettingsToggleRow({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.value,
    required this.onChanged,
    this.sensitive = false,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool sensitive;

  @override
  Widget build(BuildContext context) {
    final bubbleColor = sensitive
        ? SettingsColors.amberSoft
        : SettingsColors.iconBubble;
    final iconColor = sensitive
        ? SettingsColors.amberWarning
        : SettingsColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.lg,
        vertical: SettingsSpacing.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: SettingsSpacing.iconBubble,
            height: SettingsSpacing.iconBubble,
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: SettingsRadii.tile,
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: SettingsSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(title, style: SettingsTextStyles.rowTitle),
                    ),
                    if (sensitive) ...[
                      const SizedBox(width: SettingsSpacing.sm),
                      const _SensitivePill(),
                    ],
                  ],
                ),
                const SizedBox(height: SettingsSpacing.xs),
                Text(description, style: SettingsTextStyles.rowDescription),
              ],
            ),
          ),
          const SizedBox(width: SettingsSpacing.md),
          Switch(
            value: value,
            // `activeColor` is deprecated post-3.31; `activeThumbColor` is the
            // current spelling for the same web `--primary` accent.
            activeThumbColor: SettingsColors.primary,
            activeTrackColor: SettingsColors.primary.withValues(alpha: 0.45),
            inactiveThumbColor: SettingsColors.mutedForeground,
            inactiveTrackColor: SettingsColors.muted,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

/// The small amber 'Sensitive' pill beside a sensitive toggle label.
class _SensitivePill extends StatelessWidget {
  const _SensitivePill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: SettingsColors.amberSoft,
        borderRadius: SettingsRadii.chip,
      ),
      child: const Text(
        'Sensitive',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: SettingsColors.amberWarning,
        ),
      ),
    );
  }
}

/// Visual tone for a [SettingsStatusBanner].
enum SettingsBannerTone { neutral, online, offline, info }

/// A tinted status banner (icon + message) ported from EncryptionSettings.
class SettingsStatusBanner extends StatelessWidget {
  const SettingsStatusBanner({
    super.key,
    required this.icon,
    required this.message,
    this.tone = SettingsBannerTone.neutral,
  });

  final IconData icon;
  final String message;
  final SettingsBannerTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      SettingsBannerTone.online => (
        SettingsColors.onlineSoft,
        SettingsColors.online,
      ),
      SettingsBannerTone.offline => (
        SettingsColors.amberSoft,
        SettingsColors.amberWarning,
      ),
      SettingsBannerTone.info => (
        SettingsColors.primarySoft,
        SettingsColors.primary,
      ),
      SettingsBannerTone.neutral => (
        SettingsColors.mutedSoft,
        SettingsColors.mutedForeground,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.md,
        vertical: SettingsSpacing.md,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: SettingsRadii.tile,
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: SettingsSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: SettingsTextStyles.banner.copyWith(
                color: tone == SettingsBannerTone.neutral
                    ? SettingsColors.mutedForeground
                    : fg,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Visual variant for a [SettingsActionButton].
enum SettingsButtonVariant { primary, outline, destructive }

/// A consistent settings action button (outline / primary / destructive),
/// with an optional leading icon, busy state, and busy label.
class SettingsActionButton extends StatelessWidget {
  const SettingsActionButton({
    super.key,
    required this.label,
    required this.icon,
    this.onPressed,
    this.variant = SettingsButtonVariant.outline,
    this.busy = false,
    this.expanded = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final SettingsButtonVariant variant;
  final bool busy;

  /// When true the button stretches to fill its parent's width.
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final isEnabled = onPressed != null && !busy;
    final fg = switch (variant) {
      SettingsButtonVariant.primary => SettingsColors.primaryForeground,
      SettingsButtonVariant.destructive => SettingsColors.destructive,
      SettingsButtonVariant.outline => SettingsColors.foreground,
    };

    final content = Row(
      mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(fg),
            ),
          )
        else
          Icon(icon, size: 18, color: fg),
        const SizedBox(width: SettingsSpacing.sm),
        Flexible(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: SettingsTextStyles.button.copyWith(color: fg),
          ),
        ),
      ],
    );

    final inner = Container(
      height: SettingsSpacing.tapTarget,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: SettingsSpacing.lg),
      child: content,
    );

    BoxDecoration decoration;
    switch (variant) {
      case SettingsButtonVariant.primary:
        decoration = const BoxDecoration(
          gradient: SettingsGradients.primary,
          borderRadius: SettingsRadii.tile,
        );
      case SettingsButtonVariant.destructive:
        decoration = BoxDecoration(
          color: SettingsColors.destructiveSoft,
          borderRadius: SettingsRadii.tile,
          border: Border.all(
            color: SettingsColors.destructive.withValues(alpha: 0.4),
          ),
        );
      case SettingsButtonVariant.outline:
        decoration = BoxDecoration(
          color: SettingsColors.cardElevated,
          borderRadius: SettingsRadii.tile,
          border: Border.all(color: SettingsColors.border),
        );
    }

    final button = Opacity(
      opacity: isEnabled ? 1 : 0.5,
      child: DecoratedBox(
        decoration: decoration,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: SettingsRadii.tile,
            onTap: isEnabled ? onPressed : null,
            child: inner,
          ),
        ),
      ),
    );

    return expanded ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A compact diagnostic stat: a value over a muted label, in a tinted tile.
class SettingsStat extends StatelessWidget {
  const SettingsStat({
    super.key,
    required this.label,
    required this.value,
    this.accent,
  });

  final String label;
  final String value;

  /// Optional value tint (e.g. amber for a media-size warning).
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.md,
        vertical: SettingsSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SettingsColors.cardElevated,
        borderRadius: SettingsRadii.tile,
        border: Border.all(color: SettingsColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: accent == null
                ? SettingsTextStyles.statValue
                : SettingsTextStyles.statValue.copyWith(color: accent),
          ),
          const SizedBox(height: 2),
          Text(label, style: SettingsTextStyles.statLabel),
        ],
      ),
    );
  }
}
