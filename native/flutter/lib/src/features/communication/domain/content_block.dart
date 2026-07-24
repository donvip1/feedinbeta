import 'result.dart';

/// Every message on every surface (DM, group, community, channel, broadcast,
/// call event, system event) carries exactly one [ContentBlock]. This union +
/// [validate] replaces the old text-vs-media send-path fork: the pipeline treats
/// all content uniformly and only the block's own [validate]/[toJson] differ.
sealed class ContentBlock {
  const ContentBlock();

  ContentBlockKind get kind;

  /// Structural validation performed before a message enters the outbox.
  Result<void> validate();

  Map<String, Object?> toJson();

  static const int maxTextLength = 8192;

  /// Reconstruct a block from its wire form. Unknown kinds degrade to an
  /// [UnsupportedBlock] so a newer sender never crashes an older client.
  factory ContentBlock.fromJson(Map<String, Object?> json) {
    final kind = ContentBlockKind.values.firstWhere(
      (k) => k.name == json['kind'],
      orElse: () => ContentBlockKind.unsupported,
    );
    return switch (kind) {
      ContentBlockKind.text => TextBlock(json['text']?.toString() ?? ''),
      ContentBlockKind.sticker =>
        StickerBlock(json['stickerId']?.toString() ?? ''),
      ContentBlockKind.image => ImageBlock(MediaRef.fromJson(json)),
      ContentBlockKind.video => VideoBlock(
        MediaRef.fromJson(json),
        durationMs: (json['durationMs'] as num?)?.toInt() ?? 0,
      ),
      ContentBlockKind.voiceNote => VoiceNoteBlock(
        MediaRef.fromJson(json),
        durationMs: (json['durationMs'] as num?)?.toInt() ?? 0,
      ),
      ContentBlockKind.file => FileBlock(
        MediaRef.fromJson(json),
        fileName: json['fileName']?.toString() ?? 'file',
      ),
      ContentBlockKind.poll => PollBlock(
        question: json['question']?.toString() ?? '',
        options:
            (json['options'] as List?)?.map((e) => e.toString()).toList() ??
            const [],
        multiple: json['multiple'] == true,
      ),
      ContentBlockKind.systemEvent =>
        SystemEventBlock(json['event']?.toString() ?? 'unknown'),
      ContentBlockKind.callEvent => CallEventBlock(
        callId: json['callId']?.toString() ?? '',
        outcome: json['outcome']?.toString() ?? 'unknown',
        durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      ),
      _ => UnsupportedBlock(json),
    };
  }
}

enum ContentBlockKind {
  text,
  sticker,
  image,
  video,
  voiceNote,
  videoNote,
  gif,
  file,
  location,
  poll,
  systemEvent,
  callEvent,
  payment,
  unsupported,
}

/// A reference to a media object — a local path and/or remote URL plus the
/// integrity hash and byte size the Media Engine verifies against.
class MediaRef {
  const MediaRef({
    this.localPath,
    this.remoteUrl,
    this.sha256,
    this.sizeBytes = 0,
    this.mimeType,
    this.width,
    this.height,
  });

  final String? localPath;
  final String? remoteUrl;
  final String? sha256;
  final int sizeBytes;
  final String? mimeType;
  final int? width;
  final int? height;

  bool get isUploaded => (remoteUrl?.isNotEmpty ?? false);

  Map<String, Object?> toJson() => {
    if (localPath != null) 'localPath': localPath,
    if (remoteUrl != null) 'remoteUrl': remoteUrl,
    if (sha256 != null) 'sha256': sha256,
    'sizeBytes': sizeBytes,
    if (mimeType != null) 'mimeType': mimeType,
    if (width != null) 'width': width,
    if (height != null) 'height': height,
  };

  factory MediaRef.fromJson(Map<String, Object?> json) => MediaRef(
    localPath: json['localPath']?.toString(),
    remoteUrl: json['remoteUrl']?.toString(),
    sha256: json['sha256']?.toString(),
    sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
    mimeType: json['mimeType']?.toString(),
    width: (json['width'] as num?)?.toInt(),
    height: (json['height'] as num?)?.toInt(),
  );

  Result<void> validate() {
    if ((localPath == null || localPath!.isEmpty) && !isUploaded) {
      return Err(CommError.validation('Media has neither a local path nor URL'));
    }
    return const Ok(null);
  }
}

/// Implemented by every block that carries a [MediaRef], so the media pipeline
/// can read the local source and swap in the uploaded reference without
/// knowing the concrete block type.
abstract interface class MediaContentBlock {
  MediaRef get media;

  /// A copy of this block pointing at [media] (used after upload+verify to
  /// replace the local path with the remote path + integrity hash).
  ContentBlock withMedia(MediaRef media);
}

class TextBlock extends ContentBlock {
  const TextBlock(this.text);
  final String text;

  @override
  ContentBlockKind get kind => ContentBlockKind.text;

  @override
  Result<void> validate() {
    if (text.trim().isEmpty) {
      return Err(CommError.validation('Text message is empty'));
    }
    if (text.length > ContentBlock.maxTextLength) {
      return Err(CommError.validation('Text exceeds max length'));
    }
    return const Ok(null);
  }

