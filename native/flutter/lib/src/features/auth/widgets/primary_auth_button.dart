import 'package:flutter/material.dart';

import '../auth_theme.dart';

/// The single, large, rounded primary call-to-action for the auth screens
/// ("Sign In" / "Create Account").
///
/// It is a solid white pill carrying the brand-pink label so it reads as the
/// one unmistakable action floating over the gradient. When [busy] is true it
/// swaps the label for a brand-pink spinner and blocks taps; passing a null
/// [onPressed] disables it.
class PrimaryAuthButton extends StatelessWidget {
  const PrimaryAuthButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 160),
        opacity: enabled ? 1 : 0.6,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AuthColors.onBrand,
            borderRadius: BorderRadius.circular(AuthRadii.pill),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 24,
                offset: Offset(0, 10),
              ),
            ],
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: BorderRadius.circular(AuthRadii.pill),
              onTap: enabled ? onPressed : null,
              child: SizedBox(
                height: AuthSpacing.buttonHeight,
                child: Center(
                  child: busy
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              AuthColors.brandPink,
                            ),
                          ),
                        )
                      : Text(label, style: AuthTextStyles.primaryButtonOnBrand),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
