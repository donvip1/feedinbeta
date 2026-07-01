// In-chat audio-note recorder — bottom-sheet UI, parity with the web
// `VoiceRecorder` (src/components/messages/VoiceRecorder.tsx):
//   * a live red pulsing dot + `m:ss` elapsed label while recording,
//   * a pulsing level bar (driven by the seam's amplitude when available),
//   * pause/resume, stop, and cancel controls,
//   * on stop -> a review row with a synthetic waveform, delete, and a
//     pink→blue gradient Send button (ChatGradients.voiceSend).
//
// Recording itself is driven entirely by an [AudioRecorderController] obtained
// from [AudioRecorderFactory]. When no recorder backend is wired (the current
// build — see the FLAGGED DEPS note in audio_message_support.dart) the sheet
// renders a clear "recording needs a backend" state instead of failing.
//
// On a successful send the sheet pops with the finalized [StagedAudioMedia]
// (kind == StagedAudioKind.audioNote); the screen queues + uploads it.

import 'dart:async';

import 'package:flutter/material.dart';

import '../audio_message_support.dart';
import '../chat_theme.dart';

/// Presents the recorder sheet and returns the staged audio note, or null if
/// the user cancelled / no note was captured.
Future<StagedAudioMedia?> showAudioNoteRecorderSheet(BuildContext context) {
  return showModalBottomSheet<StagedAudioMedia>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ChatColors.card,
    barrierColor: ChatColors.barrier,
    shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
    builder: (_) => const _AudioNoteRecorderSheet(),
  );
}

class _AudioNoteRecorderSheet extends StatefulWidget {
  const _AudioNoteRecorderSheet();

  @override
  State<_AudioNoteRecorderSheet> createState() =>
      _AudioNoteRecorderSheetState();
}

class _AudioNoteRecorderSheetState extends State<_AudioNoteRecorderSheet> {
  AudioRecorderController? _controller;
  StreamSubscription<AudioRecordingSnapshot>? _sub;
  AudioRecordingSnapshot _snapshot = const AudioRecordingSnapshot(
    state: AudioRecordingState.idle,
    elapsedMs: 0,
  );

  /// Set when the recorder backend is missing, so the sheet can explain why.
  String? _unavailableReason;

  /// The finalized note after Stop (review state before Send).
  StagedAudioMedia? _staged;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _startRecording();
  }

  Future<void> _startRecording() async {
    if (!AudioRecorderFactory.isAvailable) {
      setState(() => _unavailableReason = const AudioRecorderUnavailable().message);
      return;
    }
    // Tear down any prior session (e.g. after Delete in the review state) so a
    // re-record never leaks a controller or subscription.
    await _sub?.cancel();
    _sub = null;
    await _controller?.dispose();
    _controller = null;
    try {
      final controller = await AudioRecorderFactory.create();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      _controller = controller;
      _sub = controller.snapshots.listen(_onSnapshot);
      _snapshot = controller.value;
      await controller.start();
    } on AudioRecorderUnavailable catch (e) {
      if (mounted) setState(() => _unavailableReason = e.message);
    } catch (e) {
      if (mounted) {
        setState(
          () => _unavailableReason = 'Could not start recording: $e',
        );
      }
    }
  }

  void _onSnapshot(AudioRecordingSnapshot snapshot) {
    if (!mounted) return;
    setState(() => _snapshot = snapshot);
    // Auto-stop at the 4-minute ceiling.
    if (snapshot.reachedLimit &&
        snapshot.state == AudioRecordingState.recording) {
      _stop();
    }
  }

  Future<void> _pauseResume() async {
    final controller = _controller;
    if (controller == null) return;
    if (_snapshot.state == AudioRecordingState.paused) {
      await controller.resume();
    } else {
      await controller.pause();
    }
  }

  Future<void> _stop() async {
    final controller = _controller;
    if (controller == null || _busy) return;
    setState(() => _busy = true);
    final staged = await controller.stop();
    if (!mounted) return;
    setState(() {
      _staged = staged;
      _busy = false;
    });
  }

  Future<void> _deleteReview() async {
    setState(() => _staged = null);
    // Discarding the review returns to a fresh recording attempt.
    await _controller?.cancel();
    if (!mounted) return;
    await _startRecording();
  }

  void _send() {
    final staged = _staged;
    if (staged == null) return;
    Navigator.of(context).pop(staged);
  }

  Future<void> _cancel() async {
    await _controller?.cancel();
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: ChatSpacing.lg,
          right: ChatSpacing.lg,
          top: ChatSpacing.sm,
          bottom: ChatSpacing.lg + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: ChatSpacing.md),
                decoration: BoxDecoration(
                  color: ChatColors.border,
                  borderRadius: ChatRadii.chip,
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(bottom: ChatSpacing.md, left: 2),
              child: Text('Audio note', style: ChatTextStyles.sectionLabel),
            ),
            _buildBody(),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_unavailableReason != null) {
      return _UnavailableBody(reason: _unavailableReason!, onClose: _cancel);
    }
    if (_staged != null) {
      return _ReviewBody(
        staged: _staged!,
        onDelete: _deleteReview,
        onSend: _send,
      );
    }
    return _RecordingBody(
      snapshot: _snapshot,
      busy: _busy,
      onPauseResume: _pauseResume,
      onStop: _stop,
      onCancel: _cancel,
    );
  }
}

