import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;

import 'auth_repository.dart';

abstract interface class AuthRepositoryContract {
  bool get isConfigured;
  Future<AuthUser?> restoreSession();
  Future<AuthUser> signInWithPassword({
    required String email,
    required String password,
  });

  /// Sign in with either an email or a username plus [password]. A value that
  /// looks like an email is used directly; otherwise it is resolved to the
  /// owning account's email via the `get_user_email_by_username` RPC (web
  /// parity) before delegating to [signInWithPassword].
  Future<AuthUser> signInWithIdentifier({
    required String identifier,
    required String password,
  });
  Future<AuthUser?> signUpWithPassword({
    required String email,
    required String password,
  });
  Future<void> sendPasswordReset({required String email});
  Future<void> updatePassword({required String password});
  Future<void> signOut();

  /// Completes a native Google sign-in by exchanging the Google [idToken]
  /// (and optional [accessToken]) for a Supabase session.
  ///
  /// Returns [AuthUser.demo] when Supabase is not configured (offline mode).
  Future<AuthUser> signInWithGoogle({
    required String idToken,
    String? accessToken,
  });

  /// Links a Google identity to the currently signed-in Supabase user.
  ///
  /// No-op when Supabase is not configured.
  Future<void> linkGoogleIdentity();

  /// Unlinks the given [identity] from the current user.
  ///
  /// No-op when Supabase is not configured.
  Future<void> unlinkIdentity(UserIdentity identity);

  /// Returns the identities (email/password, google, ...) linked to the
  /// current user, or an empty list when Supabase is not configured.
  Future<List<UserIdentity>> listIdentities();
}
