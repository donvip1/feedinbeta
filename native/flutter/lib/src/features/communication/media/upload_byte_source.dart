import 'dart:io';

import 'package:crypto/crypto.dart';

/// Reads local attachment bytes for the upload engine. An interface so tests
/// use an in-memory fake and the engine never touches `dart:io` directly.
abstract interface class UploadByteSource {
  Future<int> length(String localPath);

  /// Read up to [count] bytes starting at [offset]. Returns fewer at EOF.
  Future<List<int>> read(String localPath, int offset, int count);

  /// Content hash used for end-to-end integrity verification.
  Future<String> sha256Of(String localPath);
}

/// Production implementation over the filesystem, streaming the hash so large
/// videos never load fully into memory.
class IoUploadByteSource implements UploadByteSource {
  const IoUploadByteSource();

  @override
  Future<int> length(String localPath) => File(localPath).length();

  @override
  Future<List<int>> read(String localPath, int offset, int count) async {
    final raf = await File(localPath).open();
    try {
      await raf.setPosition(offset);
      return await raf.read(count);
    } finally {
      await raf.close();
    }
  }

  @override
  Future<String> sha256Of(String localPath) async {
    final digest = await sha256.bind(File(localPath).openRead()).first;
    return digest.toString();
  }
}
