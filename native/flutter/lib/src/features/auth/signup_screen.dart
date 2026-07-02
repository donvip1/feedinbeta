import 'package:flutter/material.dart';

import 'auth_theme.dart';
import 'widgets/auth_message.dart';
import 'widgets/auth_mode_switch.dart';
import 'widgets/brand_text_field.dart';
import 'widgets/google_auth_button.dart';
import 'widgets/primary_auth_button.dart';

/// Minimal, borderless signup screen that floats over the brand gradient.
///
/// Collects display name + email + password. The name is validated here for a
/// friendly first-run experience; the canonical profile (name + handle) is
/// captured on the profile-completion step that follows a successful sign-up.
/// Controllers, busy flag, and status messages are owned by `AuthGate`.
class SignupScreen extends StatefulWidget {
  const SignupScreen({
    super.key,
    required this.displayNameController,
    required this.emailController,
    required this.passwordController,
    required this.isConfigured,
    required this.busy,
    required this.errorMessage,
    required this.infoMessage,
    required this.onSubmit,
    required this.onGoogleSignIn,
    required this.onSwitchToSignIn,
  });

  final TextEditingController displayNameController;
  final TextEditingController emailController;
  final TextEditingController passwordController;

  final bool isConfigured;
  final bool busy;
  final String? errorMessage;
  final String? infoMessage;

  final VoidCallback onSubmit;
  final VoidCallback onGoogleSignIn;
  final VoidCallback onSwitchToSignIn;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();

  void _handleSubmit() {
    if (widget.busy || !widget.isConfigured) return;
    if (_formKey.currentState?.validate() ?? false) {
      widget.onSubmit();
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = widget.isConfigured && !widget.busy;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Create your account', style: AuthTextStyles.headlineOnBrand),
        const SizedBox(height: AuthSpacing.sm),
        const Text(
          'Join feedIn and start sharing in minutes.',
          style: AuthTextStyles.subheadOnBrand,
        ),
        const SizedBox(height: AuthSpacing.xl),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              BrandTextField(
                controller: widget.displayNameController,
                label: 'Display name',
                hintText: 'How should we call you?',
                icon: Icons.person_outline,
                textInputAction: TextInputAction.next,
                enabled: !widget.busy,
                autofillHints: const [AutofillHints.name],
                validator: _nameError,
              ),
              const SizedBox(height: AuthSpacing.lg),
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
                hintText: 'At least 6 characters',
                icon: Icons.lock_outline,
                obscurable: true,
                textInputAction: TextInputAction.done,
                enabled: !widget.busy,
                autofillHints: const [AutofillHints.newPassword],
                validator: _passwordError,
                onSubmitted: _handleSubmit,
              ),
            ],
          ),
        ),
        if (widget.errorMessage != null) ...[
          const SizedBox(height: AuthSpacing.md),
          AuthMessage(text: widget.errorMessage!, tone: AuthMessageTone.error),
        ],
        if (widget.infoMessage != null) ...[
          const SizedBox(height: AuthSpacing.md),
          AuthMessage(text: widget.infoMessage!, tone: AuthMessageTone.info),
        ],
        const SizedBox(height: AuthSpacing.xl),
        PrimaryAuthButton(
          label: 'Create Account',
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
          isSignIn: false,
          enabled: !widget.busy,
          onToggle: widget.onSwitchToSignIn,
        ),
      ],
    );
  }
}

String? _nameError(String? value) {
  final name = value?.trim() ?? '';
  if (name.isEmpty) return 'Enter a display name.';
  if (name.length < 2) return 'Use at least 2 characters.';
  return null;
}

String? _emailError(String value) {
  if (value.isEmpty) return 'Enter your email address.';
  final valid = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value);
  return valid ? null : 'Enter a valid email address.';
}

String? _passwordError(String? value) {
  if (value == null || value.isEmpty) return 'Create a password.';
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
