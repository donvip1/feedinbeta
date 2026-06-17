import 'auth_repository.dart';

abstract interface class AuthRepositoryContract {
  bool get isConfigured;
  Future<AuthUser?> restoreSession();
  Future<AuthUser> signInWithPassword({
    required String email,
    required String password,
  });
  Future<AuthUser?> signUpWithPassword({
    required String email,
    required String password,
  });
  Future<void> sendPasswordReset({required String email});
  Future<void> updatePassword({required String password});
  Future<void> signOut();
}
