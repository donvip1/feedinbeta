/// Plugin-agnostic seam over the OS permission APIs.
///
/// This file deliberately does **not** import `permission_handler` (or any
/// other plugin). It only declares:
///   * [AppPermission] — the small set of permissions feedIn onboards.
///   * [PermissionResult] — a normalized status independent of the plugin's
///     richer [PermissionStatus] taxonomy.
///   * [PermissionService] — the injectable interface.
///
/// The concrete, plugin-backed implementation lives in
/// `permission_handler_service.dart`. Keeping the interface here (free of any
/// platform channel) means the flow controller and its unit tests can depend on
/// this file alone and swap in a fake — no plugin, no Flutter binding required.
library;

/// The permissions feedIn requests during first-run onboarding.
///
/// Note that [microphone] and [camera] are distinct here, but the onboarding
/// flow presents them together on a single "Microphone & Camera" screen (see
/// [PermissionOnboardingStep]); the service still resolves each to its own OS
/// permission so results are tracked individually.
enum AppPermission {
  /// Alerts, sounds and badges (iOS `UNAuthorization*` / Android POST_NOTIFICATIONS).
  notifications,

  /// Microphone capture (voice notes, calls).
  microphone,

  /// Camera capture (video calls, posting).
  camera,

  /// The device address book.
  contacts,

  /// Photo library on iOS; on Android this resolves to READ_MEDIA_IMAGES
  /// (`Permission.photos`) on API 33+ and READ_EXTERNAL_STORAGE
  /// (`Permission.storage`) below — hence the combined name.
  photosOrStorage,
}

/// A normalized permission status, decoupled from the plugin's enum.
///
/// Both a fresh [PermissionService.request] and a passive
/// [PermissionService.status] return one of these so callers never need to
/// reason about plugin-specific values.
enum PermissionResult {
  /// Fully granted.
  granted,

  /// Granted with limits (e.g. iOS "Selected Photos"). Treated as usable.
  limited,

  /// Provisionally granted (e.g. iOS quiet notifications). Treated as usable.
  provisional,

  /// Denied this time, but the OS may still show a prompt if asked again.
  denied,

  /// Denied and the OS will no longer prompt — the user must go to Settings.
  permanentlyDenied,

  /// Blocked by device policy / parental controls. Not user-recoverable
  /// in-app, so it is surfaced like [permanentlyDenied].
  restricted,
}

extension PermissionResultX on PermissionResult {
  /// Whether the app effectively has access (full, limited or provisional).
  bool get isUsable =>
      this == PermissionResult.granted ||
      this == PermissionResult.limited ||
      this == PermissionResult.provisional;

  /// Whether re-requesting silently would be futile and the only recourse is
  /// deep-linking to the system settings screen.
  bool get requiresSettings =>
      this == PermissionResult.permanentlyDenied ||
      this == PermissionResult.restricted;
}

/// Injectable, mockable wrapper over the platform permission APIs.
///
/// Implemented for real by `PermissionHandlerService` and by fakes in tests.
abstract interface class PermissionService {
  /// Actively requests [permission], showing the system dialog when the OS
  /// allows it. Returns the resulting [PermissionResult]. Never throws — a
  /// platform failure resolves to [PermissionResult.denied].
  Future<PermissionResult> request(AppPermission permission);

  /// Reads the current status of [permission] without prompting.
  Future<PermissionResult> status(AppPermission permission);

  /// Opens the OS app-settings screen so the user can change a permission that
  /// can no longer be requested in-app. Returns whether the screen was opened.
  Future<bool> openSettings();
}
