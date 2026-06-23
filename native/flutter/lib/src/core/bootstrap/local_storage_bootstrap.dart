import 'package:hive_ce_flutter/hive_flutter.dart';

import 'local_storage_migrations.dart';

class LocalStorageBootstrap {
  static const metadataBoxName = 'feedin.metadata';
  static const profileBoxName = 'feedin.profile';
  static const feedBoxName = 'feedin.feed';
  static const pendingActionsBoxName = 'feedin.pending_actions';
  static const conversationsBoxName = 'feedin.conversations';
  static const messagesBoxName = 'feedin.messages';
  static const postDraftsBoxName = 'feedin.post_drafts';
  static const uploadQueueBoxName = 'feedin.upload_queue';
  static const notificationsBoxName = 'feedin.notifications';
  static const preferencesBoxName = 'feedin.preferences';

  Future<void> initialize() async {
    await Hive.initFlutter();
    await openBoxes();
  }

  Future<void> initializeForTest(String path) async {
    Hive.init(path);
    await openBoxes();
  }

  Future<void> openBoxes() async {
    await Future.wait([
      Hive.openBox<Map>(metadataBoxName),
      Hive.openBox<Map>(profileBoxName),
      Hive.openBox<Map>(feedBoxName),
      Hive.openBox<Map>(pendingActionsBoxName),
      Hive.openBox<Map>(conversationsBoxName),
      Hive.openBox<Map>(messagesBoxName),
      Hive.openBox<Map>(postDraftsBoxName),
      Hive.openBox<Map>(uploadQueueBoxName),
      Hive.openBox<Map>(notificationsBoxName),
      Hive.openBox<Map>(preferencesBoxName),
    ]);
    await const LocalStorageMigrations().run();
  }
}
