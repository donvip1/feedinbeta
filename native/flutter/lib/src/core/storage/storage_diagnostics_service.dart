import 'package:supabase_flutter/supabase_flutter.dart';

class StorageDiagnosticsService {
  const StorageDiagnosticsService({required this.isConfigured});

  final bool isConfigured;

  Future<StorageDiagnosticsSummary> checkPostMedia() async {
    if (!isConfigured) {
      return const StorageDiagnosticsSummary(
        attempted: false,
        canListOwnPrefix: false,
        publicUrlGenerated: false,
        message: 'Supabase is not configured.',
      );
    }

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      return const StorageDiagnosticsSummary(
        attempted: false,
        canListOwnPrefix: false,
        publicUrlGenerated: false,
        message: 'Sign in before checking storage.',
      );
    }

    try {
      await client.storage.from('post-media').list(path: userId);
      final publicUrl = client.storage
          .from('post-media')
          .getPublicUrl('$userId/diagnostic.txt');

      return StorageDiagnosticsSummary(
        attempted: true,
        canListOwnPrefix: true,
        publicUrlGenerated: publicUrl.isNotEmpty,
        message: 'post-media storage is reachable for this session.',
      );
    } catch (error) {
      return StorageDiagnosticsSummary(
        attempted: true,
        canListOwnPrefix: false,
        publicUrlGenerated: false,
        message: 'post-media check failed: ${error.toString()}',
      );
    }
  }
}

class StorageDiagnosticsSummary {
  const StorageDiagnosticsSummary({
    required this.attempted,
    required this.canListOwnPrefix,
    required this.publicUrlGenerated,
    required this.message,
  });

  final bool attempted;
  final bool canListOwnPrefix;
  final bool publicUrlGenerated;
  final String message;
}
