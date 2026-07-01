import 'dart:async';

/// Shared, dependency-free support for the two messaging audio features:
///  * MUSIC / audio-file sharing (up to 4 minutes) — pick an audio file, run it
///    through [AudioMediaValidator], stage it as [StagedAudioMedia] with
///    `kind == StagedAudioKind.music`, and render it with `MusicMessageBubble`.
///  * AUDIO NOTES — record a voice note in-chat via an [AudioRecorderController],
///    stage it with `kind == StagedAudioKind.audioNote`, and render it with the
///    existing `VoiceNoteBubble`.
///
/// This file deliberately holds ONLY pure Dart: value objects, validation, a
/// deterministic waveform sampler, and abstract controller *seams* for the
/// recorder and player. There is intentionally NO concrete recorder/player here
/// because the required plugins (`record`, `just_audio`/`audioplayers`,
/// `file_picker`) are not in the allowed pubspec set. See the FLAGGED DEPS note
/// at the bottom. Wiring a real implementation later means providing a concrete
/// [AudioRecorderController] / [AudioPlaybackController] and an audio file
/// picker — nothing in the UI layer changes.

// ---------------------------------------------------------------------------
// Constants & formatting
// ---------------------------------------------------------------------------

/// Hard ceiling for both shared music files and recorded audio notes: 4 minutes
/// (parity with the plan's "up to 4 minutes" requirement).
const Duration kMaxAudioDuration = Duration(minutes: 4);

/// Bucket ceiling for message media (mirrors the `message-media` bucket's
/// `file_size_limit` of 50 MB). Used as a defensive client-side guard.
const int kMaxAudioFileSizeBytes = 50 * 1024 * 1024;

