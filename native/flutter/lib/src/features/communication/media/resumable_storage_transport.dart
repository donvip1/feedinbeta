import '../domain/result.dart';

/// Provider-agnostic resumable object storage. The Supabase Storage adapter
/// (wired at integration time) implements this; tests use an in-memory fake.
///
/// The contract is offset-based so an upload interrupted at any point resumes
/// from the last CONFIRMED byte rather than restarting — the primitive the old
/// single-shot `storage.upload(file)` path lacked.
abstract interface class ResumableStorageTransport {
  /// How many bytes the remote already holds for [remotePath] (0 if none).
  /// Used to re-anchor the resume point after a crash.
  Future<Result<int>> storedBytes(String remotePath);

  /// Store [bytes] at [offset]. Returns the new confirmed end offset.
  /// Implementations must reject a gap (offset beyond what's stored).
  Future<Result<int>> putChunk(
    String remotePath,
    int offset,
    List<int> bytes, {
    required int totalBytes,
    String? mimeType,
  });

  /// The sha256 of the fully-stored object, or null when the backend can't
  /// compute one (integrity then relies on byte-count alone).
  Future<Result<String?>> remoteSha256(String remotePath);

  /// Remove a partial or rejected object.
  Future<Result<void>> abort(String remotePath);
}
