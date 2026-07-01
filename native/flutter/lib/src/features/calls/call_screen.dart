import 'package:flutter/material.dart';

import 'call_controller.dart';
import 'call_media_engine.dart';
import 'call_models.dart';
import 'call_theme.dart';
import 'widgets/call_avatar.dart';
import 'widgets/call_controls_bar.dart';
import 'widgets/incoming_call_view.dart';
import 'widgets/video_stage.dart';

/// The full-screen, immersive call surface for a 1:1 audio/video call.
///
/// Driven entirely by a [CallController]: it rebuilds on every controller
/// notification and renders the right sub-view for the current [CallPhase]:
///   * dialing              -> "Calling…" with the callee avatar + cancel
///   * connecting           -> "Connecting…" spinner
///   * connected (audio)    -> avatar + duration + controls
///   * connected (video)    -> [VideoStage] (remote full-bleed + local tile)
///   * incoming             -> [IncomingCallView] (accept/decline)
///   * ended                -> brief "Call ended" then auto-pops
///
/// # Entry API for the Chat screen
///
/// Trigger an outgoing call with the single static launcher — it starts the
/// call via the controller AND pushes this screen:
/// ```dart
/// await CallScreen.start(
///   context,
///   controller: callController,        // shared, long-lived controller
///   callee: CallParticipant(
///     userId: otherUserId,
///     displayName: otherUserName,
///     avatarUrl: otherUserAvatarUrl,
///   ),
///   type: CallType.video,              // or CallType.voice
/// );
/// ```
///
/// For an INCOMING call the app shell watches [CallController.incomingCall] and
/// presents `CallScreen(controller: controller)` (which shows the incoming UI
/// while `incomingCall != null`). See the module report for the shell wiring.
class CallScreen extends StatefulWidget {
  const CallScreen({super.key, required this.controller});

  final CallController controller;

  /// Start an outgoing [type] call to [callee] and push the call screen.
  ///
  /// This is the ONE public entry point the Chat screen uses. It is a no-op
  /// that returns null when the call cannot be placed (unconfigured / signed
  /// out / already in a call), so the caller can show a snackbar on null.
  static Future<CallSession?> start(
    BuildContext context, {
    required CallController controller,
    required CallParticipant callee,
    required CallType type,
  }) async {
    final session = await controller.startCall(callee: callee, type: type);
    if (session == null) return null;
    if (!context.mounted) return session;
    await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => CallScreen(controller: controller),
      ),
    );
    return session;
  }

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  CallController get _controller => widget.controller;
  bool _popped = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onChange);
  }

  @override
  void dispose() {
    _controller.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    if (!mounted) return;
    // Auto-dismiss shortly after the call reaches a terminal state and there is
    // no incoming call to answer.
    if (_controller.phase == CallPhase.idle && _controller.incomingCall == null) {
      _popIfPossible();
    }
    setState(() {});
  }

  void _popIfPossible() {
    if (_popped || !mounted) return;
    _popped = true;
    final navigator = Navigator.of(context);
    if (navigator.canPop()) navigator.pop();
  }

  Future<void> _hangUp() async {
    await _controller.hangUp();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Keep the call alive on a back gesture unless it's already finished; a
      // deliberate hang-up is required to leave an active call.
      canPop: !_controller.hasActiveCall,
      child: Scaffold(
        backgroundColor: CallColors.backdropTop,
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    // An unanswered incoming call takes over the whole screen.
    final incoming = _controller.incomingCall;
    if (incoming != null && !_controller.hasActiveCall) {
      return IncomingCallView(
        caller: incoming.peer,
        callType: incoming.type,
        onAccept: () => _controller.acceptIncomingCall(),
        onDecline: () => _controller.declineIncomingCall(),
      );
    }

    switch (_controller.phase) {
      case CallPhase.connected when _controller.isVideoCall:
        return _VideoCallLayout(controller: _controller, onEndCall: _hangUp);
      case CallPhase.dialing:
      case CallPhase.connecting:
      case CallPhase.connected:
        return _AudioCallLayout(controller: _controller, onEndCall: _hangUp);
      case CallPhase.ended:
        return _EndedLayout(controller: _controller);
      case CallPhase.idle:
      case CallPhase.incoming:
        // Transient: either about to pop (idle) or the incoming branch above.
        return const SizedBox.expand();
    }
  }
}

// ---------------------------------------------------------------------------
// Audio call layout (also used for the dialing/connecting states of any call).
// ---------------------------------------------------------------------------

class _AudioCallLayout extends StatelessWidget {
  const _AudioCallLayout({required this.controller, required this.onEndCall});

  final CallController controller;
  final Future<void> Function() onEndCall;

