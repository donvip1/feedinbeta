import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;

import '../../app/feedin_services.dart';
import '../feed/feed_shell.dart';
import '../profile/profile_completion_screen.dart';
import '../profile/user_profile.dart';
import 'auth_theme.dart';
import 'data/auth_repository.dart';

enum AuthMode { signIn, signUp }

class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.services});

  final FeedinServices services;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _newPasswordController = TextEditingController();

  AuthMode _mode = AuthMode.signIn;
  AuthUser? _user;
  UserProfile? _profile;
  StreamSubscription<AuthState>? _authSubscription;
  bool _isCheckingSession = true;
  bool _isSubmitting = false;
  bool _isRecoveringPassword = false;
  String? _message;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _listenForPasswordRecovery();
    _restoreSession();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _newPasswordController.dispose();
    _authSubscription?.cancel();
    super.dispose();
  }

  void _listenForPasswordRecovery() {
    if (!widget.services.authRepository.isConfigured) return;

    _authSubscription = Supabase.instance.client.auth.onAuthStateChange.listen((
      data,
    ) {
      if (data.event != AuthChangeEvent.passwordRecovery) return;
      if (!mounted) return;

      setState(() {
        _isRecoveringPassword = true;
        _message = 'Enter a new password to finish account recovery.';
        _errorMessage = null;
      });
    });
  }

  Future<void> _restoreSession() async {
    try {
      final user = await widget.services.authRepository.restoreSession();
      final profile = user == null
          ? null
          : await widget.services.profileRepository.loadProfileForUser(user.id);
      if (!mounted) return;
      setState(() {
        _user = user;
        _profile = profile;
      });
    } finally {
      if (mounted) {
        setState(() => _isCheckingSession = false);
      }
    }
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _message = null;
      _errorMessage = null;
    });

    try {
      final user = switch (_mode) {
        AuthMode.signIn =>
          await widget.services.authRepository.signInWithPassword(
            email: _emailController.text,
            password: _passwordController.text,
          ),
        AuthMode.signUp =>
          await widget.services.authRepository.signUpWithPassword(
            email: _emailController.text,
            password: _passwordController.text,
          ),
      };

      if (!mounted) return;

      if (user == null) {
        setState(
          () => _message =
              'Account created. Check your email to confirm before signing in.',
        );
        return;
      }

      final profile = await widget.services.profileRepository
          .loadProfileForUser(user.id);

      setState(() {
        _user = user;
        _profile = profile;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _formatError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _sendPasswordReset() async {
    setState(() {
      _isSubmitting = true;
      _message = null;
      _errorMessage = null;
    });

    try {
      await widget.services.authRepository.sendPasswordReset(
        email: _emailController.text,
      );
      if (!mounted) return;
      setState(
        () => _message = widget.services.authRepository.isConfigured
            ? 'Password reset email sent if the account exists.'
            : 'Add Supabase keys before password reset can send email.',
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _formatError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _updatePassword() async {
    final password = _newPasswordController.text;
    if (password.length < 6) {
      setState(() => _errorMessage = 'Use at least 6 characters.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _message = null;
      _errorMessage = null;
    });

    try {
      await widget.services.authRepository.updatePassword(password: password);
      final user = await widget.services.authRepository.restoreSession();
      final profile = user == null
          ? null
          : await widget.services.profileRepository.loadProfileForUser(user.id);
      if (!mounted) return;
      setState(() {
        _user = user;
        _profile = profile;
        _isRecoveringPassword = false;
        _message = 'Password updated.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _formatError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _signOut() async {
    await widget.services.authRepository.signOut();
    await widget.services.profileRepository.clearCurrentProfile();
    if (!mounted) return;
    setState(() {
      _user = null;
      _profile = null;
    });
  }

  String _formatError(Object error) {
    final raw = error.toString();
    return raw
        .replaceFirst('AuthException(message: ', '')
        .replaceFirst(', statusCode: null, errorCode: null)', '');
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingSession) {
      return const Scaffold(
        backgroundColor: AuthColors.background,
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AuthColors.primary),
          ),
        ),
      );
    }

    final user = _user;

    if (_isRecoveringPassword) {
      return _PasswordRecoveryScaffold(
        controller: _newPasswordController,
        isSubmitting: _isSubmitting,
        message: _message,
        errorMessage: _errorMessage,
        onSubmit: _updatePassword,
      );
    }

    if (user != null) {
      final profile = _profile;

      if (profile == null) {
        return ProfileCompletionScreen(
          user: user,
          requireRemoteSync: widget.services.authRepository.isConfigured,
          onComplete: (completedProfile) async {
            try {
              await widget.services.profileRepository.syncProfile(
                completedProfile,
              );
            } catch (error) {
              if (widget.services.authRepository.isConfigured) {
                rethrow;
              } else {
                await widget.services.profileRepository.saveCurrentProfile(
                  completedProfile,
                );
              }
            }
            if (!mounted) return;
            setState(() => _profile = completedProfile);
          },
        );
      }

      return FeedShell(
        displayName: profile.displayName,
        profile: profile,
        feedRepository: widget.services.feedRepository,
        messagesRepository: widget.services.messagesRepository,
        notificationRepository: widget.services.notificationRepository,
        preferencesRepository: widget.services.preferencesRepository,
        conversationStarter: widget.services.conversationStarter,
        profileRepository: widget.services.profileRepository,
        postDraftRepository: widget.services.postDraftRepository,
        uploadQueueRepository: widget.services.uploadQueueRepository,
        syncService: widget.services.syncService,
        uploadQueueService: widget.services.uploadQueueService,
        foregroundSyncCoordinator: widget.services.foregroundSyncCoordinator,
        storageDiagnosticsService: widget.services.storageDiagnosticsService,
        realtimeService: widget.services.realtimeService,
        storageMaintenance: widget.services.storageMaintenance,
        pushNotificationService: widget.services.pushNotificationService,
        onSignOut: _signOut,
      );
    }

    final isConfigured = widget.services.authRepository.isConfigured;
    final isSignIn = _mode == AuthMode.signIn;

    return Scaffold(
      backgroundColor: AuthColors.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 760;
            final content = [
              const _OnboardingBrandPanel(),
              _AuthFormPanel(
                isConfigured: isConfigured,
                isSignIn: isSignIn,
                mode: _mode,
                emailController: _emailController,
                passwordController: _passwordController,
                isSubmitting: _isSubmitting,
                message: _message,
                errorMessage: _errorMessage,
                onModeChanged: (mode) {
                  setState(() {
                    _mode = mode;
                    _message = null;
                    _errorMessage = null;
                  });
                },
                onSubmit: _submit,
                onPasswordReset: _sendPasswordReset,
                onLocalEntry: isConfigured
                    ? null
                    : () => setState(() {
                        _user = const AuthUser.demo();
                        _profile = null;
                      }),
              ),
            ];

            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 980),
                  child: isWide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(child: content[0]),
                            const SizedBox(width: 28),
                            Expanded(child: content[1]),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            content[0],
                            const SizedBox(height: 18),
                            content[1],
                          ],
                        ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _OnboardingBrandPanel extends StatelessWidget {
  const _OnboardingBrandPanel();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Gradient logo mark + wordmark.
        Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                gradient: AuthGradients.brandMark,
                borderRadius: AuthRadii.field,
                boxShadow: AuthShadows.glow,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.bolt,
                color: AuthColors.primaryForeground,
                size: 28,
              ),
            ),
            const SizedBox(width: AuthSpacing.md),
            const Text('feedIn', style: AuthTextStyles.brand),
          ],
        ),
        const SizedBox(height: AuthSpacing.xl),
        const Text(
          'Create, connect, and share\nwithout losing your flow.',
          style: AuthTextStyles.tagline,
        ),
        const SizedBox(height: AuthSpacing.xl),
        Wrap(
          spacing: AuthSpacing.sm,
          runSpacing: AuthSpacing.sm,
          children: const [
            _OnboardingChip(icon: Icons.play_circle_outline, label: 'Video'),
            _OnboardingChip(icon: Icons.chat_bubble_outline, label: 'Chats'),
            _OnboardingChip(icon: Icons.cloud_done_outlined, label: 'Sync'),
          ],
        ),
      ],
    );
  }
}

