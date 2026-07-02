import 'package:flutter/material.dart';

import '../auth_theme.dart';

/// Which auth screen is showing. Lives here (rather than in `auth_gate.dart`)
/// so the screens and the switch can share it without importing the gate.
enum AuthMode { signIn, signUp }

/// The prompt + action that flips between Login and Signup, e.g.
/// "Don't have an account? Sign Up" / "Already have an account? Sign In".
///
/// The animated crossfade between the two screens is driven by the parent; this
/// widget is just the tappable link that requests the flip via [onToggle].
class AuthModeSwitch extends StatelessWidget {
  const AuthModeSwitch({
    super.key,
    required this.isSignIn,
    required this.onToggle,
    this.enabled = true,
  });

  final bool isSignIn;
  final VoidCallback onToggle;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final prompt = isSignIn
        ? "Don't have an account? "
        : 'Already have an account? ';
    final action = isSignIn ? 'Sign Up' : 'Sign In';

    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(prompt, style: AuthTextStyles.subheadOnBrand),
          InkWell(
            onTap: enabled ? onToggle : null,
            borderRadius: BorderRadius.circular(AuthRadii.md),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AuthSpacing.xs,
                vertical: AuthSpacing.xs,
              ),
              child: Text(
                action,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AuthColors.onBrand,
                  decoration: TextDecoration.underline,
                  decorationColor: AuthColors.onBrand,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
