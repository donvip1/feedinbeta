import 'dart:async';
import 'dart:io';

import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'audio_message_support.dart';

/// Concrete audio backends that light up the recorder/player seams defined in
/// [audio_message_support.dart]. Registering these (via [registerAudioBackends],
/// called once at app start) turns the in-chat voice-note recorder and the
/// music/voice playback bubbles from "unavailable" placeholders into working
/// features — with ZERO changes to the UI layer, which only talks to the seams.
///
///  * Recording  -> `record` (AAC-LC in an .m4a / audio/mp4 container, which is
///    on the `message-media` bucket allow-list).
///  * Playback   -> `just_audio` (seek-accurate position/duration streams).

/// Wire the concrete recorder + player into the seams. Idempotent.
void registerAudioBackends() {
  AudioRecorderFactory.instance = () async => RecordAudioRecorderController();
  AudioPlayerFactory.instance = ({String? localPath, String? remoteUrl}) =>
      JustAudioPlaybackController.create(
        localPath: localPath,
        remoteUrl: remoteUrl,
      );
}

/// Best-effort clip duration (ms) via a throwaway [AudioPlayer]. Returns null if
/// the source can't be decoded. Used to enforce the 4-minute gate on picked
/// music files, which the file picker itself does not report.
Future<int?> probeAudioDurationMs(String source, {bool isUrl = false}) async {
  final player = AudioPlayer();
  try {
    final duration = isUrl
        ? await player.setUrl(source)
        : await player.setFilePath(source);
    return duration?.inMilliseconds;
  } catch (_) {
    return null;
  } finally {
    await player.dispose();
  }
}

// ---------------------------------------------------------------------------
// Recorder (record)
// ---------------------------------------------------------------------------

class RecordAudioRecorderController implements AudioRecorderController {
  RecordAudioRecorderController();

  final AudioRecorder _recorder = AudioRecorder();
  final StreamController<AudioRecordingSnapshot> _out =
      StreamController<AudioRecordingSnapshot>.broadcast();
  final Stopwatch _clock = Stopwatch();

  Timer? _ticker;
  StreamSubscription<Amplitude>? _ampSub;
  String? _path;
  double _amplitude = 0;
  bool _finalized = false;
  StagedAudioMedia? _staged;

  AudioRecordingSnapshot _value = const AudioRecordingSnapshot(
    state: AudioRecordingState.idle,
    elapsedMs: 0,
  );

  @override
  Stream<AudioRecordingSnapshot> get snapshots => _out.stream;

  @override
  AudioRecordingSnapshot get value => _value;

  void _emit(AudioRecordingState state, {String? error}) {
    _value = AudioRecordingSnapshot(
      state: state,
      elapsedMs: _clock.elapsedMilliseconds,
      amplitude: _amplitude,
      error: error,
    );
    if (!_out.isClosed) _out.add(_value);
  }

  @override
  Future<void> start() async {
    bool granted;
    try {
      granted = await _recorder.hasPermission();
    } catch (_) {
      granted = false;
    }
    if (!granted) {
      _emit(AudioRecordingState.denied);
      return;
    }

    try {
      final dir = await getTemporaryDirectory();
      final folder = Directory('${dir.path}/audio_notes');
      if (!folder.existsSync()) folder.createSync(recursive: true);
      _path =
          '${folder.path}/note_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          sampleRate: 44100,
          bitRate: 128000,
          numChannels: 1,
        ),
        path: _path!,
      );
    } catch (e) {
      _emit(AudioRecordingState.error, error: 'Could not start recording.');
      return;
    }

    _clock
      ..reset()
      ..start();
    _ampSub = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 200))
        .listen((amp) {
          // amp.current is dBFS (<= 0). Map -45..0 dB onto 0..1 for the bars.
          _amplitude = ((amp.current + 45) / 45).clamp(0.0, 1.0);
        });
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (_clock.elapsedMilliseconds >= kMaxAudioDuration.inMilliseconds) {
        unawaited(stop());
        return;
      }
      _emit(AudioRecordingState.recording);
    });
    _emit(AudioRecordingState.recording);
  }

  @override
  Future<void> pause() async {
    if (!_clock.isRunning) return;
    try {
      await _recorder.pause();
    } catch (_) {}
    _clock.stop();
    _emit(AudioRecordingState.paused);
  }

  @override
  Future<void> resume() async {
    try {
      await _recorder.resume();
    } catch (_) {}
    _clock.start();
    _emit(AudioRecordingState.recording);
  }

  @override
  Future<StagedAudioMedia?> stop() async {
    // Idempotent: an auto-stop at the 4-min cap and a user tap can both land.
    if (_finalized) return _staged;
    _finalized = true;

    _ticker?.cancel();
    _ticker = null;
    await _ampSub?.cancel();
    _ampSub = null;
    _clock.stop();
    final elapsed = _clock.elapsedMilliseconds;

    String? path;
    try {
      path = await _recorder.stop();
    } catch (_) {
      path = _path;
    }
    _emit(AudioRecordingState.stopped);

    final finalPath = path ?? _path;
    if (finalPath == null) return null;
    final file = File(finalPath);
    // Drop empty/too-short captures (a stray tap) so we never send silence.
    if (!file.existsSync() || elapsed < 400) return null;

    _staged = StagedAudioMedia(
      kind: StagedAudioKind.audioNote,
      localPath: finalPath,
      mimeType: 'audio/mp4',
      fileName: finalPath.split('/').last,
      fileSizeBytes: file.lengthSync(),
      durationMs: elapsed,
    );
    return _staged;
  }

  @override
  Future<void> cancel() async {
    _finalized = true;
    _ticker?.cancel();
    _ticker = null;
    await _ampSub?.cancel();
    _ampSub = null;
    _clock.stop();
    try {
      await _recorder.cancel();
    } catch (_) {}
    final p = _path;
    if (p != null) {
      final f = File(p);
      if (f.existsSync()) {
        try {
          f.deleteSync();
        } catch (_) {}
      }
    }
    _emit(AudioRecordingState.idle);
  }

  @override
  Future<void> dispose() async {
    _ticker?.cancel();
    await _ampSub?.cancel();
    try {
      await _recorder.dispose();
    } catch (_) {}
    if (!_out.isClosed) await _out.close();
  }
}

