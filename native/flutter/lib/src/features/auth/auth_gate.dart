import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;

import '../../app/feedin_services.dart';
import '../../core/permissions/onboarding_state.dart';
import '../../core/permissions/permission_handler_service.dart';
import '../feed/feed_shell.dart';
import '../onboarding/permission_onboarding_screen.dart';
import '../profile/profile_completion_screen.dart';
import '../profile/user_profile.dart';
import 'auth_theme.dart';
import 'data/auth_repository.dart';
import 'login_screen.dart';
import 'signup_screen.dart';
import 'widgets/auth_background.dart';
import 'widgets/auth_message.dart';
import 'widgets/auth_mode_switch.dart';
import 'widgets/brand_text_field.dart';
import 'widgets/google_auth_button.dart';
import 'widgets/primary_auth_button.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.services, this.onGoogleSignIn});

  final FeedinServices services;

  /// Injectable Google sign-in seam. `google_sign_in` is not wired yet, so when
  /// this is null the button falls back to [defaultGoogleSignInHandler] (a
  /// "coming soon" snackbar). Provide a real [GoogleSignInHandler] here later
  /// and the login/signup layout stays exactly the same.
  final GoogleSignInHandler? onGoogleSignIn;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final _displayNameController = TextEditingController();
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

  /// Whether the first-run permission onboarding still needs to be shown once
  /// the user is authenticated. Loaded once from [OnboardingState].
  bool _needsPermissionOnboarding = false;

  @override
  void initState() {
    super.initState();
    _listenForAuthChanges();
    _restoreSession();
    _loadOnboardingFlag();
  }

  Future<void> _loadOnboardingFlag() async {
    final seen = await OnboardingState.hasSeenOnboarding();
    if (!mounted) return;
    setState(() => _needsPermissionOnboarding = !seen);
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _newPasswordController.dispose();
    _authSubscription?.cancel();
    super.dispose();
  }

  void _listenForAuthChanges() {
    if (!widget.services.authRepository.isConfigured) return;

    _authSubscription = Supabase.instance.client.auth.onAuthStateChange.listen((
      data,
    ) {
      if (!mounted) return;

      if (data.event == AuthChangeEvent.passwordRecovery) {
        setState(() {
          _isRecoveringPassword = true;
          _message = 'Enter a new password to finish account recovery.';
          _errorMessage = null;
        });
        return;
      }

      // OAuth sign-in (Google) completes outside [_submit], so adopt the fresh
      // session here to advance past the auth screen. Password sign-in already
      // sets [_user] in [_submit]; the guard avoids clobbering an active session
      // on later token-refresh/signed-in events.
      if (data.event == AuthChangeEvent.signedIn && _user == null) {
        unawaited(_adoptSignedInSession());
      }
    });
  }

  /// Resolve the freshly signed-in Supabase session into our domain user +
  /// profile so the gate renders the app shell.
  Future<void> _adoptSignedInSession() async {
    final user = await widget.services.authRepository.restoreSession();
    if (user == null || !mounted) return;
    final profile = await widget.services.profileRepository.loadProfileForUser(
      user.id,
    );
    if (!mounted) return;
    setState(() {
      _user = user;
      _profile = profile;
      _isSubmitting = false;
      _errorMessage = null;
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

  void _switchMode(AuthMode mode) {
    if (_mode == mode) return;
    setState(() {
      _mode = mode;
      _message = null;
      _errorMessage = null;
    });
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
      final confirmation = widget.services.authRepository.isConfigured
          ? 'Password reset email sent if the account exists.'
          : 'Add Supabase keys before password reset can send email.';
      setState(() => _message = confirmation);
      _showSnack(confirmation);
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

  void _enterLocalMode() {
    setState(() {
      _user = const AuthUser.demo();
      _profile = null;
    });
  }

  void _showSnack(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(behavior: SnackBarBehavior.floating, content: Text(text)),
      );
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
        body: AuthBackground(
          child: Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AuthColors.onBrand),
            ),
          ),
        ),
      );
    }

    if (_isRecoveringPassword) {
      return _PasswordRecoveryScaffold(
        controller: _newPasswordController,
        isSubmitting: _isSubmitting,
        message: _message,
        errorMessage: _errorMessage,
        onSubmit: _updatePassword,
      );
    }

    final user = _user;

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

      // First-run permission onboarding, shown once after the profile exists and
      // before the app shell. Skipped on unconfigured/offline (demo) builds so
      // the local-preview path stays frictionless and the widget test is unaffected.
      if (_needsPermissionOnboarding &&
          widget.services.authRepository.isConfigured) {
        return PermissionOnboardingScreen(
          service: PermissionHandlerService(),
          onComplete: (result) async {
            await OnboardingState.markSeen(result);
            if (!mounted) return;
            setState(() => _needsPermissionOnboarding = false);
          },
        );
      }

      return FeedShell(
        displayName: profile.displayName,
        profile: profile,
        feedRepository: widget.services.feedRepository,
        messagesRepository: widget.services.messagesRepository,
        messagesRemoteDataSource: widget.services.messagesRemoteDataSource,
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
        localNotificationsService: widget.services.localNotificationsService,
        callKitService: widget.services.callKitService,
        connectivityService: widget.services.connectivityService,
        incrementalMessageSyncService:
            widget.services.incrementalMessageSyncService,
        onSignOut: _signOut,
      );
    }

    return _buildUnauthenticated();
  }

  Widget _buildUnauthenticated() {
    final isConfigured = widget.services.authRepository.isConfigured;
    final isSignIn = _mode == AuthMode.signIn;
    final handler = widget.onGoogleSignIn ?? defaultGoogleSignInHandler;
    void onGoogleSignIn() => handler(context);

    final Widget activeScreen = isSignIn
        ? LoginScreen(
            key: const ValueKey('login'),
            emailController: _emailController,
            passwordController: _passwordController,
            isConfigured: isConfigured,
            busy: _isSubmitting,
            errorMessage: _errorMessage,
            infoMessage: _message,
            onSubmit: _submit,
            onForgotPassword: _sendPasswordReset,
            onGoogleSignIn: onGoogleSignIn,
            onSwitchToSignUp: () => _switchMode(AuthMode.signUp),
          )
        : SignupScreen(
            key: const ValueKey('signup'),
            displayNameController: _displayNameController,
            emailController: _emailController,
            passwordController: _passwordController,
            isConfigured: isConfigured,
            busy: _isSubmitting,
            errorMessage: _errorMessage,
            infoMessage: _message,
            onSubmit: _submit,
            onGoogleSignIn: onGoogleSignIn,
            onSwitchToSignIn: () => _switchMode(AuthMode.signIn),
          );

    // Animated login/signup swap — a smooth slide+fade between the two forms.
    final Widget animatedForm = AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      layoutBuilder: (currentChild, previousChildren) => Stack(
        alignment: Alignment.topCenter,
        children: [...previousChildren, if (currentChild != null) currentChild],
      ),
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.035),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: activeScreen,
    );

    final offlineEntry = isConfigured
        ? null
        : _OfflineEntry(enabled: !_isSubmitting, onLocalEntry: _enterLocalMode);

    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              // Wide screens (tablet/desktop) get a two-panel split so the tall
              // form never runs off a short viewport; phones get one column.
              final isWide = constraints.maxWidth >= 720;
              return Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 20,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: isWide ? 940 : 440),
                    child: isWide
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: _BrandPanel(offlineEntry: offlineEntry),
                              ),
                              const SizedBox(width: 48),
                              Expanded(child: animatedForm),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const _BrandHeader(),
                              const SizedBox(height: AuthSpacing.lg),
                              animatedForm,
                              if (offlineEntry != null) ...[
                                const SizedBox(height: AuthSpacing.lg),
                                offlineEntry,
                              ],
                            ],
                          ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Wide-layout left panel: brand mark, tagline, and (offline builds only) the
