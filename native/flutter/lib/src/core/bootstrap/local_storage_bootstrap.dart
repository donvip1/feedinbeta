import 'package:hive_ce_flutter/hive_flutter.dart';

class LocalStorageBootstrap {
  static const profileBoxName = 'feedin.profile';
  static const feedBoxName = 'feedin.feed';
  static const pendingActionsBoxName = 'feedin.pending_actions';
  static const conversationsBoxName = 'feedin.conversations';
  static const messagesBoxName = 'feedin.messages';

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
      Hive.openBox<Map>(profileBoxName),
      Hive.openBox<Map>(feedBoxName),
      Hive.openBox<Map>(pendingActionsBoxName),
      Hive.openBox<Map>(conversationsBoxName),
      Hive.openBox<Map>(messagesBoxName),
    ]);
  }
}