// ---------------------------------------------------------------------------
// Player (just_audio)
// ---------------------------------------------------------------------------

class JustAudioPlaybackController implements AudioPlaybackController {
  JustAudioPlaybackController._(this._player);

  final AudioPlayer _player;
  final StreamController<AudioPlaybackSnapshot> _out =
      StreamController<AudioPlaybackSnapshot>.broadcast();
  final List<StreamSubscription<dynamic>> _subs = [];
  int _durationMs = 0;

  static Future<JustAudioPlaybackController> create({
    String? localPath,
    String? remoteUrl,
  }) async {
    final player = AudioPlayer();
    Duration? dur;
    try {
      if (localPath != null && localPath.isNotEmpty && File(localPath).existsSync()) {
        dur = await player.setFilePath(localPath);
      } else if (remoteUrl != null && remoteUrl.isNotEmpty) {
        dur = await player.setUrl(remoteUrl);
      }
    } catch (_) {}
    final controller = JustAudioPlaybackController._(player);
    controller._durationMs = dur?.inMilliseconds ?? 0;
    controller._wire();
    return controller;
  }

  void _wire() {
    _subs.add(
      _player.positionStream.listen((pos) => _emit(pos.inMilliseconds)),
    );
    _subs.add(
      _player.durationStream.listen((d) {
        if (d != null) _durationMs = d.inMilliseconds;
        _emit(_player.position.inMilliseconds);
      }),
    );
    _subs.add(
      _player.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) {
          // Reset to the start and idle so the bubble shows a replayable clip.
          unawaited(_player.seek(Duration.zero));
          unawaited(_player.pause());
        }
        _emit(_player.position.inMilliseconds);
      }),
    );
  }

  void _emit(int positionMs) {
    if (_out.isClosed) return;
    _out.add(
      AudioPlaybackSnapshot(
        isPlaying: _player.playing,
        positionMs: positionMs,
        durationMs: _durationMs,
      ),
    );
  }

  @override
  Stream<AudioPlaybackSnapshot> get snapshots => _out.stream;

  @override
  AudioPlaybackSnapshot get value => AudioPlaybackSnapshot(
    isPlaying: _player.playing,
    positionMs: _player.position.inMilliseconds,
    durationMs: _durationMs,
  );

  @override
  Future<void> playPause() async {
    if (_player.playing) {
      await _player.pause();
    } else {
      // Do NOT await: play() completes only when the clip finishes, which would
      // block the caller for the whole track. Fire and let the streams drive UI.
      unawaited(_player.play());
    }
  }

  @override
  Future<void> seek(int positionMs) async {
    await _player.seek(Duration(milliseconds: positionMs));
  }

  @override
  Future<void> stop() async {
    await _player.stop();
  }

  @override
  Future<void> dispose() async {
    for (final sub in _subs) {
      await sub.cancel();
    }
    await _player.dispose();
    if (!_out.isClosed) await _out.close();
  }
}
