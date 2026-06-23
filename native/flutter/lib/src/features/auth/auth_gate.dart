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

      final profile = await widget.services.profileRepository.loadProfileForUser(
        user.id,
      );

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
          onComplete: (completedProfile) async {
            try {
              await widget.services.profileRepository.syncProfile(
                completedProfile,
              );
            } catch (_) {
              await widget.services.profileRepository.saveCurrentProfile(
                completedProfile,
              );
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
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'FEEDIN',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Flutter cross-platform rebuild',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
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
                    selected: {_mode},
                    onSelectionChanged: _isSubmitting
                        ? null
                        : (selection) {
                            setState(() {
                              _mode = selection.first;
                              _message = null;
                              _errorMessage = null;
                            });
                          },
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) {
                      if (isConfigured && !_isSubmitting) _submit();
                    },
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: isConfigured && !_isSubmitting ? _submit : null,
                    child: Text(
                      _isSubmitting
                          ? 'Please wait...'
                          : isSignIn
                          ? 'Sign in'
                          : 'Create account',
                    ),
                  ),
                  if (isSignIn) ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => _sendPasswordReset(),
                      child: const Text('Reset password'),
                    ),
                  ],
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: _isSubmitting
                        ? null
                        : () => setState(() {
                            _user = const AuthUser.demo();
                            _profile = null;
                          }),
                    child: const Text('Enter demo shell'),
                  ),
                  const SizedBox(height: 12),
                  if (_errorMessage != null) ...[
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (_message != null) ...[
                    Text(
                      _message!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Text(
                    isConfigured
                        ? 'Supabase is configured. Use a FEEDIN account or enter the demo shell.'
                        : 'Supabase is not configured yet. Demo shell remains available while keys are added.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
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
                    style: Theme.of(context).textTheme.headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
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