class _OnboardingChip extends StatelessWidget {
  const _OnboardingChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AuthSpacing.md,
        vertical: AuthSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AuthColors.primarySoft,
        borderRadius: AuthRadii.chip,
        border: Border.all(color: AuthColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AuthColors.primary),
          const SizedBox(width: AuthSpacing.xs),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AuthColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthFormPanel extends StatelessWidget {
  const _AuthFormPanel({
    required this.isConfigured,
    required this.isSignIn,
    required this.mode,
    required this.emailController,
    required this.passwordController,
    required this.isSubmitting,
    required this.message,
    required this.errorMessage,
    required this.onModeChanged,
    required this.onSubmit,
    required this.onPasswordReset,
    required this.onLocalEntry,
  });

  final bool isConfigured;
  final bool isSignIn;
  final AuthMode mode;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool isSubmitting;
  final String? message;
  final String? errorMessage;
  final ValueChanged<AuthMode> onModeChanged;
  final VoidCallback onSubmit;
  final VoidCallback onPasswordReset;
  final VoidCallback? onLocalEntry;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AuthColors.card,
        borderRadius: AuthRadii.card,
        border: Border.all(color: AuthColors.border),
        boxShadow: AuthShadows.card,
      ),
      padding: const EdgeInsets.all(AuthSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            isSignIn ? 'Welcome back' : 'Create your account',
            style: AuthTextStyles.headline,
          ),
          const SizedBox(height: AuthSpacing.xs),
          Text(
            isSignIn
                ? 'Sign in to continue your feed, messages, and profile.'
                : 'Start with your email and finish your profile next.',
            style: AuthTextStyles.subhead,
          ),
          const SizedBox(height: AuthSpacing.xl),
          _AuthModeToggle(
            mode: mode,
            enabled: !isSubmitting,
            onModeChanged: onModeChanged,
          ),
          const SizedBox(height: AuthSpacing.xl),
          const _AuthFieldLabel('Email'),
          const SizedBox(height: AuthSpacing.sm),
          _AuthTextField(
            controller: emailController,
            hintText: 'you@example.com',
            icon: Icons.alternate_email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AuthSpacing.lg),
          const _AuthFieldLabel('Password'),
          const SizedBox(height: AuthSpacing.sm),
          _AuthPasswordField(
            controller: passwordController,
            hintText: 'Enter your password',
            textInputAction: TextInputAction.done,
            onSubmitted: () {
              if (isConfigured && !isSubmitting) onSubmit();
            },
          ),
          if (isSignIn) ...[
            const SizedBox(height: AuthSpacing.sm),
            Align(
              alignment: Alignment.centerRight,
              child: _AuthLinkButton(
                label: 'Forgot password?',
                onPressed: isSubmitting ? null : onPasswordReset,
              ),
            ),
          ],
          const SizedBox(height: AuthSpacing.lg),
          _AuthPrimaryButton(
            label: isSubmitting
                ? 'Please wait...'
                : isSignIn
                ? 'Sign In'
                : 'Create Account',
            busy: isSubmitting,
            onPressed: isConfigured && !isSubmitting ? onSubmit : null,
          ),
          if (onLocalEntry != null) ...[
            const SizedBox(height: AuthSpacing.lg),
            const _AuthDivider(label: 'Or preview'),
            const SizedBox(height: AuthSpacing.lg),
            _AuthOutlinedButton(
              label: 'Open local mode',
              icon: Icons.phone_android,
              onPressed: isSubmitting ? null : onLocalEntry,
            ),
          ],
          const SizedBox(height: AuthSpacing.lg),
          if (errorMessage != null) ...[
            _AuthNotice(
              message: errorMessage!,
              tone: _AuthNoticeTone.error,
              icon: Icons.error_outline,
            ),
            const SizedBox(height: AuthSpacing.md),
          ],
          if (message != null) ...[
            _AuthNotice(
              message: message!,
              tone: _AuthNoticeTone.success,
              icon: Icons.check_circle_outline,
            ),
            const SizedBox(height: AuthSpacing.md),
          ],
          _AuthNotice(
            message: isConfigured
                ? 'Secure login is connected.'
                : 'Add mobile credentials to enable secure login.',
            tone: isConfigured
                ? _AuthNoticeTone.success
                : _AuthNoticeTone.neutral,
            icon: isConfigured ? Icons.verified_user : Icons.key_off,
          ),
        ],
      ),
    );
  }
}

