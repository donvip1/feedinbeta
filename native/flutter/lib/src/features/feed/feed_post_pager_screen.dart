import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/connectivity/connectivity_service.dart';
import '../../core/connectivity/offline_notice.dart';
import '../../core/feedin_route_observer.dart';
import '../../core/sync/sync_service.dart';
import '../../data/local/local_feed_repository_contract.dart';
import '../../data/remote/social_graph_remote_data_source.dart';
import '../profile/parity/profile_tokens.dart';
import 'feed_post.dart';
import 'feed_share_service.dart';
import 'immersive/comment_sheet.dart';
import 'immersive/creator_preview_sheet.dart';
import 'immersive/feed_immersive_theme.dart';
import 'immersive/refeed_sheet.dart';
import 'presentation/post_controller_card.dart';
import 'state/post_controller.dart';

typedef OpenFeedUserProfile = void Function(String userId);

/// Shared full-screen host for posts opened outside the main feed pager.
///
/// Search and profile grids use this surface so post actions remain functional
/// and follow the same optimistic-update and rollback semantics as FeedScreen.
class FeedPostPagerScreen extends StatefulWidget {
  const FeedPostPagerScreen({
    super.key,
    required this.posts,
    required this.initialIndex,
    required this.feedRepository,
    required this.syncService,
    required this.connectivityService,
    required this.currentUserId,
    required this.onOpenUserProfile,
    required this.socialGraphDataSource,
    this.shareService = const FeedShareService(),
  });

  final List<FeedPost> posts;
  final int initialIndex;
  final LocalFeedRepositoryContract feedRepository;
  final SyncServiceContract syncService;
  final ConnectivityService connectivityService;
  final String currentUserId;
  final OpenFeedUserProfile onOpenUserProfile;
  final SocialGraphRemoteDataSource socialGraphDataSource;
  final FeedShareService shareService;

  @override
  State<FeedPostPagerScreen> createState() => _FeedPostPagerScreenState();
}

