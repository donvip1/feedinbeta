/// Feature flags for the Communication Platform UI swap.
///
/// The new surfaces ship dark and are enabled per-build with
/// `--dart-define=COMMS_UI=true` (or flipped here once a surface reaches
/// parity). Rollback is a rebuild with the flag off — the legacy screens
/// remain fully intact until deletion day.
class CommsFlags {
  const CommsFlags._();

  /// Master switch for the new communication UI (Chats tab surface).
  static const bool newChatsTab = bool.fromEnvironment(
    'COMMS_UI',
    defaultValue: false,
  );
}
