import 'package:flutter/material.dart';

/// Reusable feedIn logo mark, backed by the bundled brand asset
/// (`assets/brand/feedin-logo.png`). Use it for the auth header, empty states,
/// loaders, and anywhere the brand should appear, so the logo is defined once.
///
/// Falls back to a branded gradient glyph if the asset can't be decoded, so it
/// never renders a broken image.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 72, this.semanticLabel = 'feedIn'});

  /// Rendered width/height in logical pixels (the logo is square).
  final double size;
  final String semanticLabel;

  static const _asset = 'assets/brand/feedin-logo.png';

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      _asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      semanticLabel: semanticLabel,
      errorBuilder: (context, error, stack) => _FallbackGlyph(size: size),
    );
  }
}

/// Brand-gradient rounded glyph shown if the logo asset is unavailable.
class _FallbackGlyph extends StatelessWidget {
  const _FallbackGlyph({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.24),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF3D9A), Color(0xFFFF7A45)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        'f',
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.6,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
