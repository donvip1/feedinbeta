import 'package:hive_ce/hive.dart';
import 'package:uuid/uuid.dart';

import 'pending_action.dart';

class PendingActionRepository {
  PendingActionRepository({required Box<Map> box}) : _box = box;

  final Box<Map> _box;

  Future<List<PendingAction>> loadPendingActions() async {
    final actions =
        _box.values
            .map(
              (value) =>
                  PendingAction.fromJson(Map<String, Object?>.from(value)),
            )
            .toList()
          ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));

    return actions;
  }

  Future<void> queueAction({
    required PendingActionType type,
    required Map<String, Object?> payload,
  }) async {
    final action = PendingAction(
      id: const Uuid().v4(),
      type: type,
      payload: payload,
      createdAtMillis: DateTime.now().millisecondsSinceEpoch,
    );

    await _box.put(action.id, action.toJson());
  }

  Future<int> count() async => _box.length;

  Future<void> deleteAction(String id) async {
    await _box.delete(id);
  }

  Future<void> incrementRetry(String id) async {
    final raw = _box.get(id);
    if (raw == null) return;

    final action = PendingAction.fromJson(Map<String, Object?>.from(raw));
    await _box.put(
      id,
      action.copyWith(retryCount: action.retryCount + 1).toJson(),
    );
  }
}
