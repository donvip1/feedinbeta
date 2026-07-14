import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

typedef GenericFileCandidatePicker = Future<GenericFileCandidate?> Function();
typedef GenericFileCacheDirectoryProvider = Future<Directory> Function();

class GenericFileCandidate {
  const GenericFileCandidate({
    required this.path,
    required this.name,
    required this.sizeBytes,
  });

  final String path;
  final String name;
  final int sizeBytes;
}

class StagedGenericFileAttachment {
  const StagedGenericFileAttachment({
    required this.localPath,
    required this.fileName,
    required this.fileSizeBytes,
    required this.mimeType,
  });

  final String localPath;
  final String fileName;
  final int fileSizeBytes;
  final String mimeType;

  static const String mediaType = 'file';
}

class GenericFileAttachmentResult {
  const GenericFileAttachmentResult._({this.attachment, this.error});

  const GenericFileAttachmentResult.cancelled() : this._();

  const GenericFileAttachmentResult.success(
    StagedGenericFileAttachment attachment,
  ) : this._(attachment: attachment);

  const GenericFileAttachmentResult.failure(String error)
    : this._(error: error);

  final StagedGenericFileAttachment? attachment;
  final String? error;

  bool get isCancelled => attachment == null && error == null;
  bool get isSuccess => attachment != null;
  bool get isFailure => error != null;
}

class GenericFileAttachmentValidator {
  const GenericFileAttachmentValidator._();

  static const int maxFileSizeBytes = 50 * 1024 * 1024;

  static const List<String> allowedExtensions = <String>[
    'pdf',
    'txt',
    'csv',
    'rtf',
    'json',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'zip',
  ];

  static const Map<String, String> _mimeTypes = <String, String>{
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'rtf': 'application/rtf',
    'json': 'application/json',
    'doc': 'application/msword',
    'docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'zip': 'application/zip',
  };

  static String? validate(GenericFileCandidate candidate) {
    if (candidate.path.trim().isEmpty || candidate.name.trim().isEmpty) {
      return 'That file could not be read.';
    }
    if (candidate.sizeBytes <= 0) {
      return 'Empty files cannot be shared.';
    }
    if (candidate.sizeBytes > maxFileSizeBytes) {
      return 'Files must be 50 MB or smaller.';
    }
    if (mimeTypeForName(candidate.name) == null) {
      return 'That file type is not supported.';
    }
    return null;
  }

  static String? mimeTypeForName(String fileName) {
    final extension = extensionForName(fileName);
    return extension == null ? null : _mimeTypes[extension];
  }

  static String? extensionForName(String fileName) {
    final name = fileName.trim().toLowerCase();
    final dot = name.lastIndexOf('.');
    if (dot < 0 || dot == name.length - 1) return null;
    return name.substring(dot + 1);
  }
}

/// Picks and copies a supported document into the app cache before it is queued.
///
/// The copied file survives the platform picker's temporary URI/path lifecycle
/// long enough for the existing offline repository and sync service to upload
/// it through `queueAttachment(mediaType: 'file')`.
class GenericFileAttachmentPicker {
  GenericFileAttachmentPicker({
    GenericFileCandidatePicker? candidatePicker,
    GenericFileCacheDirectoryProvider? cacheDirectoryProvider,
    Uuid uuid = const Uuid(),
  }) : _candidatePicker = candidatePicker ?? _pickPlatformFile,
       _cacheDirectoryProvider =
           cacheDirectoryProvider ?? getApplicationCacheDirectory,
       _uuid = uuid;

  final GenericFileCandidatePicker _candidatePicker;
  final GenericFileCacheDirectoryProvider _cacheDirectoryProvider;
  final Uuid _uuid;

  Future<GenericFileAttachmentResult> pickAndStage() async {
    File? stagedFile;
    try {
      final candidate = await _candidatePicker();
      if (candidate == null) {
        return const GenericFileAttachmentResult.cancelled();
      }

      final validationError = GenericFileAttachmentValidator.validate(
        candidate,
      );
      if (validationError != null) {
        return GenericFileAttachmentResult.failure(validationError);
      }

      final source = File(candidate.path);
      if (!await source.exists()) {
        return const GenericFileAttachmentResult.failure(
          'That file is no longer available.',
        );
      }

      final actualSize = await source.length();
      final actualCandidate = GenericFileCandidate(
        path: candidate.path,
        name: candidate.name,
        sizeBytes: actualSize,
      );
      final actualValidationError = GenericFileAttachmentValidator.validate(
        actualCandidate,
      );
      if (actualValidationError != null) {
        return GenericFileAttachmentResult.failure(actualValidationError);
      }

      final root = await _cacheDirectoryProvider();
      final directory = Directory('${root.path}/feedin_message_files');
      if (!await directory.exists()) {
        await directory.create(recursive: true);
      }

      final extension = GenericFileAttachmentValidator.extensionForName(
        candidate.name,
      )!;
      stagedFile = await source.copy(
        '${directory.path}/${_uuid.v4()}.$extension',
      );
      final stagedSize = await stagedFile.length();
      final stagedValidationError = GenericFileAttachmentValidator.validate(
        GenericFileCandidate(
          path: stagedFile.path,
          name: candidate.name,
          sizeBytes: stagedSize,
        ),
      );
      if (stagedValidationError != null) {
        await stagedFile.delete();
        return GenericFileAttachmentResult.failure(stagedValidationError);
      }

      return GenericFileAttachmentResult.success(
        StagedGenericFileAttachment(
          localPath: stagedFile.path,
          fileName: candidate.name.trim(),
          fileSizeBytes: stagedSize,
          mimeType: GenericFileAttachmentValidator.mimeTypeForName(
            candidate.name,
          )!,
        ),
      );
    } catch (_) {
      try {
        if (stagedFile != null && await stagedFile.exists()) {
          await stagedFile.delete();
        }
      } catch (_) {
        // The original picker/copy error is the useful result.
      }
      return const GenericFileAttachmentResult.failure(
        'Could not open that file.',
      );
    }
  }

  static Future<GenericFileCandidate?> _pickPlatformFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: GenericFileAttachmentValidator.allowedExtensions,
      allowMultiple: false,
      withData: false,
    );
    final file = result?.files.singleOrNull;
    final path = file?.path;
    if (file == null || path == null || path.isEmpty) return null;
    return GenericFileCandidate(
      path: path,
      name: file.name,
      sizeBytes: file.size,
    );
  }
}
