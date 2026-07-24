import 'dart:async';

import '../domain/notification_payload.dart';
import 'notification_preference_store.dart';

/// The one dispatch point for every push the app receives — foreground,
/// background isolate, or cold start. Replaces the scattered per-type handling
/// with a single, testable decision function:
///
///   payload -> [route] -> {presentIncomingCall | showNotification |
///                          processSilently | suppress}
///
/// Rules (in order):
///  1. **Calls always ring.** `call` bypasses preferences AND mutes — a muted
///     thread silences messages, not incoming calls (decline is one tap away).
///     `priority` behaves the same for platform-critical alerts.
///  2. **Silent payloads never render** — they return `processSilently` for
///     the sync layer.
///  3. **Suppression**: per-category preference off → suppress; conversation
///     muted → suppress; viewer already reading that conversation in the
///     foreground → suppress (no self-noise).
///  4. Everything else → `showNotification`.
///
/// The router DECIDES; hosts present. [onIncomingCall]/[onShowNotification]/
/// [onSilentSignal] are injected sinks (CallKit bridge, local-notifications
/// plugin, sync scheduler) so this class stays platform-independent and fully
/// unit-testable.
class NotificationRouter {
  NotificationRouter({
    required NotificationPreferenceStore preferences,
    required Future<void> Function(NotificationPayload payload) onIncomingCall,
    required Future<void> Function(NotificationPayload payload)
    onShowNotification,
    Future<void> Function(NotificationPayload payload)? onSilentSignal,
    String? Function()? foregroundConversationId,
    int Function()? nowMillis,
  }) : _preferences = preferences,
       _onIncomingCall = onIncomingCall,
       _onShowNotification = onShowNotification,
       _onSilentSignal = onSilentSignal,
       _foregroundConversationId = foregroundConversationId ?? (() => null),
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch);

  final NotificationPreferenceStore _preferences;
  final Future<void> Function(NotificationPayload) _onIncomingCall;
  final Future<void> Function(NotificationPayload) _onShowNotification;
  final Future<void> Function(NotificationPayload)? _onSilentSignal;

  /// The conversation currently on screen (null when none / backgrounded).
  final String? Function() _foregroundConversationId;
  final int Function() _now;

  final _decisions = StreamController<NotificationDecision>.broadcast();

  /// Every routing decision (diagnostics + notification-center feed).
  Stream<NotificationDecision> get decisions => _decisions.stream;

  /// Route a raw FCM data map (any generation of payload shape).
  Future<NotificationDecision> routeData(Map<String, Object?> data) =>
      route(NotificationPayload.fromData(data));

  /// Decide and dispatch [payload]. Returns the decision (also emitted on
  /// [decisions]).
  Future<NotificationDecision> route(NotificationPayload payload) async {
    final decision = await _decide(payload);
    switch (decision.action) {
      case NotificationAction.presentIncomingCall:
        await _onIncomingCall(payload);
      case NotificationAction.showNotification:
        await _onShowNotification(payload);
      case NotificationAction.processSilently:
        await _onSilentSignal?.call(payload);
      case NotificationAction.suppress:
        break;
    }
    if (!_decisions.isClosed) _decisions.add(decision);
    return decision;
  }

  Future<NotificationDecision> _decide(NotificationPayload payload) async {
    // 1. Calls + priority always surface (full-screen path for calls).
    if (payload.category == NotificationCategory.call) {
      return NotificationDecision(
        NotificationAction.presentIncomingCall,
        payload,
        reason: 'calls always ring',
      );
    }
    if (payload.category == NotificationCategory.priority) {
      return NotificationDecision(
        NotificationAction.showNotification,
        payload,
        reason: 'priority bypasses filters',
      );
    }

    // 2. Silent → sync signal, never UI.
    if (payload.category.isSilent) {
      return NotificationDecision(
        NotificationAction.processSilently,
        payload,
        reason: 'silent payload',
      );
    }

    // 3a. Per-category preference.
    if (!await _preferences.isEnabled(payload.category)) {
      return NotificationDecision(
        NotificationAction.suppress,
        payload,
        reason: 'category ${payload.category.name} disabled',
      );
    }

    // 3b. Conversation mute.
    final conversationId = payload.conversationId;
    if (conversationId != null &&
        await _preferences.isMuted(conversationId, nowMillis: _now())) {
      return NotificationDecision(
        NotificationAction.suppress,
        payload,
        reason: 'conversation muted',
      );
    }

    // 3c. Already reading this conversation.
    if (conversationId != null &&
        conversationId == _foregroundConversationId()) {
      return NotificationDecision(
        NotificationAction.suppress,
        payload,
        reason: 'conversation in foreground',
      );
    }

    // 4. Default: show it.
    return NotificationDecision(
      NotificationAction.showNotification,
      payload,
      reason: 'default',
    );
  }

  Future<void> dispose() async {
    await _decisions.close();
  }
}
