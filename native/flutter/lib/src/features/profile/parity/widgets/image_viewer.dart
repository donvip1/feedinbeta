/// Full-screen image viewer for the profile avatar and cover.
///
/// Ports the web `ProfileImageModal.tsx` view affordance: tapping the header
/// avatar or cover opens the image full-screen over a dark backdrop, where it
/// can be pinch-zoomed / panned and dismissed by tapping the backdrop or the
/// close button. The web modal is view-only (no edit here), matching this.
///
/// Pure presentational: it takes a resolved image URL + shape and renders the
/// overlay. Presentation is via [ProfileImageViewer.show], which pushes a
/// transparent-barrier dialog so the underlying profile stays visible behind
/// the scrim. Falls back to a gradient-initials tile when the image fails so a
/// broken URL never shows a raw error.
///
/// Web parity reference:
///   - src/components/profile/ProfileImageModal.tsx (full-screen view + close)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';

/// A tap-to-zoom full-screen viewer for a single profile image.
class ProfileImageViewer extends StatelessWidget {
  const ProfileImageViewer._({
    required this.imageUrl,
    required this.initial,
    required this.isCircle,
  });

  final String imageUrl;

  /// First-letter fallback used if the image fails to load.
  final String initial;

  /// Circle for avatars; rounded rectangle for covers.
  final bool isCircle;

  /// Present the viewer as a full-screen dark overlay. Does nothing when
  /// [imageUrl] is empty so callers can wire it unconditionally.
  static Future<void> show(
    BuildContext context, {
    required String? imageUrl,
    required String initial,
    bool isCircle = true,
  }) {
    final url = imageUrl?.trim() ?? '';
    if (url.isEmpty) return Future<void>.value();
    return showDialog<void>(
      context: context,
      barrierColor: ProfileColors.imageViewerBackdrop,
      builder: (_) => ProfileImageViewer._(
        imageUrl: url,
        initial: initial,
        isCircle: isCircle,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: EdgeInsets.zero,
      child: Stack(
        children: [
          // Tap anywhere on the backdrop to dismiss.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          Center(
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: ProfileSpacing.lg,
                vertical: media.padding.top + ProfileSpacing.xl,
              ),
              child: InteractiveViewer(
                maxScale: 4,
                child: ClipRRect(
                  borderRadius: isCircle
                      ? BorderRadius.circular(999)
                      : ProfileRadii.card,
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => _Fallback(initial: initial),
                    loadingBuilder: (context, child, progress) =>
                        progress == null
                        ? child
                        : const SizedBox(
                            width: 64,
                            height: 64,
                            child: Center(
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: ProfileColors.primary,
                              ),
                            ),
                          ),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: media.padding.top + ProfileSpacing.sm,
            right: ProfileSpacing.sm,
            child: Material(
              color: ProfileColors.tileBadgeScrim,
              shape: const CircleBorder(),
              child: IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                tooltip: 'Close',
                icon: const Icon(
                  Icons.close,
                  color: ProfileColors.primaryForeground,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.initial});

  final String initial;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      height: 220,
      decoration: const BoxDecoration(
        gradient: ProfileGradients.avatarFallback,
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 96,
          fontWeight: FontWeight.w700,
          color: ProfileColors.primaryForeground,
        ),
      ),
    );
  }
}
