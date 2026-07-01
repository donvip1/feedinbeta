import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:path_provider/path_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'parity/story_extras_models.dart';

/// Publishes the three "extra" story kinds (text / audio note / music) directly
/// to the real `stories` table + `post-media` storage.
///
/// WHY A SEPARATE PATH (not the offline upload queue):
///   The shared `PostDraft` model + `UploadQueueService` (both OUTSIDE this
///   feature's write scope) only carry caption + media paths/types. They cannot
///   represent a text background, an audio track, or attached-music metadata,
///   and `UploadQueueService._publishStoryDraft` hard-requires a media URL.
///   Rather than reach across scope, this feature owns a small, self-contained
///   publisher for the new kinds. The classic photo/video story keeps using the
///   queue untouched.
///
/// BACKEND MAPPING (against the current schema — see the flagged gaps in the
/// report and `story_extras_models.dart`):
///   * TEXT  : rendered to a 1080x1920 PNG on-device, uploaded to `post-media`,
///             inserted as `media_type='image'` with the typed text as
///             `caption`. (No `type`/`background` column yet — the background id
///             is embedded in the storage path so it can be recovered, and the
///             render is self-describing.)
///   * AUDIO : the audio file is uploaded and its URL stored in `music_url`
///             (the only audio-capable text column today); a generated cover
///             card satisfies the NOT NULL `media_url`. `music_title` marks it
///             as a voice note.
///   * MUSIC : same as a text/cover story but with the user's own track in
///             `music_url` + `music_title`/`music_artist`.
///
/// Everything here is I/O-owning and injectable so the UI stays presentational.
class StoryPublisher {
  StoryPublisher({SupabaseClient? client, this.audioSource})
    : _injectedClient = client;

  final SupabaseClient? _injectedClient;

  /// Optional recorder / file-picker / duration seam. Null => audio & music
  /// kinds are unavailable (the sheet disables them). See [StoryAudioSource].
  final StoryAudioSource? audioSource;

  static const _uuid = Uuid();

  /// Public bucket that already exists and accepts image/png (the rendered
  /// cover for text/audio/music stories). Same bucket the post/queue path uses.
  static const String _mediaBucket = 'post-media';

  /// FLAGGED: no audio-capable PUBLIC bucket exists. `message-media` allows
  /// audio but is PRIVATE (messaging-scoped). We attempt this bucket for the
  /// audio blob and surface a clear error if it is missing/denied so the gap is
  /// visible rather than silent. Swap to a dedicated public `story-audio`
  /// bucket once the backend adds one.
  static const String _audioBucket = 'story-audio';

  SupabaseClient get _client => _injectedClient ?? Supabase.instance.client;

