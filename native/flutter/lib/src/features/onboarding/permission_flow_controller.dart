import 'package:flutter/foundation.dart';

import '../../core/permissions/permission_service.dart';

/// The final outcome recorded for a single [AppPermission] during onboarding.
enum PermissionOutcome {
  /// The user allowed it (includes iOS limited/provisional grants).
  granted,

  /// The user declined, but the OS may prompt again later.
  denied,

  /// The user declined for good — only Settings can change it now.
  permanentlyDenied,

  /// The user tapped "Not now" without ever answering a system dialog.
  skipped,
}

/// Stable identifiers for the four onboarding screens, in presentation order.
enum OnboardingStepId { notifications, microphoneCamera, contacts, photos }

/// Pure-data description of one onboarding screen: which permission(s) it
/// requests plus the friendly copy explaining *why*. Icons are chosen by the
/// widget layer from [id], keeping this model free of any Flutter/UI type.
@immutable
class PermissionOnboardingStep {
  const PermissionOnboardingStep({
    required this.id,
    required this.permissions,
    required this.title,
    required this.rationale,
    this.allowLabel = 'Allow',
    this.skipLabel = 'Not now',
  });

  final OnboardingStepId id;

  /// One or more OS permissions requested together when the user taps Allow.
  /// The "Microphone & Camera" screen carries two; the rest carry one.
  final List<AppPermission> permissions;

  final String title;
  final String rationale;
  final String allowLabel;
  final String skipLabel;

  /// feedIn's default four-screen sequence, in the required order:
  /// notifications → microphone & camera → contacts → photos/storage.
  static List<PermissionOnboardingStep> defaults() => const [
        PermissionOnboardingStep(
          id: OnboardingStepId.notifications,
          permissions: [AppPermission.notifications],
          title: 'Stay in the loop',
          rationale:
              'Turn on notifications so you never miss a reply, a call, or '
              'when someone you follow goes live. Alerts, sounds and badges — '
              'you can fine-tune them anytime in Settings.',
        ),
        PermissionOnboardingStep(
          id: OnboardingStepId.microphoneCamera,
          permissions: [AppPermission.microphone, AppPermission.camera],
          title: 'Talk face to face',
          rationale:
              'feedIn needs your microphone and camera for voice notes, video '
              'calls and going live. Nothing is captured until you start a call '
              'or hit record.',
        ),
        PermissionOnboardingStep(
          id: OnboardingStepId.contacts,
          permissions: [AppPermission.contacts],
          title: 'Find your people',
          rationale:
              'Let feedIn check your contacts to suggest friends who are '
              'already here. We never upload your address book or message '
              'anyone without you.',
        ),
        PermissionOnboardingStep(
          id: OnboardingStepId.photos,
          permissions: [AppPermission.photosOrStorage],
          title: 'Share your moments',
          rationale:
              'Grant access to your photos so you can post pictures and set a '
              'profile picture. You pick exactly what to share, one post at a '
              'time.',
        ),
      ];
}

/// The immutable snapshot handed to the coordinator via `onComplete`.
///
/// It carries every permission's final [PermissionOutcome] plus convenience
/// accessors. The coordinator owns persistence (e.g. writing [toJson] to
/// storage) and app gating — this class never touches disk.
@immutable
class PermissionOnboardingResult {
  const PermissionOnboardingResult(Map<AppPermission, PermissionOutcome> outcomes)
      : _outcomes = outcomes;

  final Map<AppPermission, PermissionOutcome> _outcomes;

  /// The recorded outcome for [permission]; defaults to
  /// [PermissionOutcome.skipped] if it was somehow never reached.
  PermissionOutcome outcomeFor(AppPermission permission) =>
      _outcomes[permission] ?? PermissionOutcome.skipped;

  /// An unmodifiable view of every recorded outcome.
  Map<AppPermission, PermissionOutcome> get outcomes =>
      Map.unmodifiable(_outcomes);

  List<AppPermission> _where(PermissionOutcome outcome) => AppPermission.values
      .where((p) => outcomeFor(p) == outcome)
      .toList(growable: false);

  List<AppPermission> get granted => _where(PermissionOutcome.granted);
  List<AppPermission> get denied => _where(PermissionOutcome.denied);
  List<AppPermission> get permanentlyDenied =>
      _where(PermissionOutcome.permanentlyDenied);
  List<AppPermission> get skipped => _where(PermissionOutcome.skipped);

