import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;

import '../../app/feedin_services.dart';
import '../feed/feed_shell.dart';
import '../profile/profile_completion_screen.dart';
import '../profile/user_profile.dart';
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
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
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
        onSignOut: _signOut,
      );
    }

    final isConfigured = widget.services.authRepository.isConfigured;
    final isSignIn = _mode == AuthMode.signIn;

    return Scaffold(
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
        Text(
          'feedIn',
          style: Theme.of(context).textTheme.displaySmall?.copyWith(
            fontWeight: FontWeight.w900,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Create, connect, and share without losing your flow.',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 10,
          runSpacing: 10,
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
    return Chip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      visualDensity: VisualDensity.compact,
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              isSignIn ? 'Welcome back' : 'Create your account',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              isSignIn
                  ? 'Sign in to continue your feed, messages, and profile.'
                  : 'Start with your email and finish your profile next.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 18),
            SegmentedButton<AuthMode>(
              segments: const [
                ButtonSegment(
                  value: AuthMode.signIn,
                  label: Text('Sign in'),
                  icon: Icon(Icons.login),
                ),
                ButtonSegment(
                  value: AuthMode.signUp,
                  label: Text('Sign up'),
                  icon: Icon(Icons.person_add),
                ),
              ],
              selected: {mode},
              onSelectionChanged: isSubmitting
                  ? null
                  : (selection) => onModeChanged(selection.first),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.alternate_email),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: passwordController,
              obscureText: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) {
                if (isConfigured && !isSubmitting) onSubmit();
              },
              decoration: const InputDecoration(
                labelText: 'Password',
                prefixIcon: Icon(Icons.lock_outline),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: isConfigured && !isSubmitting ? onSubmit : null,
              child: Text(
                isSubmitting
                    ? 'Please wait...'
                    : isSignIn
                    ? 'Sign in'
                    : 'Create account',
              ),
            ),
            if (isSignIn) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: isSubmitting ? null : onPasswordReset,
                child: const Text('Reset password'),
              ),
            ],
            if (onLocalEntry != null) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: isSubmitting ? null : onLocalEntry,
                icon: const Icon(Icons.phone_android),
                label: const Text('Open local mode'),
              ),
            ],
            const SizedBox(height: 12),
            if (errorMessage != null) ...[
              _AuthNotice(
                message: errorMessage!,
                color: Theme.of(context).colorScheme.error,
                icon: Icons.error_outline,
              ),
              const SizedBox(height: 12),
            ],
            if (message != null) ...[
              _AuthNotice(
                message: message!,
                color: Theme.of(context).colorScheme.primary,
                icon: Icons.check_circle_outline,
              ),
              const SizedBox(height: 12),
            ],
            _AuthNotice(
              message: isConfigured
                  ? 'Secure login is connected.'
                  : 'Add mobile credentials to enable secure login.',
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              icon: isConfigured ? Icons.verified_user : Icons.key_off,
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthNotice extends StatelessWidget {
  const _AuthNotice({
    required this.message,
    required this.color,
    required this.icon,
  });

  final String message;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: color),
          ),
        ),
      ],
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Reset password',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: controller,
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) {
                      if (!isSubmitting) onSubmit();
                    },
                    decoration: const InputDecoration(
                      labelText: 'New password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: isSubmitting ? null : onSubmit,
                    child: Text(isSubmitting ? 'Saving...' : 'Update password'),
                  ),
                  if (errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      errorMessage!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  if (message != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      message!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
