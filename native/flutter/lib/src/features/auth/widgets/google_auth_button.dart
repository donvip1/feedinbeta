import 'package:flutter/material.dart';

import '../auth_theme.dart';

/// Seam for Google sign-in.
///
/// The real `google_sign_in` flow is not wired yet, so the button calls an
/// injectable handler of this shape. When the package lands, provide a handler
/// that performs the actual OAuth flow and pass it into `AuthGate` — the button
/// and both screens stay byte-for-byte the same (no layout change).
typedef GoogleSignInHandler = Future<void> Function(BuildContext context);

/// Default handler used until real Google sign-in is available: it simply
/// surfaces a "coming soon" snackbar. This is the fallback `AuthGate` uses when
/// no [GoogleSignInHandler] is injected.
Future<void> defaultGoogleSignInHandler(BuildContext context) async {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      const SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text('Google sign-in is coming soon'),
      ),
    );
}

/// A prominent, frosted "Sign in with Google" button that floats over the
/// gradient. Borderless-card styling: a translucent white fill with a hairline
/// white outline and the Google glyph. Purely presentational — tap handling is
/// delegated to [onPressed].
class GoogleAuthButton extends StatelessWidget {
  const GoogleAuthButton({
    super.key,
    required this.onPressed,
    this.label = 'Sign in with Google',
  });

  final VoidCallback? onPressed;
  final String label;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: Opacity(
        opacity: enabled ? 1 : 0.6,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AuthColors.glassFill,
            borderRadius: BorderRadius.circular(AuthRadii.pill),
            border: Border.all(color: AuthColors.glassLine),
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: BorderRadius.circular(AuthRadii.pill),
              onTap: onPressed,
              child: SizedBox(
                height: AuthSpacing.buttonHeight,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const _GoogleGlyph(),
                    const SizedBox(width: AuthSpacing.md),
                    Text(label, style: AuthTextStyles.glassButton),
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

/// A dependency-free stand-in for the Google "G" mark: a white disc with a
/// Google-blue "G". Swappable for the real logo asset alongside the package.
class _GoogleGlyph extends StatelessWidget {
  const _GoogleGlyph();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AuthColors.onBrand,
        shape: BoxShape.circle,
      ),
      child: const Text(
        'G',
        style: TextStyle(
          color: Color(0xFF4285F4), // Google blue
          fontSize: 15,
          fontWeight: FontWeight.w800,
          height: 1.0,
        ),
      ),
    );
  }
}