// ---------------------------------------------------------------------------
// Recording (live) state
// ---------------------------------------------------------------------------

class _RecordingBody extends StatelessWidget {
  const _RecordingBody({
    required this.snapshot,
    required this.busy,
    required this.onPauseResume,
    required this.onStop,
    required this.onCancel,
  });

  final AudioRecordingSnapshot snapshot;
  final bool busy;
  final VoidCallback onPauseResume;
  final VoidCallback onStop;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final paused = snapshot.state == AudioRecordingState.paused;
    final elapsed = formatMediaDuration(snapshot.elapsedMs);

    return Container(
      padding: const EdgeInsets.all(ChatSpacing.md),
      decoration: BoxDecoration(
        color: ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
      ),
      child: Row(
        children: [
          _PulsingDot(active: !paused),
          const SizedBox(width: ChatSpacing.sm),
          Text(
            elapsed.isEmpty ? '0:00' : elapsed,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: ChatColors.foreground,
            ),
          ),
          const SizedBox(width: ChatSpacing.md),
          Expanded(
            child: _LevelBar(amplitude: paused ? 0 : snapshot.amplitude),
          ),
          const SizedBox(width: ChatSpacing.sm),
          IconButton(
            tooltip: paused ? 'Resume' : 'Pause',
            onPressed: busy ? null : onPauseResume,
            color: ChatColors.foreground,
            icon: Icon(paused ? Icons.mic_none : Icons.pause),
          ),
          IconButton(
            tooltip: 'Stop',
            onPressed: busy ? null : onStop,
            color: ChatColors.primary,
            icon: const Icon(Icons.stop_circle_outlined),
          ),
          IconButton(
            tooltip: 'Cancel',
            onPressed: onCancel,
            color: ChatColors.destructive,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.active});

  final bool active;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: widget.active
          ? Tween<double>(begin: 0.35, end: 1).animate(_controller)
          : const AlwaysStoppedAnimation<double>(0.5),
      child: Container(
        width: 12,
        height: 12,
        decoration: const BoxDecoration(
          color: ChatColors.recording,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

/// A pulsing level bar. When the recorder reports amplitude it fills
/// proportionally; otherwise it animates a soft pulse for a "live" feel.
class _LevelBar extends StatelessWidget {
  const _LevelBar({required this.amplitude});

  final double amplitude;

  @override
  Widget build(BuildContext context) {
    final fill = amplitude <= 0 ? 0.6 : amplitude.clamp(0.05, 1.0);
    return ClipRRect(
      borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.pill)),
      child: Container(
        height: 8,
        color: ChatColors.primarySoft,
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: fill,
          child: const DecoratedBox(
            decoration: BoxDecoration(color: ChatColors.primary),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Review (recorded, pre-send) state
// ---------------------------------------------------------------------------

class _ReviewBody extends StatelessWidget {
  const _ReviewBody({
    required this.staged,
    required this.onDelete,
    required this.onSend,
  });

  final StagedAudioMedia staged;
  final VoidCallback onDelete;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final duration = formatMediaDuration(staged.durationMs);
    final bars = syntheticWaveform(seed: staged.localPath.hashCode);

    return Container(
      padding: const EdgeInsets.all(ChatSpacing.md),
      decoration: BoxDecoration(
        color: ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
      ),
      child: Row(
        children: [
          const Icon(Icons.graphic_eq_rounded, color: ChatColors.primary),
          const SizedBox(width: ChatSpacing.sm),
          Expanded(
            child: SizedBox(
              height: 26,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (final h in bars)
                    Container(
                      width: 2.5,
                      height: 26 * h,
                      decoration: const BoxDecoration(
                        color: ChatColors.primary,
                        borderRadius: BorderRadius.all(Radius.circular(2)),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: ChatSpacing.sm),
          Text(
            duration.isEmpty ? '0:00' : duration,
            style: ChatTextStyles.subtitle,
          ),
          const SizedBox(width: ChatSpacing.sm),
          IconButton(
            tooltip: 'Delete',
            onPressed: onDelete,
            color: ChatColors.destructive,
            icon: const Icon(Icons.delete_outline),
          ),
          _GradientSendButton(onPressed: onSend),
        ],
      ),
    );
  }
}

class _GradientSendButton extends StatelessWidget {
  const _GradientSendButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Send audio note',
      child: Material(
        type: MaterialType.transparency,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: ChatGradients.voiceSend,
          ),
          child: InkWell(
            onTap: onPressed,
            customBorder: const CircleBorder(),
            child: const SizedBox(
              width: 40,
              height: 40,
              child: Icon(
                Icons.arrow_upward,
                size: 20,
                color: ChatColors.primaryForeground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Unavailable (no recorder backend) state
// ---------------------------------------------------------------------------

class _UnavailableBody extends StatelessWidget {
  const _UnavailableBody({required this.reason, required this.onClose});

  final String reason;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(ChatSpacing.lg),
      decoration: BoxDecoration(
        color: ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.mic_off_outlined, color: ChatColors.amberWarning),
              SizedBox(width: ChatSpacing.sm),
              Text(
                'Recording unavailable',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: ChatColors.foreground,
                ),
              ),
            ],
          ),
          const SizedBox(height: ChatSpacing.sm),
          Text(reason, style: ChatTextStyles.previewMuted),
          const SizedBox(height: ChatSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onClose,
              child: const Text(
                'Close',
                style: TextStyle(color: ChatColors.primary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
