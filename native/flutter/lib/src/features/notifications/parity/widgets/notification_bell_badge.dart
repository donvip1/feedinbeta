/// Notifications bell button + overlaid unread-count badge.
///
/// Presentational port of `src/components/notifications/NotificationBell.tsx`.
/// Renders a ghost-style [IconButton] with an overlaid destructive count badge.
/// Emits [onTap] only; the unread count is supplied by the view-model (no
/// realtime / Supabase here). When [pulse] is true the badge runs a subtle,
/// purely-cosmetic scale + opacity pulse (web `animate-pulse`).
///
/// Tokens are drawn exclusively from `notifications_tokens.dart` and types from
/// `notifications_view_models.dart`; no other app file is imported.
library;

import 'package:flutter/material.dart';

import '../notifications_tokens.dart';
import '../notifications_view_models.dart';

/// Ghost bell [IconButton] with an overlaid unread-count badge.
///
/// - Zero unread -> bare bell, no badge.
/// - 1..99 unread -> circular badge with the number.
/// - >99 unread -> pill badge reading '99+'.
/// - [pulse] true -> the badge gently pulses (scale 1.0 -> 1.12 + opacity).
class NotificationBellBadge extends StatefulWidget {
  const NotificationBellBadge({
    super.key,
    required this.viewModel,
    required this.onTap,
    this.pulse = false,
    this.foregroundColor,
  });

  /// Bell + unread badge state (count, capped label).
  final NotificationBellViewModel viewModel;

  /// Fired when the bell is tapped.
  final VoidCallback onTap;

  /// When true, the badge animates a subtle cosmetic pulse.
  final bool pulse;

  /// Optional bell icon color override for host app bars/overlays.
  final Color? foregroundColor;

  @override
  State<NotificationBellBadge> createState() => _NotificationBellBadgeState();
}

class _NotificationBellBadgeState extends State<NotificationBellBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: NotificationMotion.glowPulse,
    );
    _syncAnimation();
  }

  @override
  void didUpdateWidget(covariant NotificationBellBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pulse != widget.pulse ||
        oldWidget.viewModel.hasUnread != widget.viewModel.hasUnread) {
      _syncAnimation();
    }
  }

  /// Runs the pulse only when it would be visible (pulse on AND a badge shown);
  /// otherwise parks the controller at its resting frame.
  void _syncAnimation() {
    final shouldRun = widget.pulse && widget.viewModel.hasUnread;
    if (shouldRun) {
      if (!_controller.isAnimating) {
        _controller.repeat(reverse: true);
      }
    } else {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = widget.viewModel.hasUnread;

    return SizedBox(
      width: NotificationSpacing.tapTarget,
      height: NotificationSpacing.tapTarget,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // Base ghost bell button.
          IconButton(
            onPressed: widget.onTap,
            tooltip: 'Notifications',
            iconSize: 22,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(
              minWidth: NotificationSpacing.tapTarget,
              minHeight: NotificationSpacing.tapTarget,
            ),
            splashRadius: NotificationSpacing.tapTarget / 2,
            color: widget.foregroundColor ?? NotificationColors.foreground,
            icon: const Icon(Icons.notifications_none),
          ),

          // Overlaid unread badge — hidden entirely when count == 0.
          if (hasUnread)
            Positioned(
              top: -1,
              right: -1,
              child: _PulseWrapper(
                controller: _controller,
                active: widget.pulse,
                child: _CountBadge(label: widget.viewModel.badgeLabel),
              ),
            ),
        ],
      ),
    );
  }
}

/// Drives the cosmetic scale + opacity pulse on [child] when [active].
///
/// When inactive the child renders at its resting state (no rebuild churn).
class _PulseWrapper extends StatelessWidget {
  const _PulseWrapper({
    required this.controller,
    required this.active,
    required this.child,
  });

  final AnimationController controller;
  final bool active;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!active) return child;
    return AnimatedBuilder(
      animation: controller,
      child: child,
      builder: (context, inner) {
        final t = controller.value; // 0 -> 1 -> 0 (reverse repeat)
        final scale = 1.0 + (0.12 * t); // 1.0 -> 1.12
        final opacity = 1.0 - (0.25 * t); // gentle fade like web animate-pulse
        return Opacity(
          opacity: opacity,
          child: Transform.scale(scale: scale, child: inner),
        );
      },
    );
  }
}

/// The circular / pill destructive badge carrying the count label.
///
/// Grows horizontally for '99+' via a [ConstrainedBox] min-width + horizontal
/// padding; renders a crisp [NotificationColors.background] ring so it reads
/// against the bell icon.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(
        minWidth: NotificationSpacing.bellBadge,
        minHeight: NotificationSpacing.bellBadge,
      ),
      padding: const EdgeInsets.symmetric(horizontal: NotificationSpacing.xs),
      decoration: BoxDecoration(
        color: NotificationColors.destructive,
        borderRadius: BorderRadius.circular(NotificationRadii.pill),
        border: Border.all(color: NotificationColors.background, width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        textAlign: TextAlign.center,
        maxLines: 1,
        style: NotificationTextStyles.bellBadge,
      ),
    );
  }
}
