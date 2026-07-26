import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart' hide StorageException;
import 'package:supabase_flutter/supabase_flutter.dart' as supa
    show StorageException;

import '../domain/result.dart';
import 'resumable_storage_transport.dart';

/// A [ResumableStorageTransport] that buffers chunks to a local `.part` file
/// and uploads the whole object once the final chunk lands.
///
/// Why this shape: the standard Supabase Storage SDK has no offset-based
/// chunk API, but the UploadManager's contract (persisted offsets, pause/
/// cancel, integrity) is still fully honoured — chunk buffering is local, so
/// pause/resume/cancel work exactly as tested, and a process restart resumes
/// *buffering* from the persisted offset instead of re-reading everything.
/// The single seam to upgrade later is [uploadWhole] → a TUS client for true
/// network-level resume; nothing else in the Media Engine changes.
class BufferedStorageTransport implements ResumableStorageTransport {
  BufferedStorageTransport({
    required Future<Result<void>> Function(
      String remotePath,
      File file,
      String? mimeType,
    )
    uploadWhole,
    required Future<Result<void>> Function(String remotePath) removeRemote,
    Directory? tempDir,
  }) : _uploadWhole = uploadWhole,
       _removeRemote = removeRemote,
       _tempDir = tempDir ?? Directory.systemTemp;

  /// Production wiring over a Supabase Storage bucket.
  factory BufferedStorageTransport.supabase({
    String bucket = 'message-media',
    SupabaseClient? client,
    Directory? tempDir,
  }) {
    SupabaseClient? resolve() {
      if (client != null) return client;
      try {
        return Supabase.instance.client;
      } catch (_) {
        return null;
      }
    }

    return BufferedStorageTransport(
      tempDir: tempDir,
      uploadWhole: (remotePath, file, mimeType) async {
        final resolved = resolve();
        if (resolved == null) {
          return Err(CommError.network('Backend not configured'));
        }
        try {
          await resolved.storage.from(bucket).upload(
            remotePath,
            file,
            fileOptions: FileOptions(upsert: true, contentType: mimeType),
          );
          return const Ok(null);
        } on supa.StorageException catch (error) {
          return Err(CommError.network(error.message, cause: error));
        } catch (error) {
          return Err(CommError.network('Storage upload failed', cause: error));
        }
      },
      removeRemote: (remotePath) async {
        final resolved = resolve();
        if (resolved == null) {
          return Err(CommError.network('Backend not configured'));
        }
        try {
          await resolved.storage.from(bucket).remove([remotePath]);
          return const Ok(null);
        } catch (error) {
          return Err(CommError.network('Storage remove failed', cause: error));
        }
      },
    );
  }

  final Future<Result<void>> Function(String, File, String?) _uploadWhole;
  final Future<Result<void>> Function(String) _removeRemote;
  final Directory _tempDir;

  /// remotePath -> confirmed-complete byte count (uploaded objects).
  final Map<String, int> _completed = {};

  File _partFile(String remotePath) => File(
    '${_tempDir.path}/comm_upload_${remotePath.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_')}.part',
  );

  @override
  Future<Result<int>> storedBytes(String remotePath) async {
    final completed = _completed[remotePath];
    if (completed != null) return Ok(completed);
    final part = _partFile(remotePath);
    // Resume local buffering from where the .part file left off.
    return Ok(part.existsSync() ? await part.length() : 0);
  }

  @override
  Future<Result<int>> putChunk(
    String remotePath,
    int offset,
    List<int> bytes, {
    required int totalBytes,
    String? mimeType,
  }) async {
    final part = _partFile(remotePath);
    final current = part.existsSync() ? await part.length() : 0;
    if (offset != current) {
      return Err(
        CommError.validation('offset gap: expected $current, got $offset'),
      );
    }
    await part.writeAsBytes(bytes, mode: FileMode.append, flush: true);
    final newLength = current + bytes.length;

    if (newLength < totalBytes) return Ok(newLength);

    // Final chunk buffered — perform the actual upload.
    final uploaded = await _uploadWhole(remotePath, part, mimeType);
    if (uploaded.isErr) {
      // Keep the fully-buffered .part so the retry only re-runs the upload.
      return Err(uploaded.errorOrNull!);
    }
    _completed[remotePath] = newLength;
    try {
      await part.delete();
    } catch (_) {}
    return Ok(newLength);
  }

  @override
  Future<Result<String?>> remoteSha256(String remotePath) async {
    // Supabase Storage does not expose an object sha256; integrity here relies
    // on the byte-count check (the TUS upgrade adds true hash verification).
    return const Ok(null);
  }

  @override
  Future<Result<void>> abort(String remotePath) async {
    final part = _partFile(remotePath);
    try {
      if (part.existsSync()) await part.delete();
    } catch (_) {}
    if (_completed.remove(remotePath) != null) {
      return _removeRemote(remotePath);
    }
    return const Ok(null);
  }
}
