import 'package:feedin/src/core/permissions/permission_service.dart';
import 'package:feedin/src/features/onboarding/permission_flow_controller.dart';
import 'package:flutter_test/flutter_test.dart';

/// A plugin-free [PermissionService] whose answers are scripted per
/// [AppPermission]. No platform channel, no Flutter binding — everything the
/// controller needs is exercised in pure Dart.
class FakePermissionService implements PermissionService {
  FakePermissionService({
    Map<AppPermission, PermissionResult>? requestResults,
    Map<AppPermission, PermissionResult>? statusResults,
    this.settingsOpens = true,
  })  : _requestResults = requestResults ?? {},
        _statusResults = statusResults ?? {};

  final Map<AppPermission, PermissionResult> _requestResults;
  final Map<AppPermission, PermissionResult> _statusResults;
  final bool settingsOpens;

  /// Records every request, in order, so tests can assert dialogs fire one at a
  /// time (and never all at once).
  final List<AppPermission> requested = [];
  int openSettingsCalls = 0;

  @override
  Future<PermissionResult> request(AppPermission permission) async {
    requested.add(permission);
    return _requestResults[permission] ?? PermissionResult.granted;
  }

  @override
  Future<PermissionResult> status(AppPermission permission) async {
    return _statusResults[permission] ??
        _requestResults[permission] ??
        PermissionResult.denied;
  }

  @override
  Future<bool> openSettings() async {
    openSettingsCalls++;
    return settingsOpens;
  }
}