/// A small uppercase-ish field label above an input (web `Label`).
class _AuthFieldLabel extends StatelessWidget {
  const _AuthFieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: AuthTextStyles.label);
  }
}

/// Sign in / Sign up pill toggle (web tab control look).
class _AuthModeToggle extends StatelessWidget {
  const _AuthModeToggle({
    required this.mode,
    required this.enabled,
    required this.onModeChanged,
  });

  final AuthMode mode;
  final bool enabled;
  final ValueChanged<AuthMode> onModeChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AuthSpacing.xs),
      decoration: BoxDecoration(
        color: AuthColors.mutedSoft,
        borderRadius: AuthRadii.field,
        border: Border.all(color: AuthColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: _AuthModeSegment(
              label: 'Sign in',
              icon: Icons.login,
              selected: mode == AuthMode.signIn,
              onTap: enabled ? () => onModeChanged(AuthMode.signIn) : null,
            ),
          ),
          const SizedBox(width: AuthSpacing.xs),
          Expanded(
            child: _AuthModeSegment(
              label: 'Sign up',
              icon: Icons.person_add_alt_1,
              selected: mode == AuthMode.signUp,
              onTap: enabled ? () => onModeChanged(AuthMode.signUp) : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthModeSegment extends StatelessWidget {
  const _AuthModeSegment({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected
        ? AuthColors.primaryForeground
        : AuthColors.mutedForeground;
    return Material(
      color: selected ? AuthColors.primary : Colors.transparent,
      borderRadius: AuthRadii.field,
      child: InkWell(
        onTap: onTap,
        borderRadius: AuthRadii.field,
        child: Container(
          height: 40,
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: AuthSpacing.sm),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Branded text input with a leading icon (web icon-prefixed `Input`).
class _AuthTextField extends StatelessWidget {
  const _AuthTextField({
    required this.controller,
    required this.hintText,
    required this.icon,
    this.keyboardType,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String hintText;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      style: AuthTextStyles.field,
      cursorColor: AuthColors.primary,
      decoration: _authInputDecoration(
        hintText: hintText,
        prefixIcon: Icon(icon, size: 18, color: AuthColors.mutedForeground),
      ),
    );
  }
}

/// Branded password input with a show/hide eye toggle (web pattern).
class _AuthPasswordField extends StatefulWidget {
  const _AuthPasswordField({
    required this.controller,
    required this.hintText,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hintText;
  final TextInputAction? textInputAction;
  final VoidCallback? onSubmitted;

  @override
  State<_AuthPasswordField> createState() => _AuthPasswordFieldState();
}

class _AuthPasswordFieldState extends State<_AuthPasswordField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _obscured,
      textInputAction: widget.textInputAction,
      onSubmitted: (_) => widget.onSubmitted?.call(),
      style: AuthTextStyles.field,
      cursorColor: AuthColors.primary,
      decoration: _authInputDecoration(
        hintText: widget.hintText,
        prefixIcon: const Icon(
          Icons.lock_outline,
          size: 18,
          color: AuthColors.mutedForeground,
        ),
        suffixIcon: IconButton(
          onPressed: () => setState(() => _obscured = !_obscured),
          icon: Icon(
            _obscured ? Icons.visibility_off : Icons.visibility,
            size: 18,
            color: AuthColors.mutedForeground,
          ),
          tooltip: _obscured ? 'Show password' : 'Hide password',
          splashRadius: 18,
        ),
      ),
    );
  }
}

/// Shared input decoration for the branded auth fields.
InputDecoration _authInputDecoration({
  required String hintText,
  required Widget prefixIcon,
  Widget? suffixIcon,
}) {
  const border = OutlineInputBorder(
    borderRadius: AuthRadii.field,
    borderSide: BorderSide(color: AuthColors.border),
  );
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: AuthColors.input,
    hintText: hintText,
    hintStyle: const TextStyle(
      color: AuthColors.mutedForeground,
      fontSize: 15,
    ),
    prefixIcon: prefixIcon,
    suffixIcon: suffixIcon,
    contentPadding: const EdgeInsets.symmetric(
      horizontal: AuthSpacing.md,
      vertical: AuthSpacing.lg,
    ),
    border: border,
    enabledBorder: border,
    focusedBorder: const OutlineInputBorder(
      borderRadius: AuthRadii.field,
      borderSide: BorderSide(color: AuthColors.primary, width: 1.5),
    ),
  );
}

/// Full-width gradient primary button with brand glow + busy spinner.
class _AuthPrimaryButton extends StatelessWidget {
  const _AuthPrimaryButton({
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
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: AuthGradients.primary,
          borderRadius: AuthRadii.field,
          boxShadow: enabled ? AuthShadows.glow : null,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: AuthRadii.field,
            onTap: enabled ? onPressed : null,
            child: Container(
              height: AuthSpacing.buttonHeight,
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (busy) ...[
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AuthColors.primaryForeground,
                        ),
                      ),
                    ),
                    const SizedBox(width: AuthSpacing.sm),
                  ],
                  Text(label, style: AuthTextStyles.button),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Full-width neutral outlined button (local-mode entry).
class _AuthOutlinedButton extends StatelessWidget {
  const _AuthOutlinedButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AuthColors.mutedSoft,
          borderRadius: AuthRadii.field,
          border: Border.all(color: AuthColors.border),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: AuthRadii.field,
            onTap: onPressed,
            child: Container(
              height: AuthSpacing.buttonHeight,
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 18, color: AuthColors.foreground),
                  const SizedBox(width: AuthSpacing.sm),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AuthColors.foreground,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A tinted link-style text button (web `variant="link"`).
class _AuthLinkButton extends StatelessWidget {
  const _AuthLinkButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: AuthColors.primary,
        disabledForegroundColor: AuthColors.mutedForeground,
        padding: const EdgeInsets.symmetric(
          horizontal: AuthSpacing.sm,
          vertical: AuthSpacing.xs,
        ),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(label, style: AuthTextStyles.link),
    );
  }
}

/// 'Or continue with' style separator with centered caption.
class _AuthDivider extends StatelessWidget {
  const _AuthDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: AuthColors.border, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AuthSpacing.md),
          child: Text(label.toUpperCase(), style: AuthTextStyles.divider),
        ),
        const Expanded(child: Divider(color: AuthColors.border, height: 1)),
      ],
    );
  }
}

/// Visual tone for a status notice.
enum _AuthNoticeTone { neutral, success, error }

class _AuthNotice extends StatelessWidget {
  const _AuthNotice({
    required this.message,
    required this.tone,
    required this.icon,
  });

  final String message;
  final _AuthNoticeTone tone;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      _AuthNoticeTone.success => (AuthColors.onlineSoft, AuthColors.online),
      _AuthNoticeTone.error => (
        AuthColors.destructiveSoft,
        AuthColors.destructive,
      ),
      _AuthNoticeTone.neutral => (
        AuthColors.mutedSoft,
        AuthColors.mutedForeground,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AuthSpacing.md,
        vertical: AuthSpacing.md,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AuthRadii.field,
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: AuthSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AuthTextStyles.notice.copyWith(color: fg),
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordRecoveryScaffold extends StatelessWidget {
  const _PasswordRecoveryScaffold({
    required this.controller,
    required this.isSubmitting,
    required this.message,
    required this.errorMessage,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool isSubmitting;
  final String? message;
  final String? errorMessage;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AuthColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AuthSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                decoration: BoxDecoration(
                  color: AuthColors.card,
                  borderRadius: AuthRadii.card,
                  border: Border.all(color: AuthColors.border),
                  boxShadow: AuthShadows.card,
                ),
                padding: const EdgeInsets.all(AuthSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: AuthColors.primarySoft,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.lock_reset,
                        color: AuthColors.primary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(height: AuthSpacing.lg),
                    const Text(
                      'Reset password',
                      textAlign: TextAlign.center,
                      style: AuthTextStyles.headline,
                    ),
                    const SizedBox(height: AuthSpacing.xs),
                    const Text(
                      'Choose a new password to finish recovery.',
                      textAlign: TextAlign.center,
                      style: AuthTextStyles.subhead,
                    ),
                    const SizedBox(height: AuthSpacing.xl),
                    _AuthPasswordField(
                      controller: controller,
                      hintText: 'New password',
                      textInputAction: TextInputAction.done,
                      onSubmitted: () {
                        if (!isSubmitting) onSubmit();
                      },
                    ),
                    const SizedBox(height: AuthSpacing.lg),
                    _AuthPrimaryButton(
                      label: isSubmitting ? 'Saving...' : 'Update password',
                      busy: isSubmitting,
                      onPressed: isSubmitting ? null : onSubmit,
                    ),
                    if (errorMessage != null) ...[
                      const SizedBox(height: AuthSpacing.lg),
                      _AuthNotice(
                        message: errorMessage!,
                        tone: _AuthNoticeTone.error,
                        icon: Icons.error_outline,
                      ),
                    ],
                    if (message != null) ...[
                      const SizedBox(height: AuthSpacing.lg),
                      _AuthNotice(
                        message: message!,
                        tone: _AuthNoticeTone.success,
                        icon: Icons.check_circle_outline,
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
