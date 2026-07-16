import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'src/core/bootstrap/feedin_bootstrap.dart';
import 'src/core/bootstrap/local_storage_bootstrap.dart';
import 'src/core/config/feedin_config.dart';
import 'src/core/notifications/push_notification_service.dart';
import 'src/core/sync/background_sync_scheduler.dart';
import 'src/features/messages/chat/audio_backends_impl.dart';
import 'src/app/feedin_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Light up the in-chat voice-note recorder + audio/music playback bubbles by
  // registering the concrete record/just_audio backends into their seams.
  registerAudioBackends();

  const config = FeedinConfig.fromEnvironment;

  // Firebase Cloud Messaging. Guarded so a missing/failed config (e.g. no
  // google-services.json) never blocks app start; on Android this reads
  // android/app/google-services.json, so no firebase_options file is required.
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(feedinFirebaseBackgroundHandler);
  } catch (_) {
    // Firebase unavailable — the app still runs; push is simply inactive.
  }

  await LocalStorageBootstrap().initialize();
  await FeedinBootstrap(config: config).initialize();

  if (config.hasSupabaseConfig) {
    try {
      final scheduler = BackgroundSyncScheduler(config: config);
      await scheduler.initialize();
      await scheduler.register();
    } catch (_) {
      // Foreground connectivity/app-resume draining remains the reliable path
      // when the platform background scheduler is unavailable.
    }
  }

  runApp(const FeedinApp(config: config));
}
