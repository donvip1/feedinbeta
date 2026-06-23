import 'package:hive_ce/hive.dart';

import 'local_record_decoder.dart';

class UploadQueueRepository {
  UploadQueueRepository({required Box<Map> box}) : _box = box;

  final Box<Map> _box;

  Future<void> enqueueDraft(String draftId) async {
    await _box.put(draftId, {
      'draftId': draftId,
      'createdAtMillis': DateTime.now().millisecondsSinceEpoch,
      'retryCount': 0,
    });
  }

  Future<List<UploadQueueItem>> loadQueuedItems() async {
    final items =
        _box.values
            .map((value) => decodeLocalRecord(value, UploadQueueItem.fromJson))
            .whereType<UploadQueueItem>()
            .toList()
          ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));
    return items;
  }

  Future<void> remove(String draftId) async {
    await _box.delete(draftId);
  }

  Future<int> count() async => _box.length;
}

class UploadQueueItem {
  const UploadQueueItem({
    required this.draftId,
    required this.createdAtMillis,
    required this.retryCount,
  });

  final String draftId;
  final int createdAtMillis;
  final int retryCount;

  factory UploadQueueItem.fromJson(Map<String, Object?> json) {
    return UploadQueueItem(
      draftId: json['draftId'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
      retryCount: json['retryCount'] as int? ?? 0,
    );
  }
}