void main() {
  group('PermissionFlowController', () {
    test('starts on the notifications page with default four steps', () {
      final controller =
          PermissionFlowController(service: FakePermissionService());
      addTearDown(controller.dispose);

      expect(controller.isEmpty, isFalse);
      expect(controller.steps, hasLength(4));
      expect(controller.pageIndex, 0);
      expect(controller.currentStep?.id, OnboardingStepId.notifications);
      expect(controller.steps[1].id, OnboardingStepId.microphoneCamera);
      expect(controller.steps[1].permissions,
          [AppPermission.microphone, AppPermission.camera]);
      expect(controller.steps[3].id, OnboardingStepId.photos);
      expect(controller.isComplete, isFalse);
      expect(controller.progress, closeTo(0.25, 1e-9));
    });

    test('advance-through-all: allowing every screen grants all and completes',
        () async {
      final service = FakePermissionService();
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      var completeNotifications = 0;
      controller.addListener(() {
        if (controller.isComplete) completeNotifications++;
      });

      await controller.requestCurrent(); // notifications
      expect(controller.pageIndex, 1);
      await controller.requestCurrent(); // mic + camera
      expect(controller.pageIndex, 2);
      await controller.requestCurrent(); // contacts
      expect(controller.pageIndex, 3);
      expect(controller.isComplete, isFalse);
      await controller.requestCurrent(); // photos -> completes

      expect(controller.isComplete, isTrue);
      expect(completeNotifications, greaterThanOrEqualTo(1));

      // One system dialog set at a time, never all at once: five requests in
      // the exact page order (mic before camera on screen 2).
      expect(service.requested, [
        AppPermission.notifications,
        AppPermission.microphone,
        AppPermission.camera,
        AppPermission.contacts,
        AppPermission.photosOrStorage,
      ]);

      final result = controller.result;
      expect(result.isFullyGranted, isTrue);
      expect(result.hasPermanentlyDenied, isFalse);
      expect(result.granted, hasLength(AppPermission.values.length));
      expect(result.outcomeFor(AppPermission.camera), PermissionOutcome.granted);
    });

    test('denial path: a denied permission is remembered and still advances',
        () async {
      final service = FakePermissionService(requestResults: {
        AppPermission.contacts: PermissionResult.denied,
      });
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      await controller.requestCurrent(); // notifications -> granted, advance
      await controller.requestCurrent(); // mic+camera -> granted, advance
      expect(controller.pageIndex, 2);

      await controller.requestCurrent(); // contacts -> denied
      // Denied (not permanent) still advances; the outcome is remembered.
      expect(controller.pageIndex, 3);
      expect(controller.outcomeFor(AppPermission.contacts),
          PermissionOutcome.denied);
      expect(controller.stepNeedsSettings(controller.steps[2]), isFalse);
    });

    test(
        'permanently-denied path: stays on the page, exposes settings, does not '
        'auto-advance', () async {
      final service = FakePermissionService(requestResults: {
        AppPermission.notifications: PermissionResult.permanentlyDenied,
      });
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      final notificationsStep = controller.steps[0];
      await controller.requestCurrent(); // notifications -> permanentlyDenied

      // Did NOT auto-advance; the settings affordance is now the way forward.
      expect(controller.pageIndex, 0);
      expect(controller.stepNeedsSettings(notificationsStep), isTrue);
      expect(controller.outcomeFor(AppPermission.notifications),
          PermissionOutcome.permanentlyDenied);

      // openSettings deep-links rather than silently re-requesting.
      final requestsBefore = service.requested.length;
      final opened = await controller.openSettings();
      expect(opened, isTrue);
      expect(service.openSettingsCalls, 1);
      expect(service.requested.length, requestsBefore,
          reason: 'openSettings must not re-request the permission');

      // "Not now" is still available to move on; the real outcome is kept.
      controller.skipCurrent();
      expect(controller.pageIndex, 1);
      expect(controller.outcomeFor(AppPermission.notifications),
          PermissionOutcome.permanentlyDenied);
    });

    test('restricted maps to permanentlyDenied and needs settings', () async {
      final service = FakePermissionService(requestResults: {
        AppPermission.notifications: PermissionResult.restricted,
      });
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      await controller.requestCurrent();
      expect(controller.outcomeFor(AppPermission.notifications),
          PermissionOutcome.permanentlyDenied);
      expect(controller.stepNeedsSettings(controller.steps[0]), isTrue);
      expect(controller.pageIndex, 0);
    });

    test('skipping every screen completes with all outcomes skipped', () async {
      final service = FakePermissionService();
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      controller.skipCurrent();
      controller.skipCurrent();
      controller.skipCurrent();
      expect(controller.isComplete, isFalse);
      controller.skipCurrent();

      expect(controller.isComplete, isTrue);
      // Never asked the OS for anything.
      expect(service.requested, isEmpty);
      final result = controller.result;
      expect(result.skipped, hasLength(AppPermission.values.length));
      expect(result.toJson()[AppPermission.notifications.name],
          PermissionOutcome.skipped.name);
    });

    test('limited/provisional results count as granted', () async {
      final service = FakePermissionService(requestResults: {
        AppPermission.notifications: PermissionResult.provisional,
        AppPermission.photosOrStorage: PermissionResult.limited,
      });
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      await controller.requestCurrent();
      expect(controller.outcomeFor(AppPermission.notifications),
          PermissionOutcome.granted);
    });

    test('unlock frontier grows only as pages are answered', () async {
      final service = FakePermissionService();
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      expect(controller.maxUnlockedIndex, 0);
      await controller.requestCurrent();
      expect(controller.maxUnlockedIndex, 1);

      // Cannot jump forward past the frontier via a swipe...
      controller.onPageChanged(3);
      expect(controller.pageIndex, 1);
      // ...but may swipe back to review an answered page.
      controller.onPageChanged(0);
      expect(controller.pageIndex, 0);
    });

    test('mixed mic/camera step aggregates to the worst outcome', () async {
      final service = FakePermissionService(requestResults: {
        AppPermission.microphone: PermissionResult.granted,
        AppPermission.camera: PermissionResult.permanentlyDenied,
      });
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      await controller.requestCurrent(); // notifications -> granted
      await controller.requestCurrent(); // mic granted, camera permanentlyDenied

      final micCamStep = controller.steps[1];
      expect(controller.outcomeFor(AppPermission.microphone),
          PermissionOutcome.granted);
      expect(controller.outcomeFor(AppPermission.camera),
          PermissionOutcome.permanentlyDenied);
      // Aggregate reads as the worst -> permanentlyDenied, so it needs settings
      // and does not auto-advance.
      expect(controller.outcomeForStep(micCamStep),
          PermissionOutcome.permanentlyDenied);
      expect(controller.stepNeedsSettings(micCamStep), isTrue);
      expect(controller.pageIndex, 1);
    });

    test('refreshStatuses upgrades a denied permission that became granted',
        () async {
      final service = FakePermissionService(
        requestResults: {AppPermission.notifications: PermissionResult.denied},
        statusResults: {AppPermission.notifications: PermissionResult.granted},
      );
      final controller = PermissionFlowController(service: service);
      addTearDown(controller.dispose);

      await controller.requestCurrent(); // notifications denied, advanced to 1
      expect(controller.outcomeFor(AppPermission.notifications),
          PermissionOutcome.denied);

      await controller.refreshStatuses(); // e.g. returned from Settings
      expect(controller.outcomeFor(AppPermission.notifications),
          PermissionOutcome.granted);
    });

    test('empty flow reports isEmpty and completes-ready result', () {
      final controller =
          PermissionFlowController(service: FakePermissionService(), steps: const []);
      addTearDown(controller.dispose);

      expect(controller.isEmpty, isTrue);
      expect(controller.currentStep, isNull);
      expect(controller.isLastPage, isTrue);
      expect(controller.progress, 1);
      // No-ops must not throw on an empty flow.
      controller.skipCurrent();
      expect(controller.result.skipped, hasLength(AppPermission.values.length));
    });
  });
}