  bool get _isConfigured {
    if (_injectedClient != null) return true;
    try {
      // Touching the instance throws if Supabase was never initialised.
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  bool get canUseAudio => audioSource != null;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /// Publishes a text-only story on [background]. Returns a human-readable
  /// success message; throws [StoryPublishException] on any failure.
  Future<String> publishTextStory({
    required String text,
    required StoryBackground background,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      throw const StoryPublishException('Write something for your story first.');
    }
    if (trimmed.length > kMaxStoryTextLength) {
      throw StoryPublishException(
        'Keep it under $kMaxStoryTextLength characters.',
      );
    }

    final userId = _requireUser();
    final coverBytes = await renderTextCard(
      text: trimmed,
      background: background,
    );
    final coverUrl = await _uploadCover(
      userId: userId,
      bytes: coverBytes,
      backgroundId: background.id,
    );

    await _insertStory(
      userId: userId,
      mediaUrl: coverUrl,
      mediaType: 'image',
      caption: trimmed,
    );
    return 'Text story published.';
  }

  /// Publishes an audio-note story from [attachment] (source: recorded).
  /// [text] is an optional overlay caption. A gradient cover card is generated
  /// so the NOT NULL media_url is satisfied.
  Future<String> publishAudioStory({
    required AudioAttachment attachment,
    StoryBackground? background,
    String? text,
  }) async {
    final userId = _requireUser();
    _assertAudioWithinLimit(attachment);

    final bg = background ?? StoryBackgroundPalette.defaults.first;
    final caption = (text ?? '').trim();
    final coverBytes = await renderTextCard(
      text: caption.isEmpty ? '🎙️  Audio note' : caption,
      background: bg,
      badge: 'AUDIO',
    );
    final coverUrl = await _uploadCover(
      userId: userId,
      bytes: coverBytes,
      backgroundId: bg.id,
    );
    final audioUrl = await _uploadAudio(userId: userId, attachment: attachment);

    await _insertStory(
      userId: userId,
      mediaUrl: coverUrl,
      mediaType: 'image',
      caption: caption.isEmpty ? null : caption,
      musicUrl: audioUrl,
      musicTitle: 'Audio note',
    );
    return 'Audio note published.';
  }

  /// Publishes a story with the user's OWN music [attachment] over a cover card
  /// (or an existing [coverUrl]/[coverBytes] if the caller already has media).
  Future<String> publishMusicStory({
    required AudioAttachment attachment,
    required StoryBackground background,
    String? text,
  }) async {
    final userId = _requireUser();
    _assertAudioWithinLimit(attachment);

    final caption = (text ?? '').trim();
    final coverBytes = await renderTextCard(
      text: caption.isEmpty ? (attachment.title ?? '🎵  Music') : caption,
      background: background,
      badge: 'MUSIC',
      subtitle: attachment.artist,
    );
    final coverUrl = await _uploadCover(
      userId: userId,
      bytes: coverBytes,
      backgroundId: background.id,
    );
    final audioUrl = await _uploadAudio(userId: userId, attachment: attachment);

    await _insertStory(
      userId: userId,
      mediaUrl: coverUrl,
      mediaType: 'image',
      caption: caption.isEmpty ? null : caption,
      musicUrl: audioUrl,
      musicTitle: attachment.title ?? 'My track',
      musicArtist: attachment.artist,
    );
    return 'Music story published.';
  }

  /// Validates a picked/recorded audio file against the mime + 4-min rules,
  /// probing duration through the injected seam when possible.
  Future<AudioValidation> validateAudio(AudioAttachment attachment) async {
    if (!isAcceptedAudio(
      mimeType: attachment.mimeType,
      path: attachment.path,
    )) {
      return const AudioValidation.rejected(
        'That file is not a supported audio type.',
      );
    }

    var seconds = attachment.durationSeconds;
    seconds ??= await audioSource?.probeDurationSeconds(attachment.path);

    if (seconds != null && seconds > kMaxStoryMusicDuration.inSeconds) {
      return AudioValidation(
        isAccepted: false,
        durationSeconds: seconds,
        reason: 'Audio must be 4 minutes or less.',
      );
    }
    return AudioValidation(isAccepted: true, durationSeconds: seconds);
  }

  // -------------------------------------------------------------------------
  // Rendering (text -> PNG). Pure-SDK (dart:ui); no packages.
  // -------------------------------------------------------------------------

  /// Renders [text] centered on [background] to a 1080x1920 (9:16) PNG and
  /// returns the encoded bytes. Used for text stories and as the cover for
  /// audio/music stories. Exposed for testing / preview reuse.
  Future<Uint8List> renderTextCard({
    required String text,
    required StoryBackground background,
    String? badge,
    String? subtitle,
  }) async {
    const width = 1080.0;
    const height = 1920.0;
    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(
      recorder,
      const ui.Rect.fromLTWH(0, 0, width, height),
    );

    // Background gradient fill.
    final rect = const ui.Rect.fromLTWH(0, 0, width, height);
    final shader = background.gradient.createShader(rect);
    canvas.drawRect(rect, ui.Paint()..shader = shader);

    // Optional badge chip (AUDIO / MUSIC) near the top.
    if (badge != null) {
      final badgePainter = TextPainter(
        text: TextSpan(
          text: badge,
          style: const TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 34,
            fontWeight: FontWeight.w800,
            letterSpacing: 3,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: width - 160);
      badgePainter.paint(
        canvas,
        Offset((width - badgePainter.width) / 2, 160),
      );
    }

    // Main text, wrapped and centered.
    final textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(
          color: Color(0xFFFFFFFF),
          fontSize: 88,
          height: 1.25,
          fontWeight: FontWeight.w800,
          shadows: [
            Shadow(
              color: Color(0x66000000),
              blurRadius: 16,
              offset: Offset(0, 4),
            ),
          ],
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      maxLines: 12,
      ellipsis: '…',
    )..layout(maxWidth: width - 160);
    textPainter.paint(
      canvas,
      Offset((width - textPainter.width) / 2, (height - textPainter.height) / 2),
    );

    // Optional subtitle (music artist) below the main text.
    if (subtitle != null && subtitle.trim().isNotEmpty) {
      final subPainter = TextPainter(
        text: TextSpan(
          text: subtitle.trim(),
          style: const TextStyle(
            color: Color(0xCCFFFFFF),
            fontSize: 40,
            fontWeight: FontWeight.w600,
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        maxLines: 2,
        ellipsis: '…',
      )..layout(maxWidth: width - 200);
      subPainter.paint(
        canvas,
        Offset(
          (width - subPainter.width) / 2,
          (height + textPainter.height) / 2 + 32,
        ),
      );
    }

    final picture = recorder.endRecording();
    final image = await picture.toImage(width.toInt(), height.toInt());
    try {
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) {
        throw const StoryPublishException('Could not render the story card.');
      }
      return data.buffer.asUint8List();
    } finally {
      image.dispose();
      picture.dispose();
    }
  }

  // -------------------------------------------------------------------------
  // Storage + insert
  // -------------------------------------------------------------------------

  Future<String> _uploadCover({
    required String userId,
    required Uint8List bytes,
    required String backgroundId,
  }) async {
    // Embed the kind + background id in the path so the render is recoverable
    // even without a schema `background` column (see flagged gap).
    final path =
        '$userId/stories/text_${backgroundId}_${DateTime.now().millisecondsSinceEpoch}_${_uuid.v4()}.png';
    try {
      await _client.storage
          .from(_mediaBucket)
          .uploadBinary(
            path,
            bytes,
            fileOptions: const FileOptions(
              contentType: 'image/png',
              upsert: true,
            ),
          );
      return _client.storage.from(_mediaBucket).getPublicUrl(path);
    } catch (error) {
      throw StoryPublishException(_clean(error));
    }
  }

  Future<String> _uploadAudio({
    required String userId,
    required AudioAttachment attachment,
  }) async {
    final file = File(attachment.path);
    if (!file.existsSync()) {
      throw const StoryPublishException('The audio file is no longer available.');
    }
    final ext = attachment.path.contains('.')
        ? attachment.path.split('.').last.toLowerCase()
        : 'm4a';
    final path =
        '$userId/stories/audio_${DateTime.now().millisecondsSinceEpoch}_${_uuid.v4()}.$ext';
    try {
      await _client.storage
          .from(_audioBucket)
          .upload(
            path,
            file,
            fileOptions: FileOptions(
              contentType: attachment.mimeType ?? _audioContentType(ext),
              upsert: true,
            ),
          );
      return _client.storage.from(_audioBucket).getPublicUrl(path);
    } catch (error) {
      // Make the missing-bucket gap explicit instead of a raw storage error.
      throw StoryPublishException(
        'Could not store the audio. A public "$_audioBucket" bucket may not '
        'exist yet. (${_clean(error)})',
      );
    }
  }

  Future<void> _insertStory({
    required String userId,
    required String mediaUrl,
    required String mediaType,
    String? caption,
    String? musicUrl,
    String? musicTitle,
    String? musicArtist,
  }) async {
    final row = <String, Object?>{
      'user_id': userId,
      'media_url': mediaUrl,
      'media_type': mediaType,
      if (caption != null) 'caption': caption,
      if (musicUrl != null) 'music_url': musicUrl,
      if (musicTitle != null) 'music_title': musicTitle,
      if (musicArtist != null) 'music_artist': musicArtist,
    };
    try {
      await _client.from('stories').insert(row);
    } catch (error) {
      throw StoryPublishException(_clean(error));
    }
  }

  /// Persist rendered cover bytes to a temp file (for optional local preview /
  /// draft reuse). Not required for publishing but handy for the sheet preview.
  Future<String> writeTempCover(Uint8List bytes) async {
    final dir = await getTemporaryDirectory();
    final storyDir = Directory('${dir.path}/feedin_story_covers');
    if (!storyDir.existsSync()) storyDir.createSync(recursive: true);
    final file = File(
      '${storyDir.path}/${DateTime.now().millisecondsSinceEpoch}_${_uuid.v4()}.png',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  String _requireUser() {
    if (!_isConfigured) {
      throw const StoryPublishException(
        'Sign-in is unavailable right now. Try again once connected.',
      );
    }
    final id = _client.auth.currentUser?.id;
    if (id == null) {
      throw const StoryPublishException('Sign in to publish a story.');
    }
    return id;
  }

  void _assertAudioWithinLimit(AudioAttachment attachment) {
    final secs = attachment.durationSeconds;
    if (secs != null && secs > kMaxStoryMusicDuration.inSeconds) {
      throw const StoryPublishException('Audio must be 4 minutes or less.');
    }
  }

  String _audioContentType(String ext) {
    switch (ext) {
      case 'mp3':
        return 'audio/mpeg';
      case 'aac':
        return 'audio/aac';
      case 'm4a':
      case 'mp4':
        return 'audio/mp4';
      case 'ogg':
      case 'oga':
        return 'audio/ogg';
      case 'wav':
        return 'audio/wav';
      case 'weba':
      case 'webm':
        return 'audio/webm';
      default:
        return 'audio/mpeg';
    }
  }

  String _clean(Object error) {
    return error
        .toString()
        .replaceFirst('PostgrestException(message: ', '')
        .replaceFirst('StorageException(message: ', '')
        .replaceFirst(RegExp(r', code: .*'), '')
        .replaceFirst(RegExp(r', statusCode: .*'), '')
        .replaceFirst(RegExp(r'\)$'), '');
  }
}

/// Failure raised by [StoryPublisher] with a cleaned, user-facing [message].
class StoryPublishException implements Exception {
  const StoryPublishException(this.message);

  final String message;

  @override
  String toString() => message;
}
