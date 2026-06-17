class FeedinConfig {
  const FeedinConfig({
    required this.supabaseUrl,
    required this.supabasePublishableKey,
  });

  static const fromEnvironment = FeedinConfig(
    supabaseUrl: String.fromEnvironment('FEEDIN_SUPABASE_URL'),
    supabasePublishableKey: String.fromEnvironment(
      'FEEDIN_SUPABASE_PUBLISHABLE_KEY',
      defaultValue: String.fromEnvironment('FEEDIN_SUPABASE_ANON_KEY'),
    ),
  );

  final String supabaseUrl;
  final String supabasePublishableKey;

  static const authCallbackUrl = 'feedin://auth-callback';

  bool get hasSupabaseConfig =>
      supabaseUrl.trim().isNotEmpty && supabasePublishableKey.trim().isNotEmpty;
}
