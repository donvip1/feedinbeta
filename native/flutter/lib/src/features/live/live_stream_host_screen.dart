import 'dart:async';

import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/live_models.dart';
import 'data/live_remote_data_source.dart';
import 'live_theme.dart';

/// Camera broadcaster for a group-scoped LiveKit stream.
///
/// The server mints a stream-room token only after checking that the caller is
/// the stream owner. Closing or ending this screen marks the stream as ended,
/// so group members do not see a stale live room.
class LiveStreamHostScreen extends StatefulWidget {
  const LiveStreamHostScreen({
    super.key,
    required this.stream,
    required this.dataSource,
  });

  final LiveStreamSummary stream;
  final LiveRemoteDataSource dataSource;

  @override
  State<LiveStreamHostScreen> createState() => _LiveStreamHostScreenState();
}

class _LiveStreamHostScreenState extends State<LiveStreamHostScreen> {
  Room? _room;
  bool _connecting = true;
  bool _connected = false;
  bool _cameraOn = true;
  bool _micOn = true;
  bool _ending = false;
  bool _closed = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_connect());
  }

  VideoTrack? get _cameraTrack {
    final publications = _room?.localParticipant?.videoTrackPublications;
    if (publications == null) return null;
    for (final publication in publications) {
      final track = publication.track;
      if (track is VideoTrack) return track;
    }
    return null;
  }

  Future<void> _connect() async {
    try {
      final permissions = await [
        Permission.camera,
        Permission.microphone,
      ].request();
      if (!permissions.values.every((status) => status.isGranted)) {
        throw StateError(
          'Camera and microphone permissions are required to go live.',
        );
      }

      final response = await Supabase.instance.client.functions.invoke(
        'livekit-token',
        body: {'roomName': 'stream-${widget.stream.id}'},
      );
      final payload = response.data;
      if (response.status != 200 || payload is! Map) {
        throw StateError('Could not start the broadcast connection.');
      }
      final token = payload['token']?.toString();
      final url = payload['url']?.toString();
      if (token == null || token.isEmpty || url == null || url.isEmpty) {
        throw StateError('The broadcast connection is unavailable.');
      }

      final room = Room(
        roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
      );
      _room = room;
      await room.connect(url, token);
      await room.localParticipant?.setMicrophoneEnabled(true);
      await room.localParticipant?.setCameraEnabled(true);

      if (!mounted) return;
      setState(() {
        _connecting = false;
        _connected = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _connecting = false;
        _error = error.toString();
      });
    }
  }

  Future<void> _toggleCamera() async {
    final next = !_cameraOn;
    await _room?.localParticipant?.setCameraEnabled(next);
    if (mounted) setState(() => _cameraOn = next);
  }

  Future<void> _toggleMicrophone() async {
    final next = !_micOn;
    await _room?.localParticipant?.setMicrophoneEnabled(next);
    if (mounted) setState(() => _micOn = next);
  }

  Future<void> _end() async {
    if (_ending) return;
    setState(() => _ending = true);
    await _close(endStream: true);
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _close({required bool endStream}) async {
    if (_closed) return;
    _closed = true;
    final room = _room;
    _room = null;
    if (room != null) {
      try {
        await room.disconnect();
      } catch (_) {}
      try {
        await room.dispose();
      } catch (_) {}
    }
    if (endStream) {
      try {
        await widget.dataSource.endStream(widget.stream.id);
      } catch (_) {}
    }
  }

  @override
  void dispose() {
    unawaited(_close(endStream: true));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final track = _cameraTrack;
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_connected && _cameraOn && track != null)
              VideoTrackRenderer(track, fit: VideoViewFit.cover)
            else
              const DecoratedBox(
                decoration: BoxDecoration(gradient: LiveTheme.streamFallback),
              ),
            Positioned(
              top: 18,
              left: 20,
              right: 20,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: LiveTheme.liveRed,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'LIVE',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.stream.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_connecting || _error != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_connecting)
                        const CircularProgressIndicator(color: Colors.white)
                      else
                        const Icon(
                          Icons.error_outline,
                          color: Colors.white,
                          size: 40,
                        ),
                      const SizedBox(height: 16),
                      Text(
                        _error ?? 'Connecting your camera...',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _end,
                          child: const Text('Close'),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            if (_connected)
              Positioned(
                left: 20,
                right: 20,
                bottom: 24,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _RoundControl(
                      icon: _micOn ? Icons.mic_rounded : Icons.mic_off_rounded,
                      onPressed: _toggleMicrophone,
                    ),
                    _RoundControl(
                      icon: _cameraOn
                          ? Icons.videocam_rounded
                          : Icons.videocam_off_rounded,
                      onPressed: _toggleCamera,
                    ),
                    _RoundControl(
                      icon: Icons.stop_rounded,
                      color: LiveTheme.liveRed,
                      onPressed: _end,
                    ),
                  ],
                ),
              ),
            if (_ending)
              const ColoredBox(
                color: Color(0x88000000),
                child: Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RoundControl extends StatelessWidget {
  const _RoundControl({
    required this.icon,
    required this.onPressed,
    this.color,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color ?? const Color(0xAA1D1D1D),
      shape: const CircleBorder(),
      child: IconButton(
        icon: Icon(icon, color: Colors.white),
        onPressed: onPressed,
        tooltip: icon == Icons.stop_rounded ? 'End livestream' : null,
      ),
    );
  }
}
