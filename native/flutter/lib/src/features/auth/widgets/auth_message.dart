import 'package:flutter/material.dart';

import '../auth_theme.dart';

/// Tone of an inline auth message.
enum AuthMessageTone { error, info }

/// A borderless inline banner that floats over the gradient to surface auth
/// failures (error) or confirmations like "reset email sent" (info). Kept tiny
/// and reusable so both the login and signup screens report status the same
/// way without any card chrome.
class AuthMessage extends StatelessWidget {
  const AuthMessage({super.key, required this.text, required this.tone});

  final String text;
  final AuthMessageTone tone;

  @override
  Widget build(BuildContext context) {
    final isError = tone == AuthMessageTone.error;
    final fill = isError ? AuthColors.onBrandErrorFill : AuthColors.glassFill;
    final ink = isError ? AuthColors.onBrandError : AuthColors.onBrand;
    final icon = isError ? Icons.error_outline : Icons.check_circle_outline;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AuthSpacing.md,
        vertical: AuthSpacing.md,
      ),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(AuthRadii.lg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: ink),
          const SizedBox(width: AuthSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.35,
                fontWeight: FontWeight.w600,
                color: ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
