import '../../features/settings/app_preferences.dart';

abstract interface class PreferencesRepositoryContract {
  Future<AppPreferences> load();
  Future<void> save(AppPreferences preferences);
  Future<void> clear();
}
