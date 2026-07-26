import 'upload_byte_source.dart';

/// Default byte source for production: the real filesystem implementation.
/// Kept in its own file so the composition root's import surface stays tidy
/// and a web/wasm build could swap this shim without touching the platform.
UploadByteSource defaultByteSource() => const IoUploadByteSource();
