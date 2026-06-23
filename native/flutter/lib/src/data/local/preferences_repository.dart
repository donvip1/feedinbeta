import 'package:hive_ce/hive.dart';

import '../../features/settings/app_preferences.dart';
import 'local_record_decoder.dart';
import 'preferences_repository_contract.dart';

class PreferencesRepository implements PreferencesRepositoryContract {
  PreferencesRepository({required Box<Map> box}) : _box = box;

  static const _preferencesKey = 'app-preferences';

  final Box<Map> _box;

  @override
  Future<AppPreferences> load() async {
    final raw = _box.get(_preferencesKey);
    if (raw == null) return AppPreferences.defaults;
    return decodeLocalRecord(raw, AppPreferences.fromJson) ??
        AppPreferences.defaults;
  }

  @override
  Future<void> save(AppPreferences preferences) async {
    await _box.put(_preferencesKey, preferences.toJson());
  }

  @override
  Future<void> clear() async {
    await _box.delete(_preferencesKey);
  }
}