/// local-mode entry — the marketing side of the split auth screen.
class _BrandPanel extends StatelessWidget {
  const _BrandPanel({required this.offlineEntry});

  final Widget? offlineEntry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const _BrandHeader(),
        const SizedBox(height: AuthSpacing.xxl),
        const Text(
          'Create, connect, and share\nwithout losing your flow.',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            height: 1.18,
            letterSpacing: -0.3,
            color: AuthColors.onBrand,
          ),
        ),
        const SizedBox(height: AuthSpacing.md),
        const Text(
          'Your feed, messages, and profile — all in one place.',
          style: AuthTextStyles.subheadOnBrand,
        ),
        if (offlineEntry != null) ...[
          const SizedBox(height: AuthSpacing.xxl),
          offlineEntry!,
        ],
      ],
    );
  }
}

/// Brand mark + wordmark that anchors the auth screens. Rendered once, above
/// the animated login/signup swap, so the brand never duplicates.
class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AuthColors.glassFillStrong,
            borderRadius: BorderRadius.circular(AuthRadii.md),
            border: Border.all(color: AuthColors.glassLine),
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.bolt, color: AuthColors.onBrand, size: 26),
        ),
        const SizedBox(width: AuthSpacing.md),
        const Text('feedIn', style: AuthTextStyles.brandOnGradient),
      ],
    );
  }
}

