import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/feedin_config.dart';
import '../../../core/security/secure_session_store.dart';
import 'auth_repository_contract.dart';

class AuthRepository implements AuthRepositoryContract {
  AuthRepository({
    required FeedinConfig config,
    required SecureSessionStore sessionStore,
  }) : _config = config,
       _sessionStore = sessionStore;

  final FeedinConfig _config;
  final SecureSessionStore _sessionStore;

  @override
  bool get isConfigured => _config.hasSupabaseConfig;

  User? get currentUser {
    if (!isConfigured) return null;
    return Supabase.instance.client.auth.currentUser;
  }

  @override
  Future<AuthUser?> restoreSession() async {
    if (!isConfigured) return null;

    final session = Supabase.instance.client.auth.currentSession;
    final user = session?.user ?? currentUser;
    if (session == null || user == null) return null;

    await _saveSession(session);

    return AuthUser.fromSupabaseUser(user);
  }

  @override
  Future<AuthUser> signInWithPassword({
    required String email,
    required String password,
  }) async {
    if (!isConfigured) {
      return const AuthUser.demo();
    }

    final response = await Supabase.instance.client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );

    final session = response.session;
    final user = response.user;

    if (session == null || user == null) {
      throw const AuthException('Unable to sign in.');
    }

    await _saveSession(session);

    return AuthUser.fromSupabaseUser(user);
  }

  @override
  Future<AuthUser?> signUpWithPassword({
    required String email,
    required String password,
  }) async {
    if (!isConfigured) {
      return const AuthUser.demo();
    }

    final response = await Supabase.instance.client.auth.signUp(
      email: email.trim(),
      password: password,
    );

    final session = response.session;
    final user = response.user;

    if (session != null) {
      await _saveSession(session);
    }

    return user == null ? null : AuthUser.fromSupabaseUser(user);
  }

  @override
  Future<void> sendPasswordReset({required String email}) async {
    if (!isConfigured) return;

    await Supabase.instance.client.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo: FeedinConfig.authCallbackUrl,
    );
  }

  @override
  Future<void> updatePassword({required String password}) async {
    if (!isConfigured) return;

    await Supabase.instance.client.auth.updateUser(
      UserAttributes(password: password),
    );
  }

  Future<void> _saveSession(Session session) async {
    final refreshToken = session.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return;

    await _sessionStore.saveSession(
      accessToken: session.accessToken,
      refreshToken: refreshToken,
    );
  }

  @override
  Future<void> signOut() async {
    await _sessionStore.clearSession();
    if (isConfigured) {
      await Supabase.instance.client.auth.signOut();
    }
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.displayName,
    required this.email,
    required this.isDemo,
  });

  const AuthUser.demo()
    : id = 'local-demo',
      displayName = 'FEEDIN Tester',
      email = null,
      isDemo = true;

  factory AuthUser.fromSupabaseUser(User user) {
    return AuthUser(
      id: user.id,
      displayName: user.email ?? 'FEEDIN User',
      email: user.email,
      isDemo: false,
    );
  }

  final String id;
  final String displayName;
  final String? email;
  final bool isDemo;
}
