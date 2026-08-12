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

  /// How long a session survives without the app being opened. Each successful
  /// restore/sign-in slides this window forward (see [restoreSession]), so a
  /// user is only logged out after 7 full days of not using the app.
  static const sessionMaxIdle = Duration(days: 7);

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

    // App-level inactivity cap layered over Supabase's own token refresh: if the
    // app hasn't been opened within [sessionMaxIdle], force a sign-out so the
    // user re-authenticates. A missing timestamp (legacy session) is treated as
    // active and stamped now rather than logging the user out on upgrade.
    final lastActive = await _sessionStore.readLastActive();
    if (lastActive != null &&
        DateTime.now().difference(lastActive) > sessionMaxIdle) {
      await signOut();
      return null;
    }

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

  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  @override
  Future<AuthUser> signInWithIdentifier({
    required String identifier,
    required String password,
  }) async {
    if (!isConfigured) {
      return const AuthUser.demo();
    }

    final trimmed = identifier.trim();
    if (_emailPattern.hasMatch(trimmed)) {
      return signInWithPassword(email: trimmed, password: password);
    }

    // Username path: resolve to the account's email via the server-side
    // SECURITY DEFINER RPC (mirrors the web app's SignInForm), then sign in.
    // A generic error keeps username enumeration and wrong-password
    // indistinguishable.
    final email = await Supabase.instance.client.rpc(
      'get_user_email_by_username',
      params: {'p_username': trimmed},
    );

    if (email is! String || email.isEmpty) {
      throw const AuthException('Invalid username or password.');
    }

    return signInWithPassword(email: email, password: password);
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

    if (session == null || user == null) {
      return null;
    }

    await _saveSession(session);

    return AuthUser.fromSupabaseUser(user);
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

  @override
  Future<AuthUser> signInWithGoogle({
    required String idToken,
    String? accessToken,
  }) async {
    if (!isConfigured) {
      return const AuthUser.demo();
    }

    final response = await Supabase.instance.client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      accessToken: accessToken,
    );

    final session = response.session;
    final user = response.user;

    if (session == null || user == null) {
      throw const AuthException('Unable to sign in with Google.');
    }

    await _saveSession(session);

    return AuthUser.fromSupabaseUser(user);
  }

  @override
  Future<void> linkGoogleIdentity() async {
    if (!isConfigured) return;

    await Supabase.instance.client.auth.linkIdentity(OAuthProvider.google);
  }

  @override
  Future<void> unlinkIdentity(UserIdentity identity) async {
    if (!isConfigured) return;

    await Supabase.instance.client.auth.unlinkIdentity(identity);
  }

  @override
  Future<List<UserIdentity>> listIdentities() async {
    if (!isConfigured) return const [];

    return Supabase.instance.client.auth.getUserIdentities();
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
      displayName = 'feedIn Tester',
      email = null,
      isDemo = true;

  factory AuthUser.fromSupabaseUser(User user) {
    return AuthUser(
      id: user.id,
      displayName: user.email ?? 'feedIn User',
      email: user.email,
      isDemo: false,
    );
  }

  final String id;
  final String displayName;
  final String? email;
  final bool isDemo;
}