/// The offline preview entry. Only shown when secure login isn't configured;
/// keeps the exact "Open local mode" label the widget test taps.
class _OfflineEntry extends StatelessWidget {
  const _OfflineEntry({required this.enabled, required this.onLocalEntry});

  final bool enabled;
  final VoidCallback onLocalEntry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "Secure login isn't configured on this build.",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12.5,
            height: 1.3,
            color: AuthColors.onBrandFaint,
          ),
        ),
        const SizedBox(height: AuthSpacing.md),
        Opacity(
          opacity: enabled ? 1 : 0.6,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AuthColors.glassFill,
              borderRadius: BorderRadius.circular(AuthRadii.pill),
              border: Border.all(color: AuthColors.glassLineFaint),
            ),
            child: Material(
              type: MaterialType.transparency,
              child: InkWell(
                borderRadius: BorderRadius.circular(AuthRadii.pill),
                onTap: enabled ? onLocalEntry : null,
                child: SizedBox(
                  height: AuthSpacing.buttonHeight,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(
                        Icons.phone_android,
                        size: 18,
                        color: AuthColors.onBrand,
                      ),
                      SizedBox(width: AuthSpacing.sm),
                      Text(
                        'Open local mode',
                        style: AuthTextStyles.glassButton,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Minimal password-recovery step, floating over the brand gradient. Reached
/// only from a Supabase `passwordRecovery` deep link.
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
      body: AuthBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AuthColors.glassFillStrong,
                        shape: BoxShape.circle,
                        border: Border.all(color: AuthColors.glassLine),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.lock_reset,
                        color: AuthColors.onBrand,
                        size: 26,
                      ),
                    ),
                    const SizedBox(height: AuthSpacing.lg),
                    const Text(
                      'Reset password',
                      style: AuthTextStyles.headlineOnBrand,
                    ),
                    const SizedBox(height: AuthSpacing.sm),
                    const Text(
                      'Choose a new password to finish recovery.',
                      style: AuthTextStyles.subheadOnBrand,
                    ),
                    const SizedBox(height: AuthSpacing.xxl),
                    BrandTextField(
                      controller: controller,
                      label: 'New password',
                      hintText: 'At least 6 characters',
                      icon: Icons.lock_outline,
                      obscurable: true,
                      enabled: !isSubmitting,
                      textInputAction: TextInputAction.done,
                      onSubmitted: isSubmitting ? null : onSubmit,
                    ),
                    const SizedBox(height: AuthSpacing.xl),
                    PrimaryAuthButton(
                      label: 'Update Password',
                      busy: isSubmitting,
                      onPressed: isSubmitting ? null : onSubmit,
                    ),
                    if (errorMessage != null) ...[
                      const SizedBox(height: AuthSpacing.lg),
                      AuthMessage(
                        text: errorMessage!,
                        tone: AuthMessageTone.error,
                      ),
                    ],
                    if (message != null) ...[
                      const SizedBox(height: AuthSpacing.lg),
                      AuthMessage(text: message!, tone: AuthMessageTone.info),
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
