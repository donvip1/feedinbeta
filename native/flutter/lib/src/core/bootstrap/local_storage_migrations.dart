import 'package:hive_ce/hive.dart';

import '../../data/local/local_record_decoder.dart';
import '../../data/local/pending_action.dart';
import '../../data/local/upload_queue_repository.dart';
import '../../features/create/post_draft.dart';
import '../../features/feed/feed_post.dart';
import '../../features/messages/message_models.dart';
import '../../features/notifications/notification_item.dart';
import '../../features/profile/user_profile.dart';
import '../../features/settings/app_preferences.dart';
import 'local_storage_bootstrap.dart';

class LocalStorageMigrations {
  const LocalStorageMigrations();

  static const currentSchemaVersion = 1;
  static const _schemaKey = 'schema-version';

  Future<void> run() async {
    final metadataBox = Hive.box<Map>(LocalStorageBootstrap.metadataBoxName);
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.profileBoxName),
      UserProfile.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.feedBoxName),
      FeedPost.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.pendingActionsBoxName),
      PendingAction.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.conversationsBoxName),
      ConversationSummary.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.messagesBoxName),
      LocalMessage.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.postDraftsBoxName),
      PostDraft.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.uploadQueueBoxName),
      UploadQueueItem.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.notificationsBoxName),
      NotificationItem.fromJson,
    );
    await _removeMalformedRecords(
      Hive.box<Map>(LocalStorageBootstrap.preferencesBoxName),
      AppPreferences.fromJson,
    );
    await metadataBox.put(_schemaKey, {'version': currentSchemaVersion});
  }

  Future<void> _removeMalformedRecords<T>(
    Box<Map> box,
    JsonFactory<T> factory,
  ) async {
    final keysToDelete = <Object>[];
    for (final key in box.keys) {
      final decoded = decodeLocalRecord(box.get(key), factory);
      if (decoded == null) keysToDelete.add(key);
    }

    for (final key in keysToDelete) {
      await box.delete(key);
    }
  }
}
