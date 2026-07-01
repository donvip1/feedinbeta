import 'package:flutter/widgets.dart';

/// View-models + value objects for the three "extra" story kinds that the web
/// `CreateStoryModal` (and the plan's Stories §C) call for but the native media
/// composer could not previously produce:
///
///   1. [StoryComposerKind.text]  — a text-only story on a gradient/solid
///      background (no uploaded media), like the web text-story option.
///   2. [StoryComposerKind.audio] — an audio-only "audio note" story.
///   3. [StoryComposerKind.music] — any media/text story with the user's OWN
///      music file attached (validated <= [kMaxStoryMusicDuration]).
///
/// These are deliberately decoupled from persistence: the sheet renders them and
/// emits intent through callbacks; `StoryPublisher` maps them onto the real
/// `stories` table + `post-media` storage. Depends only on the Flutter
/// foundation/widgets libraries so it analyzes cleanly on its own.
///
/// NOTE (backend gap, flagged not made): the current `stories` schema
/// (20260624000900_native_stories_schema.sql) has no `type`, `background`, or
/// `audio_url` column and no audio-capable public bucket. Until those exist we
/// fit these kinds onto the existing columns — see `story_publisher.dart` for
/// the exact mapping and the seams that light up once the columns/bucket land.

// ===========================================================================
// Kinds
// ===========================================================================

/// Which "extra" story the composer is building. The classic photo/video story
/// keeps flowing through the offline upload queue in `create_post_screen.dart`;
/// these three are published directly by `StoryPublisher`.
enum StoryComposerKind { text, audio, music }

extension StoryComposerKindX on StoryComposerKind {
  String get label {
    switch (this) {
      case StoryComposerKind.text:
        return 'Text';
      case StoryComposerKind.audio:
        return 'Audio note';
      case StoryComposerKind.music:
        return 'Music';
    }
  }

  String get helper {
    switch (this) {
      case StoryComposerKind.text:
        return 'Write on a gradient — no photo needed';
      case StoryComposerKind.audio:
        return 'Share a voice moment for 24 hours';
      case StoryComposerKind.music:
        return 'Attach your own track (up to 4 min)';
    }
  }
}

// ===========================================================================
// Limits & validation (ports of the web modal's rules)
// ===========================================================================

/// Max duration for a user-attached music file / audio note. Plan §C and the
/// messaging §A both cap audio at 4 minutes.
const Duration kMaxStoryMusicDuration = Duration(minutes: 4);

/// Hard cap on text-story characters so the rendered card stays legible.
const int kMaxStoryTextLength = 280;

/// Audio MIME types we accept for music attachments / audio notes. Mirrors the
/// `message-media` bucket whitelist (the only existing audio-capable bucket) so
/// that whichever bucket the backend wires up, these validate against a known
/// set rather than a guess.
const Set<String> kAcceptedAudioMimeTypes = {
  'audio/aac',
  'audio/mpeg', // mp3
  'audio/mp3',
  'audio/mp4', // m4a
  'audio/x-m4a',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
};

/// File extensions that map to accepted audio (fallback when a picker gives no
/// MIME type — e.g. a bare `XFile.path`).
const Set<String> kAcceptedAudioExtensions = {
  'aac',
  'mp3',
  'm4a',
  'mp4',
  'ogg',
  'oga',
  'wav',
  'weba',
};

/// True when [mimeType]/[path] name an accepted audio file. Either signal is
/// enough; both are checked because platform pickers are inconsistent.
bool isAcceptedAudio({String? mimeType, String? path}) {
  final mime = mimeType?.toLowerCase().trim();
  if (mime != null && kAcceptedAudioMimeTypes.contains(mime)) return true;
  final p = path?.toLowerCase();
  if (p != null && p.contains('.')) {
    final ext = p.split('.').last;
    if (kAcceptedAudioExtensions.contains(ext)) return true;
  }
  return false;
}

/// Result of validating a picked audio file against the mime + duration rules.
/// [durationSeconds] may be null when the platform could not probe it (no audio
/// dep is bundled — see the flagged gap); callers should treat null as
/// "unverified, allow with a warning" rather than a hard reject so the flow is
/// usable before the duration dep lands.
@immutable
class AudioValidation {
  const AudioValidation({
    required this.isAccepted,
    this.durationSeconds,
    this.reason,
  });

  final bool isAccepted;
  final int? durationSeconds;

  /// Non-null when [isAccepted] is false: a user-facing explanation.
  final String? reason;

  bool get durationUnknown => durationSeconds == null;

  bool get exceedsLimit =>
      durationSeconds != null &&
      durationSeconds! > kMaxStoryMusicDuration.inSeconds;

  const AudioValidation.rejected(String this.reason)
    : isAccepted = false,
      durationSeconds = null;
}

