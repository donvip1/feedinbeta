import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../profile/parity/widgets/image_viewer.dart';
import 'feed_immersive_theme.dart';
import 'hero_transition_layer.dart';

typedef CreatorFollowCallback = Future<bool> Function();

/// Loads live stats (followers / following / posts) for the creator card. Any
/// value left null is simply hidden. Returning null skips the stats row.
typedef CreatorStatsLoader = Future<CreatorStats?> Function();

/// Lightweight stats shown on the mini profile card.
class CreatorStats {
  const CreatorStats({this.posts, this.followers, this.following});

  final int? posts;
  final int? followers;
  final int? following;

  bool get hasAny => posts != null || followers != null || following != null;
}

Future<void> showCreatorPreview(
  BuildContext context, {
  required Object heroTag,
  required String name,
  String handle = '',
  String? avatarUrl,
  String? bio,
  bool isVerified = false,
  bool initiallyFollowing = false,
  CreatorFollowCallback? onToggleFollow,
  CreatorStatsLoader? loadStats,
  VoidCallback? onViewProfile,
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
      bio: bio,
      isVerified: isVerified,
      initiallyFollowing: initiallyFollowing,
      onToggleFollow: onToggleFollow,
      loadStats: loadStats,
      onViewProfile: onViewProfile,
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

class _CreatorPreviewCard extends StatefulWidget {
  const _CreatorPreviewCard({
    required this.heroTag,
    required this.name,
    required this.handle,
    required this.avatarUrl,
    required this.bio,
    required this.isVerified,
    required this.initiallyFollowing,
    required this.onToggleFollow,
    required this.loadStats,
    required this.onViewProfile,
  });

  final Object heroTag;
  final String name;
  final String handle;
  final String? avatarUrl;
  final String? bio;
  final bool isVerified;
  final bool initiallyFollowing;
  final CreatorFollowCallback? onToggleFollow;
  final CreatorStatsLoader? loadStats;
  final VoidCallback? onViewProfile;

  @override
  State<_CreatorPreviewCard> createState() => _CreatorPreviewCardState();
}

class _CreatorPreviewCardState extends State<_CreatorPreviewCard> {
  late bool _following = widget.initiallyFollowing;
  bool _followLoading = false;
  String? _followError;
  CreatorStats? _stats;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final loader = widget.loadStats;
    if (loader == null) return;
    try {
      final stats = await loader();
      if (!mounted) return;
      setState(() => _stats = stats);
    } catch (_) {
      // Stats are decorative; a failure just leaves the row hidden.
    }
  }

  String get _initial {
    final name = widget.name.trim();
    return name.isEmpty ? '?' : name.characters.first.toUpperCase();
  }

  Future<void> _toggleFollow() async {
    if (_followLoading || widget.onToggleFollow == null) return;
    HapticFeedback.selectionClick();
    setState(() {
      _followLoading = true;
      _followError = null;
    });
    try {
      final following = await widget.onToggleFollow!();
      if (!mounted) return;
      setState(() => _following = following);
    } catch (_) {
      if (!mounted) return;
      setState(() => _followError = 'Could not update follow state.');
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  void _viewProfile() {
    Navigator.of(context).maybePop();
    widget.onViewProfile?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: FeedImmersiveTheme.spacingXl,
        ),
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
                borderRadius: BorderRadius.circular(
                  FeedImmersiveTheme.sheetRadius,
                ),
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
                      child: IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        iconSize: FeedImmersiveTheme.iconSm,
                        color: FeedImmersiveTheme.inkMuted,
                        icon: const Icon(Icons.close_rounded),
                        tooltip: 'Close',
                      ),
                    ),
                    GestureDetector(
                      onTap: () => ProfileImageViewer.show(
                        context,
                        imageUrl: widget.avatarUrl,
                        initial: _initial,
                        isCircle: true,
                      ),
                      child: CreatorAvatarHero(
                        tag: widget.heroTag,
                        child: _PreviewAvatar(
                          url: widget.avatarUrl,
                          fallback: widget.name,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            widget.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: FeedImmersiveTheme.authorName.copyWith(
                              fontSize: 20,
                            ),
                          ),
                        ),
                        if (widget.isVerified) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.verified_rounded,
                            size: 18,
                            color: FeedImmersiveTheme.brandPink,
                          ),
                        ],
                      ],
                    ),
                    if (widget.handle.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        widget.handle.trim(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: FeedImmersiveTheme.handle.copyWith(
                          color: FeedImmersiveTheme.brandPink,
                        ),
                      ),
                    ],
                    if (widget.bio?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: 10),
                      Text(
                        widget.bio!.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: FeedImmersiveTheme.inkMuted,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ],
                    if (_stats?.hasAny == true) ...[
                      const SizedBox(height: 16),
                      _StatsRow(stats: _stats!),
                    ],
                    if (_followError != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        _followError!,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    if (widget.onToggleFollow != null)
                      _FollowButton(
                        isFollowing: _following,
                        isLoading: _followLoading,
                        onTap: _toggleFollow,
                      ),
                    if (widget.onViewProfile != null) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _viewProfile,
                          icon: const Icon(Icons.person_outline),
                          label: const Text('View Profile'),
                        ),
                      ),
                    ],
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

/// Posts · Followers · Following, shown on the mini profile card when stats
/// resolve. Each cell hides if its value is null.
class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});

  final CreatorStats stats;

  @override
  Widget build(BuildContext context) {
    final cells = <Widget>[
      if (stats.posts != null) _cell(stats.posts!, 'Posts'),
      if (stats.followers != null) _cell(stats.followers!, 'Followers'),
      if (stats.following != null) _cell(stats.following!, 'Following'),
    ];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: cells,
    );
  }

  Widget _cell(int value, String label) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          _compact(value),
          style: const TextStyle(
            color: FeedImmersiveTheme.ink,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            color: FeedImmersiveTheme.inkMuted,
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  static String _compact(int value) {
    if (value >= 1000000) {
      final v = (value / 1000000).toStringAsFixed(1);
      return '${v.endsWith('.0') ? v.substring(0, v.length - 2) : v}M';
    }
    if (value >= 1000) {
      final v = (value / 1000).toStringAsFixed(1);
      return '${v.endsWith('.0') ? v.substring(0, v.length - 2) : v}K';
    }
    return '$value';
  }
}

class _FollowButton extends StatelessWidget {
  const _FollowButton({
    required this.isFollowing,
    required this.isLoading,
    required this.onTap,
  });

  final bool isFollowing;
  final bool isLoading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: isFollowing ? null : FeedImmersiveTheme.brandGradient,
          color: isFollowing ? FeedImmersiveTheme.glassSurface : null,
          borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
          border: isFollowing
              ? Border.all(color: FeedImmersiveTheme.glassBorder)
              : null,
          boxShadow: isFollowing ? null : FeedImmersiveTheme.brandGlow,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
            onTap: isLoading ? null : onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: FeedImmersiveTheme.onMedia,
                        ),
                      )
                    : Text(
                        isFollowing ? 'Following' : 'Follow Creator',
                        style: const TextStyle(
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
