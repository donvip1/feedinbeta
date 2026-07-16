import 'package:workmanager/workmanager.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/feedin_services.dart';
import '../bootstrap/feedin_bootstrap.dart';
import '../bootstrap/local_storage_bootstrap.dart';
import '../config/feedin_config.dart';

const feedinBackgroundSyncTask = 'feedin.backgroundSync';
const _feedinBackgroundSyncUniqueName = 'feedin-background-sync';

@pragma('vm:entry-point')
void feedinBackgroundDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != feedinBackgroundSyncTask) return true;
    try {
      const config = FeedinConfig.fromEnvironment;
      if (!config.hasSupabaseConfig) return true;

      await LocalStorageBootstrap().initialize();
      await FeedinBootstrap(config: config).initialize();
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) return true;

      final services = FeedinServices.create(config);
      final sync = services.incrementalMessageSyncService;
      if (sync == null) return true;
      await sync.start(userId);
      await sync.reconcile();
      await sync.drainOutbox();
      await sync.stop();
      return true;
    } catch (_) {
      // Returning false asks Workmanager to retry according to OS policy.
      return false;
    }
  });
}

class BackgroundSyncScheduler {
  const BackgroundSyncScheduler({required this.config});

  final FeedinConfig config;

  Future<void> initialize() async {
    await Workmanager().initialize(feedinBackgroundDispatcher);
  }

  Future<void> register() async {
    if (!config.hasSupabaseConfig) return;

    await Workmanager().registerPeriodicTask(
      _feedinBackgroundSyncUniqueName,
      feedinBackgroundSyncTask,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }
}
