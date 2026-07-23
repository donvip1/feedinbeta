import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';
import 'hero_transition_layer.dart';

/// Presents a glassy creator preview card that flies open from the tapped
/// avatar (shared [heroTag]) over a blurred, dimmed barrier.
///
/// Presentation-only: [onFollow] is an optional callback the host wires to its
/// own logic — this sheet never talks to a repository directly.
Future<void> showCreatorPreview(
  BuildContext context, {
  required Object heroTag,
  required String name,
  String handle = '',
  String? avatarUrl,
  VoidCallback? onFollow,
}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: FeedImmersiveTheme.sheetBarrier,
    transitionDuration: FeedImmersiveTheme.motionSheet,
    pageBuilder: (context, _, _) => _CreatorPreviewCard(
      heroTag: heroTag,
      name: name,
      handle: handle,
      avatarUrl: avatarUrl,
      onFollow: onFollow,
    ),
    transitionBuilder: (context, animation, _, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: FeedImmersiveTheme.sheetCurve,
        reverseCurve: FeedImmersiveTheme.sheetReverseCurve,
      );
      return FadeTransition(
        opacity: curved,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
            sigmaX: FeedImmersiveTheme.sheetBarrierBlur * animation.value,
            sigmaY: FeedImmersiveTheme.sheetBarrierBlur * animation.value,
          ),
          child: Transform.scale(
            scale: 0.94 + (0.06 * curved.value),
            child: child,
          ),
        ),
      );
    },
  );
}

class _CreatorPreviewCard extends StatelessWidget {
  const _CreatorPreviewCard({
    required this.heroTag,
    required this.name,
    required this.handle,
    required this.avatarUrl,
    required this.onFollow,
  });

  final Object heroTag;
  final String name;
  final String handle;
  final String? avatarUrl;
  final VoidCallback? onFollow;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: FeedImmersiveTheme.spacingXl),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(FeedImmersiveTheme.sheetRadius),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(
              sigmaX: FeedImmersiveTheme.blurStrong,
              sigmaY: FeedImmersiveTheme.blurStrong,
            ),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 360),
              decoration: BoxDecoration(
                color: FeedImmersiveTheme.glassSurfaceStrong,
                borderRadius: BorderRadius.circular(FeedImmersiveTheme.sheetRadius),
                border: Border.all(color: FeedImmersiveTheme.glassBorder),
                boxShadow: FeedImmersiveTheme.floatingShadow,
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: _CloseButton(
                        onTap: () => Navigator.of(context).maybePop(),
                      ),
                    ),
                    CreatorAvatarHero(
                      tag: heroTag,
                      child: _PreviewAvatar(url: avatarUrl, fallback: name),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: FeedImmersiveTheme.authorName.copyWith(fontSize: 20),
                    ),
                    if (handle.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        handle.trim(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: FeedImmersiveTheme.handle.copyWith(
                          color: FeedImmersiveTheme.brandPink,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    _FollowButton(
                      name: name,
                      onFollow: onFollow,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PreviewAvatar extends StatelessWidget {
  const _PreviewAvatar({required this.url, required this.fallback});

  final String? url;
  final String fallback;

  static const double _size = 88;

  @override
  Widget build(BuildContext context) {
    final hasImage = url?.trim().isNotEmpty == true;
    final initial = fallback.trim().isEmpty
        ? '?'
        : fallback.trim().characters.first.toUpperCase();
    return Container(
      width: _size,
      height: _size,
      padding: const EdgeInsets.all(3),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: FeedImmersiveTheme.brandGradient,
        boxShadow: FeedImmersiveTheme.brandGlow,
      ),
      child: ClipOval(
        child: hasImage
            ? Image.network(
                url!,
                fit: BoxFit.cover,
                filterQuality: FilterQuality.medium,
                errorBuilder: (_, _, _) => _Initial(initial),
              )
            : _Initial(initial),
      ),
    );
  }
}

class _Initial extends StatelessWidget {
  const _Initial(this.initial);
  final String initial;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: FeedImmersiveTheme.brandGradient,
      ),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: FeedImmersiveTheme.onMedia,
            fontSize: 30,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      iconSize: FeedImmersiveTheme.iconSm,
      color: FeedImmersiveTheme.inkMuted,
      icon: const Icon(Icons.close_rounded),
      tooltip: 'Close',
    );
  }
}

class _FollowButton extends StatelessWidget {
  const _FollowButton({required this.name, required this.onFollow});

  final String name;
  final VoidCallback? onFollow;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: FeedImmersiveTheme.brandGradient,
          borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
          boxShadow: FeedImmersiveTheme.brandGlow,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
            onTap: () {
              HapticFeedback.selectionClick();
              onFollow?.call();
              Navigator.of(context).maybePop();
            },
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: Text(
                  'Follow Creator',
                  style: TextStyle(
                    color: FeedImmersiveTheme.onMedia,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