// ===========================================================================
// Gradient / solid backgrounds (web text-story parity)
// ===========================================================================

/// A named background for a text story: either a two-stop gradient or a solid
/// fill (represented as a gradient with two equal colors so rendering is
/// uniform). Pure data — the render lives in `story_publisher.dart`.
@immutable
class StoryBackground {
  const StoryBackground({
    required this.id,
    required this.label,
    required this.colors,
  });

  /// Stable id persisted alongside the story so a viewer could re-theme later
  /// (also used as the selection key in the palette strip).
  final String id;
  final String label;

  /// Top-left -> bottom-right gradient stops. A solid uses the same color twice.
  final List<Color> colors;

  LinearGradient get gradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: colors,
  );

  /// The dominant color (first stop) — handy for chips/thumbnails.
  Color get primary => colors.first;
}

/// The default background palette offered in the text-story editor. Values
/// echo the app's brand gradients (see [CreateGradients]) plus a few popular
/// social-story fills so users have real choice without a full color wheel.
class StoryBackgroundPalette {
  const StoryBackgroundPalette._();

  static const List<StoryBackground> defaults = [
    StoryBackground(
      id: 'brand',
      label: 'Brand',
      colors: [Color(0xFFF04299), Color(0xFFBB67E4)],
    ),
    StoryBackground(
      id: 'sunset',
      label: 'Sunset',
      colors: [Color(0xFFFF3399), Color(0xFFFF7733)],
    ),
    StoryBackground(
      id: 'ocean',
      label: 'Ocean',
      colors: [Color(0xFF3B82F6), Color(0xFF06B6D4)],
    ),
    StoryBackground(
      id: 'grape',
      label: 'Grape',
      colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
    ),
    StoryBackground(
      id: 'forest',
      label: 'Forest',
      colors: [Color(0xFF10B981), Color(0xFF059669)],
    ),
    StoryBackground(
      id: 'midnight',
      label: 'Midnight',
      colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
    ),
    StoryBackground(
      id: 'ember',
      label: 'Ember',
      colors: [Color(0xFFEF4444), Color(0xFFF59E0B)],
    ),
    StoryBackground(
      id: 'ink',
      label: 'Ink',
      colors: [Color(0xFF000000), Color(0xFF000000)],
    ),
  ];

  static StoryBackground byId(String? id) {
    for (final bg in defaults) {
      if (bg.id == id) return bg;
    }
    return defaults.first;
  }
}

// ===========================================================================
// Audio attachment seam
// ===========================================================================

/// Where an [AudioAttachment] came from — drives copy + the flagged dep note.
enum AudioSourceKind { recorded, pickedFile }

/// A resolved on-device audio file ready to be published. Produced either by a
/// recorder seam (audio notes) or a file picker (music attachment). Carries the
/// probed duration when known so the publisher can enforce the 4-min cap.
@immutable
class AudioAttachment {
  const AudioAttachment({
    required this.path,
    required this.source,
    this.mimeType,
    this.durationSeconds,
    this.title,
    this.artist,
  });

  final String path;
  final AudioSourceKind source;
  final String? mimeType;
  final int? durationSeconds;

  /// Display metadata for a music attachment (audio notes leave these null).
  final String? title;
  final String? artist;

  bool get durationKnown => durationSeconds != null;

  String? get durationLabel {
    final secs = durationSeconds;
    if (secs == null || secs <= 0) return null;
    final m = secs ~/ 60;
    final s = secs % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  AudioAttachment copyWith({
    int? durationSeconds,
    String? title,
    String? artist,
  }) {
    return AudioAttachment(
      path: path,
      source: source,
      mimeType: mimeType,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      title: title ?? this.title,
      artist: artist ?? this.artist,
    );
  }
}

/// Seam the app injects so this feature never depends directly on a recorder or
/// file-picker package (none are bundled — see the flagged deps). The screen
/// passes a concrete implementation; when absent the composer disables the
/// relevant kinds and shows the "needs setup" note instead of crashing.
///
/// * [recordAudioNote] — start/stop a mic recording, returning the finished
///   file (or null if cancelled). Needs a recorder dep (e.g. `record`).
/// * [pickAudioFile] — open a system file picker filtered to audio, returning
///   the chosen file (or null). Needs `file_picker` (image_picker cannot select
///   arbitrary audio).
/// * [probeDurationSeconds] — read a clip's duration for the 4-min gate. Needs
///   an audio/metadata dep (e.g. `just_audio` / `audioplayers`).
abstract class StoryAudioSource {
  Future<AudioAttachment?> recordAudioNote();
  Future<AudioAttachment?> pickAudioFile();
  Future<int?> probeDurationSeconds(String path);
}
