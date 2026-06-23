import 'package:workmanager/workmanager.dart';

import '../config/feedin_config.dart';

const feedinBackgroundSyncTask = 'feedin.backgroundSync';
const _feedinBackgroundSyncUniqueName = 'feedin-background-sync';

@pragma('vm:entry-point')
void feedinBackgroundDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    return task == feedinBackgroundSyncTask;
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
