import 'package:flutter/material.dart';

import '../../core/brand/brand_mark.dart';
import 'auth_theme.dart';
import 'widgets/auth_message.dart';
import 'widgets/auth_mode_switch.dart';
import 'widgets/brand_text_field.dart';
import 'widgets/google_auth_button.dart';
import 'widgets/primary_auth_button.dart';

/// Minimal, borderless login screen that floats over the brand gradient.
///
/// Owns only its [Form] validation and a transient validation banner; the
/// email/password controllers, busy flag, and status messages are supplied by
/// `AuthGate`, which also performs the actual repository calls.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.emailController,
    required this.passwordController,
    required this.isConfigured,
    required this.busy,
    required this.errorMessage,
    required this.infoMessage,
    required this.onSubmit,
    required this.onForgotPassword,
    required this.onGoogleSignIn,
    required this.onSwitchToSignUp,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;

  /// When false, secure login isn't wired — the primary button is disabled and
  /// the offline "local mode" entry (rendered by the gate) is the way in.
  final bool isConfigured;
  final bool busy;

  /// Auth failure text coming back from the repository call.
  final String? errorMessage;

  /// Confirmation/info text (e.g. "reset email sent").
  final String? infoMessage;

  final VoidCallback onSubmit;
  final VoidCallback onForgotPassword;
  final VoidCallback onGoogleSignIn;
  final VoidCallback onSwitchToSignUp;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();

  /// Local validation banner (e.g. forgot-password needs a valid email).
  String? _validationBanner;

  void _handleSubmit() {
    if (widget.busy || !widget.isConfigured) return;
    setState(() => _validationBanner = null);
    if (_formKey.currentState?.validate() ?? false) {
      widget.onSubmit();
    }
  }

  void _handleForgot() {
    if (widget.busy) return;
    final email = widget.emailController.text.trim();
    if (_emailError(email) != null) {
      setState(
        () => _validationBanner = 'Enter your email above to reset it.',
      );
      return;
    }
    setState(() => _validationBanner = null);
    widget.onForgotPassword();
  }

  @override
  Widget build(BuildContext context) {
    final banner = _validationBanner ?? widget.errorMessage;
    final canSubmit = widget.isConfigured && !widget.busy;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: BrandMark(size: 56),
        ),
        const SizedBox(height: AuthSpacing.lg),
        const Text('Welcome back', style: AuthTextStyles.headlineOnBrand),
        const SizedBox(height: AuthSpacing.sm),
        const Text(
          'Sign in to pick up right where you left off.',
          style: AuthTextStyles.subheadOnBrand,
        ),
        const SizedBox(height: AuthSpacing.xl),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              BrandTextField(
                controller: widget.emailController,
                label: 'Email',
                hintText: 'you@example.com',
                icon: Icons.alternate_email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                enabled: !widget.busy,
                autofillHints: const [AutofillHints.email],
                validator: (value) => _emailError(value?.trim() ?? ''),
              ),
              const SizedBox(height: AuthSpacing.lg),
              BrandTextField(
                controller: widget.passwordController,
                label: 'Password',
                hintText: 'Your password',
                icon: Icons.lock_outline,
                obscurable: true,
                textInputAction: TextInputAction.done,
                enabled: !widget.busy,
                autofillHints: const [AutofillHints.password],
                validator: _passwordError,
                onSubmitted: _handleSubmit,
              ),
            ],
          ),
        ),
        const SizedBox(height: AuthSpacing.xs),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: widget.busy ? null : _handleForgot,
            style: TextButton.styleFrom(
              foregroundColor: AuthColors.onBrand,
              disabledForegroundColor: AuthColors.onBrandFaint,
              padding: const EdgeInsets.symmetric(
                horizontal: AuthSpacing.sm,
                vertical: AuthSpacing.xs,
              ),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              'Forgot Password?',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        if (banner != null) ...[
          const SizedBox(height: AuthSpacing.md),
          AuthMessage(text: banner, tone: AuthMessageTone.error),
        ],
        if (widget.infoMessage != null) ...[
          const SizedBox(height: AuthSpacing.md),
          AuthMessage(text: widget.infoMessage!, tone: AuthMessageTone.info),
        ],
        const SizedBox(height: AuthSpacing.xl),
        PrimaryAuthButton(
          label: 'Sign In',
          busy: widget.busy,
          onPressed: canSubmit ? _handleSubmit : null,
        ),
        const SizedBox(height: AuthSpacing.lg),
        const _OrDivider(),
        const SizedBox(height: AuthSpacing.lg),
        GoogleAuthButton(
          onPressed: widget.busy ? null : widget.onGoogleSignIn,
        ),
        const SizedBox(height: AuthSpacing.xl),
        AuthModeSwitch(
          isSignIn: true,
          enabled: !widget.busy,
          onToggle: widget.onSwitchToSignUp,
        ),
      ],
    );
  }
}

String? _emailError(String value) {
  if (value.isEmpty) return 'Enter your email address.';
  final valid = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value);
  return valid ? null : 'Enter a valid email address.';
}

String? _passwordError(String? value) {
  if (value == null || value.isEmpty) return 'Enter your password.';
  if (value.length < 6) return 'Use at least 6 characters.';
  return null;
}

/// A faint "or" separator that floats over the gradient (no card).
class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: const [
        Expanded(child: Divider(color: AuthColors.glassLineFaint, height: 1)),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: AuthSpacing.md),
          child: Text(
            'or',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AuthColors.onBrandFaint,
            ),
          ),
        ),
        Expanded(child: Divider(color: AuthColors.glassLineFaint, height: 1)),
      ],
    );
  }
}