  /// True when every permission ended up granted.
  bool get isFullyGranted =>
      AppPermission.values.every((p) => outcomeFor(p) == PermissionOutcome.granted);

  /// True if anything is permanently denied and therefore only recoverable via
  /// the system settings screen.
  bool get hasPermanentlyDenied => permanentlyDenied.isNotEmpty;

  /// A JSON-friendly `{permissionName: outcomeName}` map for the coordinator to
  /// persist however it likes.
  Map<String, String> toJson() => {
        for (final p in AppPermission.values) p.name: outcomeFor(p).name,
      };

  @override
  String toString() => 'PermissionOnboardingResult(${toJson()})';
}

/// Drives the first-run permission onboarding: page position, per-permission
/// outcomes, request/skip logic, and completion.
///
/// A [ChangeNotifier] with no Flutter-widget dependencies, wired to a
/// [PermissionService] seam so it can be unit-tested against a fake. The screen
/// listens to it, mirrors [pageIndex] into its `PageView`, and invokes its
/// `onComplete` callback once [isComplete] flips true.
class PermissionFlowController extends ChangeNotifier {
  PermissionFlowController({
    required PermissionService service,
    List<PermissionOnboardingStep>? steps,
  })  : _service = service,
        _steps = List.unmodifiable(steps ?? PermissionOnboardingStep.defaults());

  final PermissionService _service;
  final List<PermissionOnboardingStep> _steps;

  final Map<AppPermission, PermissionOutcome> _outcomes = {};
  final Set<OnboardingStepId> _interacted = <OnboardingStepId>{};

  int _pageIndex = 0;
  int _maxUnlockedIndex = 0;
  bool _isRequesting = false;
  bool _isComplete = false;
  String? _errorMessage;
  bool _disposed = false;

  // ---- Read-only state ------------------------------------------------------

  List<PermissionOnboardingStep> get steps => _steps;

  /// Guard for the empty state: a flow configured with no steps.
  bool get isEmpty => _steps.isEmpty;

  int get pageIndex => _pageIndex;

  /// The step currently on screen, or null when [isEmpty].
  PermissionOnboardingStep? get currentStep =>
      isEmpty ? null : _steps[_pageIndex];

  /// The furthest page the user may reach by swiping. Grows only as pages are
  /// interacted with, enforcing "interact with each screen" without a global
  /// skip. Back-swiping to review earlier pages stays allowed.
  int get maxUnlockedIndex => _maxUnlockedIndex;

  bool get isLastPage => isEmpty || _pageIndex >= _steps.length - 1;

  /// A system request is in flight (drives the per-page loading state).
  bool get isRequesting => _isRequesting;

  bool get hasError => _errorMessage != null;
  String? get errorMessage => _errorMessage;

  bool get isComplete => _isComplete;

  /// 0.0–1.0 progress across the sequence, for a progress bar/dots.
  double get progress => isEmpty ? 1 : (_pageIndex + 1) / _steps.length;

  /// The recorded outcome for [permission], or null if not yet decided.
  PermissionOutcome? outcomeFor(AppPermission permission) =>
      _outcomes[permission];

  /// The aggregate outcome for [step]: the "worst" of its permissions, so a
  /// mixed mic-granted/camera-denied screen reads as denied. Null until any of
  /// the step's permissions has an outcome.
  PermissionOutcome? outcomeForStep(PermissionOnboardingStep step) {
    PermissionOutcome? worst;
    for (final p in step.permissions) {
      final o = _outcomes[p];
      if (o == null) continue;
      if (worst == null || o.index > worst.index) worst = o;
    }
    return worst;
  }

  /// Whether [step] has any permanently-denied permission — the signal for the
  /// UI to swap "Allow" for an "Open Settings" deep link instead of silently
  /// re-requesting (which the OS would ignore).
  bool stepNeedsSettings(PermissionOnboardingStep step) => step.permissions
      .any((p) => _outcomes[p] == PermissionOutcome.permanentlyDenied);

  /// Whether the user has already answered (allowed or skipped) [step].
  bool isInteracted(PermissionOnboardingStep step) =>
      _interacted.contains(step.id);