  @override
  Widget build(BuildContext context) {
    final peer = controller.peer;
    return CallBackdrop(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            children: [
              const Spacer(flex: 2),
              if (peer != null)
                CallAvatar(
                  participant: peer,
                  ringing: controller.phase == CallPhase.dialing,
                ),
              const SizedBox(height: 40),
              Text(
                peer?.displayName ?? 'feedIn user',
                textAlign: TextAlign.center,
                style: CallTextStyles.callerName,
              ),
              const SizedBox(height: 12),
              _StatusLine(controller: controller),
              if (controller.isScreenSharing) ...[
                const SizedBox(height: 20),
                const ScreenShareBanner(),
              ],
              const Spacer(flex: 3),
              CallControlsBar(
                isMuted: controller.isMuted,
                isVideoOff: controller.isVideoOff,
                isVideoCall: controller.isVideoCall,
                isSpeakerOn: controller.isSpeakerOn,
                isScreenSharing: controller.isScreenSharing,
                onToggleMute: controller.toggleMute,
                onToggleSpeaker: controller.toggleSpeaker,
                onEndCall: onEndCall,
                onToggleVideo:
                    controller.isVideoCall ? controller.toggleVideo : null,
                onUpgradeToVideo:
                    controller.isVideoCall ? null : controller.toggleVideo,
                // Screen share is offered once a call is live (both voice and
                // video), matching the web CallControls.
                onToggleScreenShare: controller.hasActiveCall
                    ? controller.toggleScreenShare
                    : null,
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Video call layout: full-bleed video stage with an overlaid control bar.
// ---------------------------------------------------------------------------

class _VideoCallLayout extends StatelessWidget {
  const _VideoCallLayout({required this.controller, required this.onEndCall});

  final CallController controller;
  final Future<void> Function() onEndCall;

  @override
  Widget build(BuildContext context) {
    final peer = controller.peer;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (peer != null)
          VideoStage(
            peer: peer,
            remoteView: controller.remoteVideoView as Widget?,
            localView: controller.localVideoView as Widget?,
            isLocalVideoOff: controller.isVideoOff,
            isScreenSharing: controller.isScreenSharing,
          ),

        // Top gradient scrim + name/timer.
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: _TopScrim(controller: controller),
        ),

        // Bottom control bar over a scrim.
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.only(top: 40),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x00000000), Color(0xCC000000)],
              ),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                child: CallControlsBar(
                  isMuted: controller.isMuted,
                  isVideoOff: controller.isVideoOff,
                  isVideoCall: true,
                  isSpeakerOn: controller.isSpeakerOn,
                  isScreenSharing: controller.isScreenSharing,
                  onToggleMute: controller.toggleMute,
                  onToggleSpeaker: controller.toggleSpeaker,
                  onEndCall: onEndCall,
                  onToggleVideo: controller.toggleVideo,
                  onFlipCamera: controller.flipCamera,
                  onToggleScreenShare: controller.hasActiveCall
                      ? controller.toggleScreenShare
                      : null,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TopScrim extends StatelessWidget {
  const _TopScrim({required this.controller});

  final CallController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xB3000000), Color(0x00000000)],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                controller.peer?.displayName ?? 'feedIn user',
                style: CallTextStyles.callerName.copyWith(fontSize: 20),
              ),
              const SizedBox(height: 4),
              _StatusLine(controller: controller),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Status line: "Calling…" / "Connecting…" / mm:ss.
// ---------------------------------------------------------------------------

class _StatusLine extends StatelessWidget {
  const _StatusLine({required this.controller});

  final CallController controller;

  @override
  Widget build(BuildContext context) {
    // A failed media connection takes precedence and offers a retry.
    if (controller.connectionFailed) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 16, color: CallColors.declineHi),
          const SizedBox(width: 8),
          const Text('Connection failed', style: CallTextStyles.statusLine),
          const SizedBox(width: 8),
          TextButton(
            onPressed: controller.retryConnection,
            style: TextButton.styleFrom(
              foregroundColor: CallColors.foreground,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 32),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Retry'),
          ),
        ],
      );
    }

    final String text;
    switch (controller.phase) {
      case CallPhase.dialing:
        text = 'Calling…';
        break;
      case CallPhase.connecting:
        text = 'Connecting…';
        break;
      case CallPhase.connected:
        text = controller.isReconnecting
            ? 'Reconnecting…'
            : controller.formattedDuration;
        break;
      case CallPhase.ended:
        text = controller.endedReason;
        break;
      case CallPhase.idle:
      case CallPhase.incoming:
        text = '';
        break;
    }

    final showSpinner = controller.phase == CallPhase.dialing ||
        controller.phase == CallPhase.connecting ||
        (controller.phase == CallPhase.connected && controller.isReconnecting);
    final isDuration =
        controller.phase == CallPhase.connected && !controller.isReconnecting;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showSpinner) ...[
          const SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation(CallColors.subtle),
            ),
          ),
          const SizedBox(width: 10),
        ],
        Text(
          text,
          style: isDuration
              ? CallTextStyles.duration
              : CallTextStyles.statusLine,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Ended layout: shown briefly before the screen auto-pops.
// ---------------------------------------------------------------------------

class _EndedLayout extends StatefulWidget {
  const _EndedLayout({required this.controller});

  final CallController controller;

  @override
  State<_EndedLayout> createState() => _EndedLayoutState();
}

class _EndedLayoutState extends State<_EndedLayout> {
  @override
  void initState() {
    super.initState();
    // Reset the controller to idle after a beat, which triggers the screen's
    // auto-pop via the controller listener in [_CallScreenState].
    Future<void>.delayed(const Duration(milliseconds: 900), () {
      if (mounted) widget.controller.reset();
    });
  }

  @override
  Widget build(BuildContext context) {
    final peer = widget.controller.peer;
    return CallBackdrop(
      child: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (peer != null)
                CallAvatar(participant: peer, diameter: 112, borderWidth: 3),
              const SizedBox(height: 28),
              Text(
                peer?.displayName ?? 'feedIn user',
                style: CallTextStyles.callerName.copyWith(fontSize: 24),
              ),
              const SizedBox(height: 10),
              Text(
                widget.controller.endedReason,
                style: CallTextStyles.statusLine,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Convenience: whether the stub media engine is in use (so hosts can surface a
/// "preview mode" affordance). Real integrations replace the engine and this
/// returns false.
bool isStubMediaEngine(CallMediaEngine engine) => engine is StubCallMediaEngine;
