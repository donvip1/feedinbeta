class FeedinConfig {
  const FeedinConfig({
    required this.supabaseUrl,
    required this.supabasePublishableKey,
    this.googleServerClientId = '',
  });

  static const fromEnvironment = FeedinConfig(
    supabaseUrl: String.fromEnvironment('FEEDIN_SUPABASE_URL'),
    supabasePublishableKey: String.fromEnvironment(
      'FEEDIN_SUPABASE_PUBLISHABLE_KEY',
      defaultValue: String.fromEnvironment('FEEDIN_SUPABASE_ANON_KEY'),
    ),
    googleServerClientId: String.fromEnvironment(
      'GOOGLE_SERVER_CLIENT_ID',
      defaultValue: '',
    ),
  );

  final String supabaseUrl;
  final String supabasePublishableKey;

  /// The Web OAuth client ID that Supabase's "Sign in with Google" needs as the
  /// `serverClientId` so Google mints an ID token whose audience matches what
  /// Supabase expects. Empty by default — an external configuration blocker the
  /// user supplies later; until then the native Google flow stays inert.
  final String googleServerClientId;

  static const authCallbackUrl = 'feedin://auth-callback';

  bool get hasSupabaseConfig =>
      supabaseUrl.trim().isNotEmpty && supabasePublishableKey.trim().isNotEmpty;
}
