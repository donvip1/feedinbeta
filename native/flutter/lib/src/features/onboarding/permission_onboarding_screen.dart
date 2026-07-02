import 'package:flutter/material.dart';

import '../../core/permissions/permission_service.dart';
import 'permission_flow_controller.dart';
import 'widgets/onboarding_progress_dots.dart';
import 'widgets/permission_page_card.dart';

/// First-run permission onboarding: a four-screen, sequential `PageView` that
/// explains and requests notifications, microphone & camera, contacts and
/// photos/storage — one system dialog set at a time.
///
/// Self-contained and persistence-free: it builds its own
/// [PermissionFlowController] over the injected [service] and, when every
/// screen has been answered, hands the collected [PermissionOnboardingResult]
/// to [onComplete]. The coordinator wires this widget into the app flow and
/// owns persisting/gating on that result.
///
/// ```dart
/// PermissionOnboardingScreen(
///   service: PermissionHandlerService(),
///   onComplete: (result) async {
///     await coordinator.persistOnboarding(result); // e.g. result.toJson()
///     coordinator.markFirstRunDone();
///   },
/// )
/// ```
class PermissionOnboardingScreen extends StatefulWidget {
  const PermissionOnboardingScreen({
    super.key,
    required this.service,
    required this.onComplete,
    this.steps,
  });

  /// The (mockable) permission seam. Pass `PermissionHandlerService()` in prod.
  final PermissionService service;

  /// Invoked exactly once when the user has answered every screen. The result
  /// carries each permission's final outcome; the caller persists/gates on it.
  final ValueChanged<PermissionOnboardingResult> onComplete;

  /// Override the default four-step sequence (primarily for tests/previews).
  final List<PermissionOnboardingStep>? steps;

  @override
  State<PermissionOnboardingScreen> createState() =>
      _PermissionOnboardingScreenState();
}

class _PermissionOnboardingScreenState
    extends State<PermissionOnboardingScreen> with WidgetsBindingObserver {
  late final PermissionFlowController _controller;
  late final PageController _pageController;
  bool _completed = false;

  @override
  void initState() {
    super.initState();
    _controller = PermissionFlowController(
      service: widget.service,
      steps: widget.steps,
    )..addListener(_onControllerChanged);
    _pageController = PageController();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Coming back from the system Settings screen: re-read statuses so a
    // just-granted permission is reflected without re-requesting.
    if (state == AppLifecycleState.resumed) {
      _controller.refreshStatuses();
    }
  }

  void _onControllerChanged() {
    // Keep the PageView in sync when the controller advances via a button.
    if (_pageController.hasClients) {
      final target = _controller.pageIndex;
      final current = _pageController.page?.round() ?? target;
      if (current != target) {
        _pageController.animateToPage(
          target,
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeInOut,
        );
      }
    }

    // Fire completion once, after the current frame, so listeners/navigation
    // run outside of build.
    if (_controller.isComplete && !_completed) {
      _completed = true;
      final result = _controller.result;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onComplete(result);
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller
      ..removeListener(_onControllerChanged)
      ..dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            // Empty state: a misconfigured flow with no steps. Rather than
            // trap the user, offer a way out via the completion callback.
            if (_controller.isEmpty) {
              return _EmptyState(
                onDismiss: () {
                  if (!_completed) {
                    _completed = true;
                    widget.onComplete(_controller.result);
                  }
                },
              );
            }

            final steps = _controller.steps;
            return Column(
              children: [
                _Header(
                  count: steps.length,
                  activeIndex: _controller.pageIndex,
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: steps.length,
                    onPageChanged: _controller.onPageChanged,
                    physics: _UnlockBoundedPhysics(
                      maxUnlockedIndex: _controller.maxUnlockedIndex,
                    ),
                    itemBuilder: (context, index) {
                      final step = steps[index];
                      return PermissionPageCard(
                        step: step,
                        outcome: _controller.outcomeForStep(step),
                        isRequesting: _controller.isRequesting &&
                            index == _controller.pageIndex,
                        needsSettings: _controller.stepNeedsSettings(step),
                        errorMessage: index == _controller.pageIndex
                            ? _controller.errorMessage
                            : null,
                        onAllow: _controller.requestCurrent,
                        onSkip: _controller.skipCurrent,
                        onOpenSettings: () async {
                          await _controller.openSettings();
                        },
                        onRetry: _controller.requestCurrent,
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.count, required this.activeIndex});

  final int count;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 4),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Step ${activeIndex + 1} of $count',
                style: theme.textTheme.labelMedium
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              OnboardingProgressDots(count: count, activeIndex: activeIndex),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onDismiss});

  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_outline,
                size: 56, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              "You're all set",
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'There’s nothing to set up right now.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: onDismiss, child: const Text('Continue')),
          ],
        ),
      ),
    );
  }
}

/// [ScrollPhysics] that lets the user swipe **back** to review answered pages
/// but not **forward** past the furthest unlocked one — forward progress must
/// go through an explicit Allow / Not now tap. Rebuilt each frame with the
/// current [maxUnlockedIndex].
class _UnlockBoundedPhysics extends ScrollPhysics {
  const _UnlockBoundedPhysics({required this.maxUnlockedIndex, super.parent});

  final int maxUnlockedIndex;

  @override
  _UnlockBoundedPhysics applyTo(ScrollPhysics? ancestor) =>
      _UnlockBoundedPhysics(
        maxUnlockedIndex: maxUnlockedIndex,
        parent: buildParent(ancestor),
      );

  @override
  double applyBoundaryConditions(ScrollMetrics position, double value) {
    final maxAllowed = maxUnlockedIndex * position.viewportDimension;
    if (value > maxAllowed) {
      // Already at/beyond the frontier: block any further forward motion.
      if (position.pixels >= maxAllowed) return value - position.pixels;
      // Crossing the frontier this drag: allow up to it, resist the rest.
      return value - maxAllowed;
    }
    return super.applyBoundaryConditions(position, value);
  }
}
