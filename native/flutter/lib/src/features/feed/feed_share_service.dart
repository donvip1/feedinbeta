import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

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

  Future<String?> downloadPost(FeedPost post) async {
    final media = post.displayedPost.normalizedMedia.firstOrNull;
    if (media == null) return null;
    final response = await HttpClient().getUrl(Uri.parse(media.url));
    final bytes = await (await response.close()).fold<List<int>>(
      <int>[],
      (all, chunk) => all..addAll(chunk),
    );
    final directory = await getApplicationDocumentsDirectory();
    final extension = media.isVideo ? 'mp4' : 'jpg';
    final file = File(
      '${directory.path}/feedin_${post.displayedPost.id}.$extension',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }
}

enum FeedShareAction { story, friends, groups, more, copyLink, save, download }

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
    builder: (sheetContext) => SingleChildScrollView(
      child: Padding(
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
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Share to...',
                style: TextStyle(
                  color: FeedImmersiveTheme.inkMuted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _ShareDestination(
                    icon: Icons.auto_stories_rounded,
                    label: 'Story',
                    onTap: () =>
                        Navigator.of(sheetContext).pop(FeedShareAction.story),
                  ),
                  _ShareDestination(
                    icon: Icons.person_outline_rounded,
                    label: 'Friends',
                    onTap: () =>
                        Navigator.of(sheetContext).pop(FeedShareAction.friends),
                  ),
                  _ShareDestination(
                    icon: Icons.groups_2_outlined,
                    label: 'Groups',
                    onTap: () =>
                        Navigator.of(sheetContext).pop(FeedShareAction.groups),
                  ),
                  _ShareDestination(
                    icon: Icons.more_horiz_rounded,
                    label: 'More',
                    onTap: () =>
                        Navigator.of(sheetContext).pop(FeedShareAction.more),
                  ),
                ],
              ),
            ),
            const Divider(color: FeedImmersiveTheme.glassBorder),
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
            ListTile(
              leading: const Icon(
                Icons.bookmark_border_rounded,
                color: FeedImmersiveTheme.brandPink,
              ),
              title: const Text(
                'Save post',
                style: TextStyle(
                  color: FeedImmersiveTheme.ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
              onTap: () => Navigator.of(sheetContext).pop(FeedShareAction.save),
            ),
            ListTile(
              leading: const Icon(
                Icons.download_outlined,
                color: FeedImmersiveTheme.mentionCyan,
              ),
              title: const Text(
                'Download',
                style: TextStyle(
                  color: FeedImmersiveTheme.ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
              onTap: () =>
                  Navigator.of(sheetContext).pop(FeedShareAction.download),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ShareDestination extends StatelessWidget {
  const _ShareDestination({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(16),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: FeedImmersiveTheme.ink, size: 25),
          ),
          const SizedBox(height: 5),
          Text(
            label,
            style: const TextStyle(
              color: FeedImmersiveTheme.inkMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}