  /// The snapshot passed to `onComplete`. Any permission never reached is
  /// reported as [PermissionOutcome.skipped] via the result's own defaulting.
  PermissionOnboardingResult get result =>
      PermissionOnboardingResult(Map<AppPermission, PermissionOutcome>.from(_outcomes));

  // ---- Actions --------------------------------------------------------------

  /// Handles the primary "Allow" button: requests every permission for the
  /// current step **sequentially** (never firing all system dialogs at once),
  /// records each outcome, then advances — unless something is permanently
  /// denied, in which case it stays put so the Settings affordance can show.
  Future<void> requestCurrent() async {
    if (_isRequesting || _isComplete || isEmpty) return;
    final step = _steps[_pageIndex];

    _isRequesting = true;
    _errorMessage = null;
    _safeNotify();

    try {
      for (final permission in step.permissions) {
        final res = await _service.request(permission);
        _outcomes[permission] = _toOutcome(res);
      }
    } catch (error) {
      // The service contract says request() never throws, but stay defensive:
      // surface an error state and let the user retry rather than crash.
      _errorMessage =
          'Something went wrong while asking for permission. Please try again.';
      _isRequesting = false;
      _safeNotify();
      return;
    }

    _interacted.add(step.id);
    _isRequesting = false;

    if (stepNeedsSettings(step)) {
      // Remembered as permanently denied; the page now offers "Open Settings".
      _safeNotify();
      return;
    }
    _advance();
  }

  /// Handles the secondary "Not now" button: records [PermissionOutcome.skipped]
  /// for any of the step's permissions not already decided, marks the step
  /// interacted, and advances (or completes on the last page).
  void skipCurrent() {
    if (_isRequesting || _isComplete || isEmpty) return;
    final step = _steps[_pageIndex];
    for (final permission in step.permissions) {
      _outcomes.putIfAbsent(permission, () => PermissionOutcome.skipped);
    }
    _interacted.add(step.id);
    _advance();
  }

  /// Deep-links to the OS app-settings screen for a permanently-denied
  /// permission. Returns whether the screen opened. Does **not** re-request.
  Future<bool> openSettings() => _service.openSettings();

  /// Re-reads live statuses (e.g. after returning from Settings) and updates any
  /// permission that has since become granted, so the UI can reflect it.
  Future<void> refreshStatuses() async {
    if (isEmpty) return;
    var changed = false;
    for (final step in _steps) {
      for (final permission in step.permissions) {
        final res = await _service.status(permission);
        final mapped = _toOutcome(res);
        if (mapped == PermissionOutcome.granted &&
            _outcomes[permission] != PermissionOutcome.granted) {
          _outcomes[permission] = PermissionOutcome.granted;
          changed = true;
        }
      }
    }
    if (changed) _safeNotify();
  }

  /// Syncs the controller when the user swipes the `PageView`. Clamped to the
  /// unlocked range so forward-skipping past an un-answered page is impossible.
  void onPageChanged(int index) {
    if (_isComplete || isEmpty) return;
    final clamped = index.clamp(0, _maxUnlockedIndex);
    if (clamped == _pageIndex) return;
    _pageIndex = clamped;
    _safeNotify();
  }

  /// Clears a transient error so the user can retry the request.
  void clearError() {
    if (_errorMessage == null) return;
    _errorMessage = null;
    _safeNotify();
  }

  // ---- Internals ------------------------------------------------------------

  void _advance() {
    if (_pageIndex >= _steps.length - 1) {
      _complete();
      return;
    }
    _pageIndex += 1;
    if (_pageIndex > _maxUnlockedIndex) _maxUnlockedIndex = _pageIndex;
    _safeNotify();
  }

  void _complete() {
    if (_isComplete) return;
    _isComplete = true;
    _safeNotify();
  }

  PermissionOutcome _toOutcome(PermissionResult result) {
    switch (result) {
      case PermissionResult.granted:
      case PermissionResult.limited:
      case PermissionResult.provisional:
        return PermissionOutcome.granted;
      case PermissionResult.denied:
        return PermissionOutcome.denied;
      case PermissionResult.permanentlyDenied:
      case PermissionResult.restricted:
        return PermissionOutcome.permanentlyDenied;
    }
  }

  void _safeNotify() {
    if (_disposed) return;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
