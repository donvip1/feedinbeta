import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/local/local_feed_repository_contract.dart';
import '../../core/connectivity/connectivity_service.dart';
import '../../core/sync/sync_service.dart';
import 'feed_post.dart';
import 'immersive/feed_immersive_theme.dart';

abstract interface class FeedShareGateway {
  Future<void> share({required String text, required String subject});
}

class NativeFeedShareGateway implements FeedShareGateway {
  const NativeFeedShareGateway();

  @override
  Future<void> share({required String text, required String subject}) {
    return SharePlus.instance.share(ShareParams(text: text, subject: subject));
  }
}

class FeedShareService {
  const FeedShareService({
    this.gateway = const NativeFeedShareGateway(),
    this.productionBaseUrl = 'https://feedinn.com',
  });

  final FeedShareGateway gateway;
  final String productionBaseUrl;

  String postUrl(FeedPost post) {
    return '$productionBaseUrl/feed/post/${post.displayedPost.id}';
  }

  String shareText(FeedPost post) {
    final sharedPost = post.displayedPost;
    return [
      '${sharedPost.authorName} on feedIn',
      if (sharedPost.body.trim().isNotEmpty) sharedPost.body.trim(),
      postUrl(post),
    ].join('\n\n');
  }

  Future<void> openNativeShareSheet(FeedPost post) {
    final sharedPost = post.displayedPost;
    return gateway.share(
      text: shareText(post),
      subject: '${sharedPost.authorName} on feedIn',
    );
  }

  Future<void> copyPostLink(FeedPost post) {
    return Clipboard.setData(ClipboardData(text: postUrl(post)));
  }

  Future<void> recordShare({
    required FeedPost post,
    required LocalFeedRepositoryContract repository,
    required SyncServiceContract syncService,
    required ConnectivityService connectivityService,
  }) async {
    if (!connectivityService.isOnline) return;
    try {
      await repository.queueShare(post.id);
      await syncService.syncNow();
    } catch (_) {
      // Sharing itself succeeded. Analytics must never block the user action.
    }
  }
}

enum FeedShareAction { share, copyLink }

Future<FeedShareAction?> showFeedShareSheet(
  BuildContext context, {
  required FeedPost post,
}) {
  final content = post.displayedPost;
  return showModalBottomSheet<FeedShareAction>(
    context: context,
    backgroundColor: FeedImmersiveTheme.surface,
    barrierColor: Colors.black54,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: FeedImmersiveTheme.inkSubtle,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Share ${content.authorName}\'s post',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: FeedImmersiveTheme.ink,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(
              Icons.ios_share_rounded,
              color: FeedImmersiveTheme.brandPink,
            ),
            title: const Text(
              'Share to...',
              style: TextStyle(
                color: FeedImmersiveTheme.ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            subtitle: const Text(
              'Choose an app from your device.',
              style: TextStyle(color: FeedImmersiveTheme.inkMuted),
            ),
            onTap: () => Navigator.of(sheetContext).pop(FeedShareAction.share),
          ),
          ListTile(
            leading: const Icon(
              Icons.link_rounded,
              color: FeedImmersiveTheme.mentionCyan,
            ),
            title: const Text(
              'Copy Link',
              style: TextStyle(
                color: FeedImmersiveTheme.ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            subtitle: const Text(
              'Copy only the post link.',
              style: TextStyle(color: FeedImmersiveTheme.inkMuted),
            ),
            onTap: () =>
                Navigator.of(sheetContext).pop(FeedShareAction.copyLink),
          ),
        ],
      ),
    ),
  );
}
