import 'package:flutter/material.dart';

import 'src/core/bootstrap/feedin_bootstrap.dart';
import 'src/core/bootstrap/local_storage_bootstrap.dart';
import 'src/core/config/feedin_config.dart';
import 'src/core/sync/background_sync_scheduler.dart';
import 'src/app/feedin_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const config = FeedinConfig.fromEnvironment;
  await LocalStorageBootstrap().initialize();
  await FeedinBootstrap(config: config).initialize();
  final backgroundSyncScheduler = BackgroundSyncScheduler(config: config);
  await backgroundSyncScheduler.initialize();
  await backgroundSyncScheduler.register();

  runApp(const FeedinApp(config: config));
}
