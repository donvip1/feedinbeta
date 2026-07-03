import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Shared cached-image primitives for the whole app.
///
/// Every remote image should render through [CachedImage] (rectangular media,
/// thumbnails, covers) or [CachedCircleAvatar] (circular avatars) rather than a
/// bare `Image.network`. Both are backed by [CachedNetworkImage], so bytes are
/// fetched once and served from the shared on-disk store (the same
/// [DefaultCacheManager] the reel preloader warms) on every subsequent view —
/// no re-download on scroll, rebuild, or screen re-entry.
///
/// The widgets are deliberately self-contained (no feature theme imports) so
/// any module can drop them in. They never throw on a null/empty URL: they fall
/// back to a neutral placeholder or the caller-supplied error/fallback widget.

/// Neutral fill for the placeholder / error box when no colour is supplied.
const Color _kNeutralBox = Color(0xFFE9E9EC);

/// Muted glyph tint used by the default error/broken-image icon.
const Color _kNeutralIcon = Color(0xFF9A9AA2);

/// A remote image with transparent disk+memory caching, a subtle placeholder
/// while loading, and a graceful error fallback.
///
/// Drop-in replacement for `Image.network`: pass the same [width] / [height] /
/// [fit]. Map any old `errorBuilder` to [errorWidget]; drop any `loadingBuilder`
/// (the [placeholderColor] box covers the loading phase). Provide [borderRadius]
/// to clip the result in a [ClipRRect].
class CachedImage extends StatelessWidget {
  const CachedImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholderColor,
    this.errorWidget,
  });

  /// The remote image URL. When null or empty, the error/placeholder box is
  /// rendered instead of attempting a fetch (never crashes).
  final String? url;

  final double? width;
  final double? height;

  /// How the image is inscribed into its box. Defaults to [BoxFit.cover].
  final BoxFit fit;

  /// When set, the whole result (image, placeholder, error) is clipped with a
  /// [ClipRRect] using this radius.
  final BorderRadius? borderRadius;

  /// Fill colour for the loading placeholder box. Falls back to a faint neutral.
  final Color? placeholderColor;

  /// Rendered when the URL is null/empty or the fetch fails. Falls back to a
  /// broken-image glyph on a neutral box.
  final Widget? errorWidget;

  @override
  Widget build(BuildContext context) {
    final Widget child;
    if (url == null || url!.isEmpty) {
      child = _error();
    } else {
      child = CachedNetworkImage(
        imageUrl: url!,
        width: width,
        height: height,
        fit: fit,
        placeholder: (_, __) => _placeholder(),
        errorWidget: (_, __, ___) => _error(),
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }

  /// A faint, shimmer-free neutral box shown while the image loads.
  Widget _placeholder() {
    return Container(
      width: width,
      height: height,
      color: placeholderColor ?? _kNeutralBox,
    );
  }

  /// The error/empty fallback: the caller's [errorWidget] or a broken-image
  /// glyph centred on a neutral box.
  Widget _error() {
    if (errorWidget != null) return errorWidget!;
    return Container(
      width: width,
      height: height,
      color: placeholderColor ?? _kNeutralBox,
      alignment: Alignment.center,
      child: const Icon(
        Icons.broken_image_outlined,
        color: _kNeutralIcon,
        size: 24,
      ),
    );
  }
}

/// A circular cached avatar with an initial/icon fallback.
///
/// Renders the cached remote image clipped to a circle of diameter
/// `radius * 2`. When [url] is null/empty or the fetch fails, [fallback] is
/// shown (or a neutral person glyph when none is supplied). Convenience wrapper
/// over [CachedImage] for the app's many avatar call sites.
class CachedCircleAvatar extends StatelessWidget {
  const CachedCircleAvatar({
    super.key,
    required this.url,
    required this.radius,
    this.fallback,
  });

  /// The remote avatar URL; null/empty renders [fallback].
  final String? url;

  /// Circle radius; the rendered avatar is `radius * 2` on a side.
  final double radius;

  /// Shown when there is no URL or the image fails (e.g. a gradient initial).
  /// Defaults to a neutral person glyph on a faint circle.
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final double diameter = radius * 2;
    final Widget fallbackWidget = _fallback(diameter);

    if (url == null || url!.isEmpty) {
      return ClipOval(child: fallbackWidget);
    }

    return ClipOval(
      child: SizedBox(
        width: diameter,
        height: diameter,
        child: CachedImage(
          url: url,
          width: diameter,
          height: diameter,
          fit: BoxFit.cover,
          errorWidget: fallbackWidget,
        ),
      ),
    );
  }

  Widget _fallback(double diameter) {
    if (fallback != null) {
      return SizedBox(width: diameter, height: diameter, child: fallback);
    }
    return Container(
      width: diameter,
      height: diameter,
      color: _kNeutralBox,
      alignment: Alignment.center,
      child: Icon(Icons.person, color: _kNeutralIcon, size: radius),
    );
  }
}
