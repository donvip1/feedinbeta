import 'package:shared_preferences/shared_preferences.dart';

import '../../features/onboarding/permission_flow_controller.dart';

/// Tiny persistence for whether the first-run permission onboarding has been
/// shown, plus a snapshot of the outcomes. Self-contained (shared_preferences)
/// so it does not disturb the main Hive-backed [AppPreferences] model.
///
/// The auth gate reads [hasSeenOnboarding] once the user is authenticated and,
/// if false, presents the onboarding before the app shell; [markSeen] records
/// completion (and the per-permission results, for later reference/debugging).
class OnboardingState {
  const OnboardingState._();

  static const _seenKey = 'feedin.onboarding.permissions.seen.v1';
  static const _resultKey = 'feedin.onboarding.permissions.result.v1';

  static Future<bool> hasSeenOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_seenKey) ?? false;
  }

  static Future<void> markSeen(PermissionOnboardingResult result) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_seenKey, true);
    // Persist a compact {permission: outcome} map for later inspection.
    final json = result.toJson();
    await prefs.setStringList(
      _resultKey,
      json.entries.map((e) => '${e.key}=${e.value}').toList(),
    );
  }

  /// Test/support hook: clears the flag so onboarding shows again next launch.
  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_seenKey);
    await prefs.remove(_resultKey);
  }
}