  @override
  Map<String, Object?> toJson() => {'kind': kind.name, 'text': text};
}

class StickerBlock extends ContentBlock {
  const StickerBlock(this.stickerId);
  final String stickerId;

  @override
  ContentBlockKind get kind => ContentBlockKind.sticker;

  @override
  Result<void> validate() => stickerId.isEmpty
      ? Err(CommError.validation('Sticker id is empty'))
      : const Ok(null);

  @override
  Map<String, Object?> toJson() => {'kind': kind.name, 'stickerId': stickerId};
}

class ImageBlock extends ContentBlock implements MediaContentBlock {
  const ImageBlock(this.media);
  @override
  final MediaRef media;

  @override
  ContentBlockKind get kind => ContentBlockKind.image;

  @override
  Result<void> validate() => media.validate();

  @override
  ContentBlock withMedia(MediaRef media) => ImageBlock(media);

  @override
  Map<String, Object?> toJson() => {'kind': kind.name, ...media.toJson()};
}

class VideoBlock extends ContentBlock implements MediaContentBlock {
  const VideoBlock(this.media, {this.durationMs = 0});
  @override
  final MediaRef media;
  final int durationMs;

  @override
  ContentBlockKind get kind => ContentBlockKind.video;

  @override
  Result<void> validate() => media.validate();

  @override
  ContentBlock withMedia(MediaRef media) =>
      VideoBlock(media, durationMs: durationMs);

  @override
  Map<String, Object?> toJson() => {
    'kind': kind.name,
    'durationMs': durationMs,
    ...media.toJson(),
  };
}

class VoiceNoteBlock extends ContentBlock implements MediaContentBlock {
  const VoiceNoteBlock(this.media, {this.durationMs = 0});
  @override
  final MediaRef media;
  final int durationMs;

  @override
  ContentBlockKind get kind => ContentBlockKind.voiceNote;

  @override
  Result<void> validate() {
    if (durationMs <= 0) {
      return Err(CommError.validation('Voice note has no duration'));
    }
    return media.validate();
  }

  @override
  ContentBlock withMedia(MediaRef media) =>
      VoiceNoteBlock(media, durationMs: durationMs);

  @override
  Map<String, Object?> toJson() => {
    'kind': kind.name,
    'durationMs': durationMs,
    ...media.toJson(),
  };
}

class FileBlock extends ContentBlock implements MediaContentBlock {
  const FileBlock(this.media, {required this.fileName});
  @override
  final MediaRef media;
  final String fileName;

  @override
  ContentBlockKind get kind => ContentBlockKind.file;

  @override
  Result<void> validate() =>
      fileName.isEmpty ? Err(CommError.validation('File name is empty')) : media.validate();

  @override
  ContentBlock withMedia(MediaRef media) =>
      FileBlock(media, fileName: fileName);

  @override
  Map<String, Object?> toJson() => {
    'kind': kind.name,
    'fileName': fileName,
    ...media.toJson(),
  };
}

class PollBlock extends ContentBlock {
  const PollBlock({
    required this.question,
    required this.options,
    this.multiple = false,
  });
  final String question;
  final List<String> options;
  final bool multiple;

  @override
  ContentBlockKind get kind => ContentBlockKind.poll;

  @override
  Result<void> validate() {
    if (question.trim().isEmpty) {
      return Err(CommError.validation('Poll question is empty'));
    }
    if (options.length < 2) {
      return Err(CommError.validation('Poll needs at least two options'));
    }
    return const Ok(null);
  }

  @override
  Map<String, Object?> toJson() => {
    'kind': kind.name,
    'question': question,
    'options': options,
    'multiple': multiple,
  };
}

/// Non-user system message (member added, call started/ended, etc.).
class SystemEventBlock extends ContentBlock {
  const SystemEventBlock(this.event);
  final String event;

  @override
  ContentBlockKind get kind => ContentBlockKind.systemEvent;

  @override
  Result<void> validate() => const Ok(null);

  @override
  Map<String, Object?> toJson() => {'kind': kind.name, 'event': event};
}

/// An in-thread record of a call (missed / ended / declined + duration).
class CallEventBlock extends ContentBlock {
  const CallEventBlock({
    required this.callId,
    required this.outcome,
    this.durationSeconds = 0,
  });
  final String callId;
  final String outcome;
  final int durationSeconds;

  @override
  ContentBlockKind get kind => ContentBlockKind.callEvent;

  @override
  Result<void> validate() =>
      callId.isEmpty ? Err(CommError.validation('Call event missing id')) : const Ok(null);

  @override
  Map<String, Object?> toJson() => {
    'kind': kind.name,
    'callId': callId,
    'outcome': outcome,
    'durationSeconds': durationSeconds,
  };
}

/// Forward-compat fallback for a content kind this client version doesn't know.
class UnsupportedBlock extends ContentBlock {
  const UnsupportedBlock(this.raw);
  final Map<String, Object?> raw;

  @override
  ContentBlockKind get kind => ContentBlockKind.unsupported;

  @override
  Result<void> validate() => const Ok(null);

  @override
  Map<String, Object?> toJson() => raw;
}