class _FeedPostPagerScreenState extends State<FeedPostPagerScreen>
    with RouteAware {
  late final PageController _controller;
  late int _activePage;
  late final List<FeedPost> _posts = List<FeedPost>.of(widget.posts);
  ModalRoute<void>? _subscribedRoute;
  bool _routeVisible = true;
  String? _message;

  @override
  void initState() {
    super.initState();
    _activePage = _posts.isEmpty
        ? 0
        : widget.initialIndex.clamp(0, _posts.length - 1);
    _controller = PageController(initialPage: _activePage);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route == null || identical(route, _subscribedRoute)) return;
    if (_subscribedRoute != null) {
      feedinRouteObserver.unsubscribe(this);
    }
    _subscribedRoute = route;
    feedinRouteObserver.subscribe(this, route);
  }

  @override
  void didPushNext() {
    if (_routeVisible) setState(() => _routeVisible = false);
  }

  @override
  void didPopNext() {
    if (!_routeVisible) setState(() => _routeVisible = true);
  }

  @override
  void dispose() {
    feedinRouteObserver.unsubscribe(this);
    _controller.dispose();
    super.dispose();
  }

  bool _requireOnline() {
    if (widget.connectivityService.isOnline) return true;
    showOfflineSnackBar(context);
    return false;
  }

  Future<void> _refeedPost(FeedPost post, PostController controller) async {
    if (!_requireOnline()) return;
    final currentlyRefeeded = controller.isRefeeded;
    final action = await showRefeedActionSheet(
      context,
      isRefeeded: currentlyRefeeded,
    );
    if (!mounted || action == null) return;
    if (action == RefeedAction.quoteRefeed) {
      final quote = await showQuoteRefeedComposer(context, post: post);
      if (!mounted || quote == null) return;
      try {
        await widget.feedRepository.createQuoteRefeed(post.id, quote);
        controller.recordQuoteRefeed();
        if (mounted) setState(() => _message = 'Quote shared to your feed.');
      } catch (_) {
        if (!mounted) return;
        setState(() => _message = 'Could not share this quote.');
      }
      return;
    }

    await controller.toggleRefeed();
  }

  Future<void> _openComments(FeedPost post, PostController controller) async {
    List<FeedComment> comments = const [];
    try {
      comments = await widget.feedRepository.loadComments(post.id);
    } catch (_) {
      // The composer remains usable if comments cannot be listed.
    }
    if (!mounted) return;
    await showCommentSheet(
      context,
      post: post,
      comments: comments,
      onSubmit: (body, parentCommentId) async {
        final created = await widget.feedRepository.addComment(
          post.id,
          body,
          parentCommentId: parentCommentId,
        );
        if (parentCommentId == null) controller.incrementCommentCount();
        return created;
      },
      onToggleLike: (comment, liked) =>
          widget.feedRepository.toggleCommentLike(comment.id, liked: liked),
      onDelete: (comment) => widget.feedRepository.deleteComment(comment.id),
      onOpenUserProfile: widget.onOpenUserProfile,
      currentUserId: widget.currentUserId,
    );
  }

  Future<void> _sharePost(FeedPost post) async {
    final action = await showFeedShareSheet(context, post: post);
    if (!mounted || action == null) return;
    if (action == FeedShareAction.copyLink) {
      await widget.shareService.copyPostLink(post);
      if (!mounted) return;
      setState(() => _message = 'Post link copied.');
      return;
    }

    try {
      await widget.shareService.openNativeShareSheet(post);
      await widget.shareService.recordShare(
        post: post,
        repository: widget.feedRepository,
        syncService: widget.syncService,
        connectivityService: widget.connectivityService,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'Could not open the share sheet.');
    }
  }

  Future<void> _openCreatorPreview(FeedPost post) async {
    final content = post.displayedPost;
    final isOwnProfile = content.userId == widget.currentUserId;
    var initiallyFollowing = false;
    if (!isOwnProfile && content.userId.isNotEmpty) {
      try {
        initiallyFollowing = await widget.socialGraphDataSource
            .isCurrentUserFollowing(content.userId);
      } catch (_) {
        // The preview can still open and report follow errors independently.
      }
    }
    if (!mounted) return;
    await showCreatorPreview(
      context,
      heroTag: 'creator-avatar-${post.id}',
      name: content.authorName,
      handle: content.authorHandle ?? content.meta,
      avatarUrl: content.avatarUrl,
      initiallyFollowing: initiallyFollowing,
      onViewProfile: () => widget.onOpenUserProfile(content.userId),
      onToggleFollow: isOwnProfile
          ? null
          : () => widget.socialGraphDataSource.toggleFollow(content.userId),
    );
  }

  Future<void> _deletePost(FeedPost post) async {
    if (post.userId != widget.currentUserId || !_requireOnline()) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete post?'),
        content: const Text('This permanently deletes the post.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.feedRepository.deletePost(post.id);
      if (!mounted) return;
      setState(() {
        final removedIndex = _posts.indexWhere((item) => item.id == post.id);
        _posts.removeWhere((item) => item.id == post.id);
        if (_posts.isNotEmpty) {
          _activePage = _activePage.clamp(0, _posts.length - 1);
          if (removedIndex >= 0 && _controller.hasClients) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted || !_controller.hasClients) return;
              _controller.jumpToPage(_activePage);
            });
          }
        }
      });
      if (_posts.isEmpty && mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'Could not delete this post.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          ProviderScope(
            child: PageView.builder(
              controller: _controller,
              scrollDirection: Axis.vertical,
              itemCount: _posts.length,
              onPageChanged: (index) => setState(() => _activePage = index),
              itemBuilder: (context, index) {
                final post = _posts[index];
                return PostControllerCard(
                  key: ValueKey<String>('post-pager-${post.id}'),
                  post: post,
                  repository: widget.feedRepository,
                  isActive: _routeVisible && index == _activePage,
                  onCommentRequested: (controller) =>
                      _openComments(post, controller),
                  onRefeedRequested: (controller) =>
                      _refeedPost(post, controller),
                  onShare: () => unawaited(_sharePost(post)),
                  onGift: () =>
                      setState(() => _message = 'Open Wallet to send a gift.'),
                  onAvatar: () => unawaited(_openCreatorPreview(post)),
                  onCreatorName: () =>
                      widget.onOpenUserProfile(post.displayedPost.userId),
                );
              },
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: FeedImmersiveTheme.topScrim,
              ),
              child: SafeArea(
                bottom: false,
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Back',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                    const Spacer(),
                    if (_posts.isNotEmpty &&
                        _posts[_activePage].userId == widget.currentUserId)
                      IconButton(
                        key: const Key('post-more-actions'),
                        tooltip: 'Post actions',
                        onPressed: () =>
                            unawaited(_deletePost(_posts[_activePage])),
                        icon: const Icon(
                          Icons.more_vert_rounded,
                          color: Colors.white,
                        ),
                      ),
                    if (_posts.length > 1)
                      Padding(
                        padding: const EdgeInsets.only(right: 16),
                        child: Text(
                          '${_activePage + 1}/${_posts.length}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontWeight: FontWeight.w700,
                            shadows: FeedImmersiveTheme.textShadow,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: IgnorePointer(
              child: AnimatedOpacity(
                opacity: _message == null ? 0 : 1,
                duration: FeedImmersiveTheme.motionFast,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: ProfileColors.card.withValues(alpha: 0.94),
                    borderRadius: ProfileRadii.tile,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      _message ?? '',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: ProfileColors.foreground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
