import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/feedin_config.dart';

class FeedinBootstrap {
  const FeedinBootstrap({required this.config});

  final FeedinConfig config;

  Future<void> initialize() async {
    if (!config.hasSupabaseConfig) return;

    await Supabase.initialize(
      url: config.supabaseUrl,
      publishableKey: config.supabasePublishableKey,
    );
  }
}
