import 'package:flutter/material.dart';

/// Standard "you're offline" affordance shown when the user attempts an online
/// action (posting, sending a message, liking, calling) with no connectivity.
///
/// The app is deliberately NOT local-first for writes: offline actions are
/// hard-blocked rather than queued for later, matching modern social apps.
/// Cached reads (feed, chats, profiles, media) still work — only writes are
/// gated. Keep the copy consistent across every call site.
void showOfflineSnackBar(
  BuildContext context, {
  String message = "You're offline. Connect to the internet to do that.",
}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(message),
      ),
    );
}