/// Formats a millisecond duration as `m:ss` (e.g. 0:07, 3:59). Shared by every
/// audio surface so the elapsed/duration label reads identically everywhere.
String formatMediaDuration(int? millis) {
  if (millis == null || millis <= 0) return '';
  final totalSeconds = millis ~/ 1000;
  final minutes = totalSeconds ~/ 60;
  final seconds = totalSeconds % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

// ---------------------------------------------------------------------------
// Audio MIME + duration validation
// ---------------------------------------------------------------------------

/// The outcome of validating a candidate audio attachment.
class AudioValidationResult {
  const AudioValidationResult._({required this.isValid, this.error});

  const AudioValidationResult.valid() : this._(isValid: true);
  const AudioValidationResult.invalid(String message)
    : this._(isValid: false, error: message);

  final bool isValid;

  /// Human-readable failure reason (null when [isValid]).
  final String? error;
}

/// Validates that a candidate file is an acceptable audio attachment: an audio
/// MIME type, within the 4-minute duration ceiling, and under the size cap.
///
/// Pure and side-effect free so it is trivially testable and reusable by both
/// the file-share flow and the recorder flow.
class AudioMediaValidator {
  const AudioMediaValidator._();

  /// MIME types the `message-media` bucket accepts today. `audio/wav` and
  /// `audio/webm` are intentionally absent because the bucket's
  /// `allowed_mime_types` list does not include them (see FLAGGED BACKEND note).
  static const Set<String> allowedMimeTypes = {
    'audio/aac',
    'audio/mpeg', // .mp3
    'audio/mp4', // .m4a
    'audio/ogg',
  };

  /// File extensions that map onto the allowed MIME set — used when a picked
  /// file reports a null/empty MIME (common on some platforms).
  static const Map<String, String> extensionToMime = {
    'aac': 'audio/aac',
    'mp3': 'audio/mpeg',
    'mpeg': 'audio/mpeg',
    'mpga': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'mp4': 'audio/mp4',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
  };

  /// True when [mimeType] (or, as a fallback, the [fileName] extension) is an
  /// accepted audio type.
  static bool isAudioMime({String? mimeType, String? fileName}) {
    final normalized = mimeType?.trim().toLowerCase();
    if (normalized != null && normalized.isNotEmpty) {
      // Match on the base type so `audio/mpeg; codecs=...` still passes.
      final base = normalized.split(';').first.trim();
      if (allowedMimeTypes.contains(base)) return true;
      // Any other audio/* is a soft pass so future bucket additions still work.
      if (base.startsWith('audio/')) return true;
    }
    final resolved = resolveMime(mimeType: mimeType, fileName: fileName);
    return resolved != null;
  }

  /// Resolves the best-effort MIME type from an explicit value or the filename
  /// extension. Returns null when nothing looks like audio.
  static String? resolveMime({String? mimeType, String? fileName}) {
    final normalized = mimeType?.trim().toLowerCase();
    if (normalized != null && normalized.isNotEmpty) {
      final base = normalized.split(';').first.trim();
      if (base.startsWith('audio/')) return base;
    }
    final ext = _extensionOf(fileName);
    if (ext != null) return extensionToMime[ext];
    return null;
  }

  /// Full validation for a file-shared music attachment.
  ///
  /// [durationMs] may be null when the platform picker cannot report it; in that
  /// case the duration check is skipped here and MUST be enforced once real
  /// decode is available (flagged). MIME + size are always enforced.
  static AudioValidationResult validateMusicFile({
    String? mimeType,
    String? fileName,
    int? fileSizeBytes,
    int? durationMs,
  }) {
    if (!isAudioMime(mimeType: mimeType, fileName: fileName)) {
      return const AudioValidationResult.invalid(
        'That file is not a supported audio type. Use MP3, M4A, AAC or OGG.',
      );
    }
    if (fileSizeBytes != null && fileSizeBytes > kMaxAudioFileSizeBytes) {
      return const AudioValidationResult.invalid(
        'Audio file is too large (max 50 MB).',
      );
    }
    return validateDuration(durationMs);
  }

  /// Enforces the 4-minute ceiling. A null/unknown duration passes (it cannot be
  /// checked yet) so the flow is not blocked before real decode lands.
  static AudioValidationResult validateDuration(int? durationMs) {
    if (durationMs != null && durationMs > kMaxAudioDuration.inMilliseconds) {
      return const AudioValidationResult.invalid(
        'Audio is longer than the 4 minute limit.',
      );
    }
    return const AudioValidationResult.valid();
  }

  static String? _extensionOf(String? fileName) {
    final name = fileName?.trim().toLowerCase();
    if (name == null || name.isEmpty || !name.contains('.')) return null;
    final ext = name.split('.').last;
    return ext.isEmpty ? null : ext;
  }
}

// ---------------------------------------------------------------------------
// Staged audio media (the composer's pre-send payload)
// ---------------------------------------------------------------------------

/// Which of the two audio experiences a staged clip represents.
enum StagedAudioKind {
  /// A shared audio *file* — rendered as a music/track bubble.
  music,

  /// A recorded in-chat voice note — rendered as a waveform bubble.
  audioNote,
}

/// An audio clip staged locally and ready to be queued/uploaded. Produced by the
/// file-picker flow or the recorder flow; consumed by the screen when it calls
/// the messages repository.
class StagedAudioMedia {
  const StagedAudioMedia({
    required this.kind,
    required this.localPath,
    required this.mimeType,
    this.fileName,
    this.fileSizeBytes,
    this.durationMs,
    this.title,
  });

  final StagedAudioKind kind;

  /// Absolute path to the file on disk (recorded temp file or copied pick).
  final String localPath;

  /// Resolved audio MIME type (best-effort).
  final String mimeType;

  final String? fileName;
  final int? fileSizeBytes;

  /// Clip length in ms. For recordings this is the measured elapsed time; for
  /// files it is whatever the picker/decoder could report (may be null).
  final int? durationMs;

  /// Track title for a music file (defaults to [fileName] at render time).
  final String? title;

  /// The `messages.message_type` string this clip persists as. Kept in one place
  /// so the mapper and the screen agree on the vocabulary.
  String get messageType =>
      kind == StagedAudioKind.music ? 'music' : 'audio';
}

// ---------------------------------------------------------------------------
// Deterministic waveform sampler (shared by record preview + bubble)
// ---------------------------------------------------------------------------

/// Produces a stable list of [count] bar heights in the 0.15..1.0 range from an
/// integer [seed]. Deterministic (no `dart:math.Random`) so a given clip renders
/// the same bars across rebuilds. Used as a synthetic waveform until a real
/// decode/amplitude source is wired.
List<double> syntheticWaveform({required int seed, int count = 28}) {
  final bars = <double>[];
  for (var i = 0; i < count; i++) {
    var h = (seed ^ (i * 0x9E3779B1)) & 0x7FFFFFFF;
    h = (h ^ (h >> 13)) * 0x5BD1E995;
    final unit = ((h >> 8) & 0xFFFF) / 0xFFFF; // 0..1
    bars.add(0.15 + unit * 0.85);
  }
  return bars;
}

// ---------------------------------------------------------------------------
// Recorder seam (no plugin: abstract only)
// ---------------------------------------------------------------------------

/// Lifecycle of an in-chat recording.
enum AudioRecordingState { idle, recording, paused, stopped, denied, error }

/// Immutable snapshot of a recording session, streamed to the UI.
class AudioRecordingSnapshot {
  const AudioRecordingSnapshot({
    required this.state,
    required this.elapsedMs,
    this.amplitude = 0,
    this.error,
  });

  final AudioRecordingState state;

  /// Elapsed record time in ms (drives the live `m:ss` label and the 4-min cap).
  final int elapsedMs;

  /// Latest normalized input amplitude 0..1 (drives the live bars). 0 when the
  /// backing recorder cannot report levels.
  final double amplitude;

  final String? error;

  bool get isActive =>
      state == AudioRecordingState.recording ||
      state == AudioRecordingState.paused;

  /// True once the elapsed time reaches the 4-minute ceiling; the UI should
  /// auto-stop at this point.
  bool get reachedLimit => elapsedMs >= kMaxAudioDuration.inMilliseconds;
}

/// Abstract controller for capturing an audio note.
///
/// SEAM ONLY — there is no concrete implementation in this build because mic
/// capture needs the `record` plugin (FLAGGED). A concrete controller must:
///   * request mic permission (returning [AudioRecordingState.denied] on refusal)
///   * write to a temp file under the app cache dir
///   * emit [AudioRecordingSnapshot]s on [snapshots]
///   * enforce [kMaxAudioDuration] (auto-stop) and return a [StagedAudioMedia]
///     of kind [StagedAudioKind.audioNote] from [stop].
abstract interface class AudioRecorderController {
  Stream<AudioRecordingSnapshot> get snapshots;
  AudioRecordingSnapshot get value;

  Future<void> start();
  Future<void> pause();
  Future<void> resume();

  /// Stops and finalizes; returns the staged note, or null if nothing usable
  /// was captured.
  Future<StagedAudioMedia?> stop();

  /// Aborts and deletes any partial recording.
  Future<void> cancel();

  Future<void> dispose();
}

/// Thrown by [AudioRecorderFactory.create] when no recorder backend is wired,
/// so callers can present a clear "recording needs a backend" message instead
/// of failing silently.
class AudioRecorderUnavailable implements Exception {
  const AudioRecorderUnavailable([this.message = _default]);

  static const String _default =
      'In-chat recording needs the audio recorder package (record) to be '
      'added to the app.';

  final String message;

  @override
  String toString() => message;
}

/// Indirection point for obtaining a recorder. Defaults to unavailable; a real
/// build assigns [instance] to a concrete factory. Kept as a settable static so
/// wiring a plugin later requires ZERO changes to the UI layer.
class AudioRecorderFactory {
  AudioRecorderFactory._();

  /// Assign a concrete factory once a recorder plugin is added. When null,
  /// [create] throws [AudioRecorderUnavailable].
  static Future<AudioRecorderController> Function()? instance;

  static bool get isAvailable => instance != null;

  static Future<AudioRecorderController> create() {
    final factory = instance;
    if (factory == null) {
      throw const AudioRecorderUnavailable();
    }
    return factory();
  }
}

// ---------------------------------------------------------------------------
// Playback seam (no plugin: abstract only)
// ---------------------------------------------------------------------------

/// Immutable playback snapshot for an audio bubble.
class AudioPlaybackSnapshot {
  const AudioPlaybackSnapshot({
    required this.isPlaying,
    required this.positionMs,
    required this.durationMs,
  });

  const AudioPlaybackSnapshot.stopped()
    : isPlaying = false,
      positionMs = 0,
      durationMs = 0;

  final bool isPlaying;
  final int positionMs;
  final int durationMs;
}

/// Abstract per-clip player used by the music + audio-note bubbles.
///
/// SEAM ONLY — a concrete player needs `just_audio` or `audioplayers` (FLAGGED).
/// `video_player` can play remote audio URLs as a stopgap but is not wired here.
abstract interface class AudioPlaybackController {
  Stream<AudioPlaybackSnapshot> get snapshots;
  AudioPlaybackSnapshot get value;

  Future<void> playPause();
  Future<void> seek(int positionMs);
  Future<void> stop();
  Future<void> dispose();
}

/// Thrown when playback is requested but no player backend is wired.
class AudioPlayerUnavailable implements Exception {
  const AudioPlayerUnavailable([this.message = _default]);

  static const String _default =
      'Audio playback needs an audio player package (just_audio / audioplayers) '
      'to be added to the app.';

  final String message;

  @override
  String toString() => message;
}

/// Indirection point for obtaining a player for a given source. Defaults to
/// unavailable; a real build assigns [instance].
class AudioPlayerFactory {
  AudioPlayerFactory._();

  /// Assign a concrete factory once a player plugin is added. Receives the local
  /// path (preferred) and/or remote URL of the clip.
  static Future<AudioPlaybackController> Function({
    String? localPath,
    String? remoteUrl,
  })?
  instance;

  static bool get isAvailable => instance != null;

  static Future<AudioPlaybackController> create({
    String? localPath,
    String? remoteUrl,
  }) {
    final factory = instance;
    if (factory == null) {
      throw const AudioPlayerUnavailable();
    }
    return factory(localPath: localPath, remoteUrl: remoteUrl);
  }
}

// ===========================================================================
// FLAGGED DEPS / BACKEND GAPS (not made — build against seams above):
//
// 1. RECORDER: mic capture requires the `record` package. Wire it by assigning
//    AudioRecorderFactory.instance to a concrete AudioRecorderController.
//
// 2. PLAYER: seek-accurate playback requires `just_audio` (or `audioplayers`).
//    Wire it by assigning AudioPlayerFactory.instance. `video_player` (already
//    in pubspec) can play remote audio URLs as a stopgap.
//
// 3. FILE PICKER: choosing an audio FILE requires `file_picker` (image_picker
//    cannot pick arbitrary audio files). Until then the music-share entry point
//    surfaces a clear "needs backend" message.
//
// 4. DURATION DECODE: neither image_picker nor a raw file gives a reliable clip
//    duration. Real duration must come from the recorder (measured) or a decode
//    step (just_audio.setFilePath -> duration). validateDuration() is a no-op
//    on a null duration by design.
//
// 5. STORAGE MIME: the `message-media` bucket (20260627143100 migration) allows
//    audio/aac, audio/mpeg, audio/mp4, audio/ogg — but NOT audio/wav or
//    audio/webm. A recorder should target one of the allowed types (e.g. AAC in
//    an .m4a/audio/mp4 container) or the bucket's allowed_mime_types must be
//    widened.
//
// 6. ATTACHMENT PERSISTENCE: LocalMessagesRepositoryContract.queueAttachment()
//    (in core/, out of this feature's write scope) has no `durationMs` / title
//    parameter, so message_attachments.duration_ms is not populated by the
//    upload path. This feature persists duration/title locally via
//    LocalMessage.durationMs/musicTitle + upsertMessage as a bridge; the queue
//    /upload contract should gain a durationMs (and optional title) parameter to
//    round-trip through message_attachments.
// ===========================================================================
