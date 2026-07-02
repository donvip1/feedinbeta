import 'package:file_picker/file_picker.dart';
import 'package:flutter/widgets.dart';

import '../../messages/chat/audio_backends_impl.dart';
import '../../messages/chat/widgets/audio_note_recorder_sheet.dart';
import 'story_extras_models.dart';

/// Concrete [StoryAudioSource] powering the audio-note and music story kinds.
///
/// Injected into [StoryPublisher] at app start (see the create-screen wiring),
/// this flips `canUseAudio` on so the story composer enables the AUDIO and MUSIC
/// options instead of showing the "needs setup" note. The publisher's upload +
/// insert path is unchanged — this only provides the on-device file + duration.
///
///  * [recordAudioNote] — reuses the shared in-app voice-note recorder sheet
///    (backed by `record`), returning the finished clip.
///  * [pickAudioFile]   — opens the system audio picker via `file_picker`.
///  * [probeDurationSeconds] — decodes duration via `just_audio` for the 4-min
///    gate (the file picker cannot report duration).
class DeviceStoryAudioSource implements StoryAudioSource {
  const DeviceStoryAudioSource({required this.contextProvider});

  /// Supplies a live, mounted context for presenting the recorder sheet. The
  /// create screen passes `() => context`; recordAudioNote is only invoked while
  /// its composer sheet is open, so the context is valid.
  final BuildContext Function() contextProvider;

  @override
  Future<AudioAttachment?> recordAudioNote() async {
    final staged = await showAudioNoteRecorderSheet(contextProvider());
    if (staged == null) return null;
    return AudioAttachment(
      path: staged.localPath,
      source: AudioSourceKind.recorded,
      mimeType: staged.mimeType,
      durationSeconds:
          staged.durationMs == null ? null : (staged.durationMs! / 1000).round(),
    );
  }

  @override
  Future<AudioAttachment?> pickAudioFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.audio,
        withData: false,
      );
      final picked = result?.files.singleOrNull;
      final path = picked?.path;
      if (path == null || path.isEmpty) return null;
      final ext = picked!.extension?.toLowerCase();
      final durationMs = await probeAudioDurationMs(path);
      return AudioAttachment(
        path: path,
        source: AudioSourceKind.pickedFile,
        mimeType: _mimeForExtension(ext),
        durationSeconds: durationMs == null ? null : (durationMs / 1000).round(),
        title: _titleFromName(picked.name),
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<int?> probeDurationSeconds(String path) async {
    final ms = await probeAudioDurationMs(path);
    return ms == null ? null : (ms / 1000).round();
  }

  static String? _mimeForExtension(String? ext) {
    switch (ext) {
      case 'mp3':
      case 'mpeg':
      case 'mpga':
        return 'audio/mpeg';
      case 'm4a':
      case 'mp4':
        return 'audio/mp4';
      case 'aac':
        return 'audio/aac';
      case 'ogg':
      case 'oga':
        return 'audio/ogg';
      default:
        return null;
    }
  }

  static String _titleFromName(String name) {
    final dot = name.lastIndexOf('.');
    final base = dot > 0 ? name.substring(0, dot) : name;
    return base.trim().isEmpty ? 'Audio track' : base.trim();
  }
}
