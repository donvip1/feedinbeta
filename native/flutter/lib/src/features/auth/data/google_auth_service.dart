import 'package:google_sign_in/google_sign_in.dart';

/// Result of a successful native Google Sign-In.
///
/// Carries the tokens Supabase needs to establish a session via
/// `signInWithIdToken(provider: OAuthProvider.google, ...)`.
///
/// [idToken] is the OpenID Connect ID token that identifies the user and is
/// always required by Supabase. [accessToken] is the OAuth2 access token used
/// to call Google APIs; it is only populated when scopes are authorized and is
/// optional for a plain Supabase sign-in. [nonce] is the raw nonce passed to
/// Google (when configured) so the caller can forward it to Supabase for
/// `at_hash`/`nonce` validation.
class GoogleAuthTokens {
  const GoogleAuthTokens({
    required this.idToken,
    this.accessToken,
    this.nonce,
    this.email,
    this.displayName,
  });

  final String idToken;
  final String? accessToken;
  final String? nonce;
  final String? email;
  final String? displayName;
}

/// Thrown when the user dismisses / cancels the Google account chooser.
///
/// Callers should treat this as a benign, non-error outcome (no snackbar,
/// no crash) — it simply means the user backed out of the flow.
class GoogleSignInCancelledException implements Exception {
  const GoogleSignInCancelledException();

  @override
  String toString() => 'GoogleSignInCancelledException: user cancelled sign-in';
}

/// Thin, platform-agnostic wrapper around `google_sign_in` 7.x.
///
/// This performs the native Google account-chooser flow and returns the tokens
/// needed to complete a Supabase `signInWithIdToken` call. It is deliberately
/// decoupled from Supabase and from any UI so it can be unit-tested and reused
/// for both first sign-in and identity linking.
///
/// ## google_sign_in 7.x notes (do NOT downgrade the mental model to 6.x)
/// - There is a single [GoogleSignIn.instance] singleton.
/// - [GoogleSignIn.initialize] must be called exactly once before authenticating.
/// - [GoogleSignIn.authenticate] triggers the interactive chooser and returns a
///   [GoogleSignInAccount], or throws a [GoogleSignInException] (code
///   [GoogleSignInExceptionCode.canceled] when the user cancels).
/// - The ID token is read from `account.authentication.idToken`.
/// - The access token is NOT returned by `authenticate`; it must be requested
///   separately via `account.authorizationClient.authorizeScopes([...])`. For a
///   plain Supabase sign-in only the ID token is required, so the access token
///   is fetched best-effort and may be null.
///
/// ## EXTERNAL BLOCKER — OAuth client IDs (user must supply)
/// On Android, Supabase's "Sign in with Google" requires a Web OAuth client ID
/// registered as `serverClientId` here (so Google mints an ID token whose
/// audience matches what Supabase expects), plus an Android OAuth client with
/// the app's SHA-1 registered in the Google Cloud console. These IDs are an
/// external configuration blocker the user must provide. Wire the value through
/// the [serverClientId] constructor param (fed from config later). Until then a
/// null/empty value compiles and is runtime-ready; the native flow will only
/// succeed once a valid `serverClientId` is supplied.
class GoogleAuthService {
  GoogleAuthService({
    String? serverClientId,
    String? clientId,
    List<String> scopes = const <String>['email', 'profile'],
    GoogleSignIn? signIn,
  }) : _serverClientId = serverClientId,
       _clientId = clientId,
       _scopes = scopes,
       _signIn = signIn ?? GoogleSignIn.instance;

  final String? _serverClientId;
  final String? _clientId;
  final List<String> _scopes;
  final GoogleSignIn _signIn;

  bool _initialized = false;

  /// Whether the service has an OAuth client id to hand to Google.
  ///
  /// When false the native flow cannot mint a Supabase-compatible ID token;
  /// callers can surface a "not configured yet" state instead of launching the
  /// chooser. See the class doc for the external OAuth-client-id blocker.
  bool get hasClientId =>
      (_serverClientId != null && _serverClientId.isNotEmpty) ||
      (_clientId != null && _clientId.isNotEmpty);

  /// Lazily initializes the underlying [GoogleSignIn.instance].
  ///
  /// Safe to call repeatedly; the wrapped `initialize` is only invoked once.
  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await _signIn.initialize(
      clientId: _clientId,
      serverClientId: _serverClientId,
    );
    _initialized = true;
  }

  /// Triggers the Google account chooser and returns the resulting tokens.
  ///
  /// Returns the [GoogleAuthTokens] (with a non-null [GoogleAuthTokens.idToken])
  /// on success, or `null` when the user cancels the chooser. Any other failure
  /// (misconfiguration, network, etc.) is rethrown so the caller can surface it.
  ///
  /// The access token is fetched best-effort; it is `null` if the platform
  /// requires additional interaction or the scopes are not granted.
  Future<GoogleAuthTokens?> signIn() async {
    try {
      await _ensureInitialized();

      if (!_signIn.supportsAuthenticate()) {
        throw UnsupportedError(
          'Google sign-in via authenticate() is not supported on this platform.',
        );
      }

      final GoogleSignInAccount account = await _signIn.authenticate(
        scopeHint: _scopes,
      );

      final String? idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw StateError('Google did not return an ID token.');
      }

      final String? accessToken = await _tryGetAccessToken(account);

      return GoogleAuthTokens(
        idToken: idToken,
        accessToken: accessToken,
        email: account.email,
        displayName: account.displayName,
      );
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) {
        return null;
      }
      rethrow;
    }
  }

  /// Best-effort access-token fetch for [account].
  ///
  /// Returns null (instead of throwing) when authorization is unavailable
  /// without extra interaction — the ID token alone is enough for Supabase.
  Future<String?> _tryGetAccessToken(GoogleSignInAccount account) async {
    try {
      final GoogleSignInClientAuthorization? authz = await account
          .authorizationClient
          .authorizationForScopes(_scopes);
      return authz?.accessToken;
    } catch (_) {
      return null;
    }
  }

  /// Clears any cached Google sign-in state so the next [signIn] re-prompts.
  Future<void> signOut() async {
    if (!_initialized) return;
    await _signIn.signOut();
  }
}
