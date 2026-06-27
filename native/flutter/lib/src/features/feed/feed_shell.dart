import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/realtime/feedin_realtime_service.dart';
import '../../core/storage/local_storage_maintenance.dart';
import '../../core/storage/storage_diagnostics_service.dart';
import '../../core/sync/conversation_starter.dart';
import '../../core/sync/foreground_sync_coordinator.dart';
import '../../core/sync/sync_service.dart';
import '../../core/sync/upload_queue_service.dart';
import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../../data/local/notification_repository_contract.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../../data/local/post_draft_repository.dart';
import '../../data/local/profile_repository_contract.dart';
import '../../data/local/upload_queue_repository.dart';
import '../create/create_post_screen.dart';
import '../messages/messages_screen.dart';
import '../notifications/parity/notifications_view_models.dart';
import '../notifications/parity/widgets/notification_bell_badge.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_editor_screen.dart';
import '../profile/user_profile.dart';
import '../settings/settings_screen.dart';
import 'feed_post.dart';
import 'feed_video_player.dart';
import 'immersive/feed_immersive_theme.dart';
import 'immersive/immersive_post_card.dart';

class FeedShell extends StatefulWidget {
  const FeedShell({
    super.key,
    required this.displayName,
    required this.profile,
    required this.feedRepository,
    required this.messagesRepository,
    required this.notificationRepository,
    required this.preferencesRepository,
    required this.conversationStarter,
    required this.profileRepository,
    required this.postDraftRepository,
    required this.uploadQueueRepository,
    required this.syncService,
    required this.uploadQueueService,
    required this.foregroundSyncCoordinator,
    required this.storageDiagnosticsService,
    required this.realtimeService,
    required this.storageMaintenance,
    required this.onSignOut,
  });

  final String displayName;
  final UserProfile profile;
  final LocalFeedRepositoryContract feedRepository;
  final LocalMessagesRepositoryContract messagesRepository;
  final NotificationRepositoryContract notificationRepository;
  final PreferencesRepositoryContract preferencesRepository;
  final ConversationStarter conversationStarter;
  final ProfileRepositoryContract profileRepository;
  final PostDraftRepository postDraftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final SyncServiceContract syncService;
  final UploadQueueService uploadQueueService;
  final ForegroundSyncCoordinator foregroundSyncCoordinator;
  final StorageDiagnosticsService storageDiagnosticsService;
  final FeedinRealtimeService realtimeService;
  final LocalStorageMaintenance storageMaintenance;
  final VoidCallback onSignOut;

  @override
  State<FeedShell> createState() => _FeedShellState();
}

class _FeedShellState extends State<FeedShell> {
  int _index = 0;
  bool _showNotifications = false;
  late final StreamSubscription<FeedinRealtimeEvent> _realtimeSubscription;
  bool _realtimeConnected = false;
  int _feedRealtimeVersion = 0;
  int _messagesRealtimeVersion = 0;
  String? _initialConversationId;
  late UserProfile _profile;
  late Future<int> _notificationUnreadCountFuture;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    _notificationUnreadCountFuture = widget.notificationRepository
        .unreadCount();
    _realtimeSubscription = widget.realtimeService.events.listen(
      _handleRealtimeEvent,
    );
    _connectRealtime();
    widget.foregroundSyncCoordinator.start();
  }

  @override
  void dispose() {
    _realtimeSubscription.cancel();
    widget.foregroundSyncCoordinator.stop();
    widget.realtimeService.disconnect();
    super.dispose();
  }

  Future<void> _connectRealtime() async {
    await widget.realtimeService.connect();
    if (!mounted) return;
    setState(() => _realtimeConnected = widget.realtimeService.isConnected);
  }

  void _handleRealtimeEvent(FeedinRealtimeEvent event) {
    if (!mounted) return;
    switch (event.type) {
      case FeedinRealtimeEventType.postChanged:
        setState(() {
          _feedRealtimeVersion++;
        });
      case FeedinRealtimeEventType.messageChanged:
        unawaited(_refreshMessagesAfterRealtimeEvent());
    }
  }

  Future<void> _refreshMessagesAfterRealtimeEvent() async {
    await widget.syncService.syncNow();
    if (!mounted) return;
    setState(() => _messagesRealtimeVersion++);
  }

  void _refreshNotificationBadge() {
    if (!mounted) return;
    setState(() {
      _notificationUnreadCountFuture = widget.notificationRepository
          .unreadCount();
    });
  }

  void _toggleNotifications() {
    setState(() {
      _showNotifications = !_showNotifications;
      _notificationUnreadCountFuture = widget.notificationRepository
          .unreadCount();
    });
  }

  void _showNotificationsScreen() {
    setState(() {
      _showNotifications = true;
      _notificationUnreadCountFuture = widget.notificationRepository
          .unreadCount();
    });
  }

  void _openNotificationRoute(String route) {
    final conversationId = _conversationIdFromRoute(route);
    if (conversationId != null) {
      setState(() {
        _showNotifications = false;
        _index = 2;
        _initialConversationId = conversationId;
        _messagesRealtimeVersion++;
      });
    }
  }

  String? _conversationIdFromRoute(String route) {
    final value = route.trim();
    if (value.startsWith('conversation:')) {
      return value.substring('conversation:'.length).trim();
    }
    if (value.startsWith('/messages/')) {
      return value.substring('/messages/'.length).trim();
    }
    if (value.startsWith('feedin://messages/')) {
      return value.substring('feedin://messages/'.length).trim();
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      FeedScreen(
        feedRepository: widget.feedRepository,
        realtimeVersion: _feedRealtimeVersion,
        onOpenNotifications: _showNotificationsScreen,
        notificationUnreadCountFuture: _notificationUnreadCountFuture,
      ),
      CreatePostScreen(
        draftRepository: widget.postDraftRepository,
        uploadQueueRepository: widget.uploadQueueRepository,
        uploadQueueService: widget.uploadQueueService,
        onPostUploaded: () => setState(() => _feedRealtimeVersion++),
      ),
      MessagesScreen(
        messagesRepository: widget.messagesRepository,
        conversationStarter: widget.conversationStarter,
        profile: _profile,
        realtimeVersion: _messagesRealtimeVersion,
        initialConversationId: _initialConversationId,
      ),
      ProfileEditorScreen(
        profile: _profile,
        profileRepository: widget.profileRepository,
        feedRepository: widget.feedRepository,
        onSaved: (profile) => setState(() => _profile = profile),
      ),
      SettingsScreen(
        syncService: widget.syncService,
        uploadQueueService: widget.uploadQueueService,
        storageDiagnosticsService: widget.storageDiagnosticsService,
        preferencesRepository: widget.preferencesRepository,
        realtimeConnected: _realtimeConnected,
        storageMaintenance: widget.storageMaintenance,
        onSignOut: widget.onSignOut,
      ),
    ];

    // The feed tab is an immersive, full-bleed experience that draws its own
    // top overlay, so the shared AppBar is hidden while it is on screen.
    final immersiveFeed = _index == 0 && !_showNotifications;

    return Scaffold(
      backgroundColor: immersiveFeed ? Colors.black : null,
      appBar: immersiveFeed
          ? null
          : AppBar(
              toolbarHeight: 64,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'feedIn',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0,
                    ),
                  ),
                  Text(
                    _profile.displayName,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  tooltip: 'Search',
                  onPressed: () {},
                  icon: const Icon(Icons.search),
                ),
                _NotificationBellAction(
                  unreadCountFuture: _notificationUnreadCountFuture,
                  onTap: _toggleNotifications,
                ),
              ],
            ),
      body: _showNotifications
          ? NotificationsScreen(
              notificationRepository: widget.notificationRepository,
              onOpenRoute: _openNotificationRoute,
              onChanged: _refreshNotificationBadge,
            )
          : pages[_index],
      bottomNavigationBar: NavigationBar(
        height: 72,
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() {
          _showNotifications = false;
          _index = value;
        }),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Feeds',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_box_outlined),
            selectedIcon: Icon(Icons.add_box),
            label: 'Create',
          ),
          NavigationDestination(
            icon: Icon(Icons.mail_outline),
            selectedIcon: Icon(Icons.mail),
            label: 'Chats',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

class _NotificationBellAction extends StatelessWidget {
  const _NotificationBellAction({
    required this.unreadCountFuture,
    required this.onTap,
    this.foregroundColor,
  });

  final Future<int> unreadCountFuture;
  final VoidCallback onTap;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<int>(
      future: unreadCountFuture,
      builder: (context, snapshot) {
        final count = snapshot.data ?? 0;
        final bell = NotificationBellBadge(
          viewModel: NotificationBellViewModel(unreadCount: count),
          onTap: onTap,
          pulse: count > 0,
          foregroundColor: foregroundColor,
        );

        return bell;
      },
    );
  }
}

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    super.key,
    required this.feedRepository,
    required this.realtimeVersion,
    required this.onOpenNotifications,
    required this.notificationUnreadCountFuture,
  });

  final LocalFeedRepositoryContract feedRepository;
  final int realtimeVersion;
  final VoidCallback onOpenNotifications;
  final Future<int> notificationUnreadCountFuture;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late Future<List<FeedPost>> _postsFuture;
  late Future<List<LiveFeedItem>> _liveFuture;
  final PageController _pageController = PageController();
  int _pendingActionCount = 0;
  String? _message;
  int _tabIndex = 0;
  int _activePage = 0;
  bool _isLoadingMore = false;
  bool _hasMorePosts = true;
  final Set<String> _savedPostIds = {};
  final Set<String> _likedPostIds = {};

  @override
  void initState() {
    super.initState();
    _postsFuture = _initialLoad();
    _liveFuture = widget.feedRepository.loadLiveItems();
    _loadPendingActionCount();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant FeedScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.realtimeVersion != widget.realtimeVersion) {
      _reloadAfterRealtimeEvent();
    }
  }

  Future<void> _reloadAfterRealtimeEvent() async {
    final result = await widget.feedRepository.refresh();
    if (!mounted) return;
    setState(() {
      _postsFuture = Future.value(result.posts);
      _liveFuture = widget.feedRepository.loadLiveItems();
      _message = 'New feed activity synced.';
    });
    await _loadPendingActionCount();
  }

  Future<void> _loadPendingActionCount() async {
    final count = await widget.feedRepository.pendingActionCount();
    if (!mounted) return;
    setState(() => _pendingActionCount = count);
  }

  Future<List<FeedPost>> _initialLoad() async {
    final cachedPosts = await widget.feedRepository.loadPosts();
    final result = await widget.feedRepository.refresh();
    if (!mounted) return result.posts.isNotEmpty ? result.posts : cachedPosts;

    setState(() {
      _message = result.message;
      _hasMorePosts = result.usedRemote;
    });

    return result.posts.isNotEmpty ? result.posts : cachedPosts;
  }

  Future<void> _refresh() async {
    final result = await widget.feedRepository.refresh();
    if (!mounted) return;
    setState(() {
      _postsFuture = Future.value(result.posts);
      _liveFuture = widget.feedRepository.loadLiveItems();
      _message = result.message ?? 'Feed refreshed.';
      _hasMorePosts = result.usedRemote;
    });
    await _loadPendingActionCount();
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMorePosts) return;
    setState(() {
      _isLoadingMore = true;
      _message = null;
    });

    final result = await widget.feedRepository.loadMorePosts();
    if (!mounted) return;
    setState(() {
      _isLoadingMore = false;
      _hasMorePosts = result.hasMore;
      _postsFuture = Future.value(result.posts);
      _message = result.message;
    });
  }

  Future<void> _queueAction(Future<void> Function() action) async {
    await action();
    await _loadPendingActionCount();
    if (!mounted) return;
    setState(() => _message = 'Saved offline. It will sync later.');
  }

  Future<void> _likePost(FeedPost post) async {
    if (!_likedPostIds.contains(post.id)) {
      setState(() => _likedPostIds.add(post.id));
    }
    await widget.feedRepository.queueLike(post.id);
    await _loadPendingActionCount();
  }

  /// Pull the next page in once the viewer nears the end of the loaded feed.
  void _maybeLoadMore(int index, int loadedCount) {
    if (index >= loadedCount - 2) {
      _loadMore();
    }
  }

  void _onTabChanged(int value) {
    if (value == _tabIndex) return;
    setState(() {
      _tabIndex = value;
      _activePage = 0;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
    });
  }

  Future<void> _savePost(FeedPost post) async {
    await widget.feedRepository.queueSave(post.id);
    await _loadPendingActionCount();
    if (!mounted) return;
    setState(() {
      _savedPostIds.add(post.id);
      _message = 'Post saved. It will sync when connected.';
    });
  }

  Future<void> _sharePost(FeedPost post) async {
    final text = _shareTextForPost(post);
    await Clipboard.setData(ClipboardData(text: text));
    await widget.feedRepository.queueShare(post.id);
    await _loadPendingActionCount();
    if (!mounted) return;
    setState(() => _message = 'Share text copied. Share event queued.');
  }

  String _shareTextForPost(FeedPost post) {
    final mediaUrl = post.mediaUrl ?? post.mediaUrls.firstOrNull;
    return [
      '${post.authorName} on feedIn',
      if (post.body.trim().isNotEmpty) post.body.trim(),
      if (mediaUrl != null && mediaUrl.isNotEmpty) mediaUrl,
    ].join('\n\n');
  }

  Future<void> _openComments(FeedPost post) async {
    final comment = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _CommentSheet(post: post),
    );
    if (comment == null || comment.trim().isEmpty) return;
    await _queueAction(
      () => widget.feedRepository.queueComment(post.id, comment),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<FeedPost>>(
      future: _postsFuture,
      builder: (context, snapshot) {
        final posts = snapshot.data;
        final topInset = MediaQuery.of(context).padding.top;
        final overlayHeight = topInset + 104;

        Widget content;
        if (posts == null) {
          content = const Center(
            child: CircularProgressIndicator(color: Colors.white),
          );
        } else if (_tabIndex == 2) {
          content = _LiveFeedList(
            liveFuture: _liveFuture,
            topPadding: overlayHeight,
          );
        } else {
          final filteredPosts = _filterPosts(posts);
          content = filteredPosts.isEmpty
              ? _ImmersiveEmptyState(
                  tabIndex: _tabIndex,
                  topPadding: overlayHeight,
                  onRefresh: _refresh,
                )
              : _buildImmersivePager(filteredPosts);
        }

        return ColoredBox(
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(child: content),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: _buildTopOverlay(context),
              ),
              if (_message != null || _pendingActionCount > 0)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: _FeedStatusBanner(
                    message: _message,
                    pendingActionCount: _pendingActionCount,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildImmersivePager(List<FeedPost> posts) {
    return PageView.builder(
      controller: _pageController,
      scrollDirection: Axis.vertical,
      itemCount: posts.length,
      onPageChanged: (index) {
        setState(() => _activePage = index);
        _maybeLoadMore(index, posts.length);
      },
      itemBuilder: (context, index) {
        final post = posts[index];
        final card = ImmersivePostCard(
          post: post,
          isActive: index == _activePage,
          isLiked: _likedPostIds.contains(post.id),
          isSaved: _savedPostIds.contains(post.id),
          onLike: () => _likePost(post),
          onComment: () => _openComments(post),
          onRefeed: () =>
              _queueAction(() => widget.feedRepository.queueRefeed(post.id)),
          onSave: () => _savePost(post),
          onShare: () => _sharePost(post),
          onOpenDetail: () => _openPostDetail(post),
        );
        return _PageTransition(
          controller: _pageController,
          index: index,
          child: card,
        );
      },
    );
  }

  Widget _buildTopOverlay(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: FeedImmersiveTheme.topScrim),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 4, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Text(
                    'feedIn',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                      shadows: FeedImmersiveTheme.textShadow,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Search',
                    onPressed: () {},
                    icon: const Icon(Icons.search, color: Colors.white),
                  ),
                  _NotificationBellAction(
                    unreadCountFuture: widget.notificationUnreadCountFuture,
                    onTap: widget.onOpenNotifications,
                    foregroundColor: Colors.white,
                  ),
                ],
              ),
              _ImmersiveFeedTabs(
                selectedIndex: _tabIndex,
                onChanged: _onTabChanged,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<FeedPost> _filterPosts(List<FeedPost> posts) {
    return switch (_tabIndex) {
      0 => posts.where((post) => post.mediaType == 'video').toList(),
      1 => posts.where((post) => post.mediaType != 'video').toList(),
      2 => const <FeedPost>[],
      _ => posts,
    };
  }

  Future<void> _openPostDetail(FeedPost post) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => PostDetailScreen(
          post: post,
          isSaved: _savedPostIds.contains(post.id),
          onLike: () =>
              _queueAction(() => widget.feedRepository.queueLike(post.id)),
          onSave: () => _savePost(post),
          onComment: () => _openComments(post),
          onRefeed: () =>
              _queueAction(() => widget.feedRepository.queueRefeed(post.id)),
          onShare: () => _sharePost(post),
        ),
      ),
    );
  }
}

/// Applies a subtle depth transition to immersive feed pages as they scroll:
/// the page settling into view scales up to full size and brightens while the
/// neighbouring pages sit slightly back and dimmed. Driven directly by the
/// shared [PageController] so it stays in sync with the user's drag without
/// triggering setState rebuilds.
class _PageTransition extends StatelessWidget {
  const _PageTransition({
    required this.controller,
    required this.index,
    required this.child,
  });

  final PageController controller;
  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      child: child,
      builder: (context, child) {
        // Distance (in pages) of this page from the current scroll position.
        double delta = 0;
        if (controller.hasClients && controller.position.hasContentDimensions) {
          final page = controller.page ?? controller.initialPage.toDouble();
          delta = (page - index).abs().clamp(0.0, 1.0);
        }
        // Active page -> scale 1.0 / full opacity; neighbour -> 0.92 / 0.55.
        final scale = 1.0 - (0.08 * delta);
        final opacity = 1.0 - (0.45 * delta);
        return Opacity(
          opacity: opacity,
          child: Transform.scale(scale: scale, child: child),
        );
      },
    );
  }
}

class _ImmersiveFeedTabs extends StatelessWidget {
  const _ImmersiveFeedTabs({
    required this.selectedIndex,
    required this.onChanged,
  });

  final int selectedIndex;
  final ValueChanged<int> onChanged;

  static const _labels = ['Videos', 'Photos', 'Live'];

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < _labels.length; i++)
          _ImmersiveTab(
            label: _labels[i],
            selected: i == selectedIndex,
            onTap: () => onChanged(i),
          ),
      ],
    );
  }
}

class _ImmersiveTab extends StatefulWidget {
  const _ImmersiveTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_ImmersiveTab> createState() => _ImmersiveTabState();
}

class _ImmersiveTabState extends State<_ImmersiveTab> {
  bool _held = false;

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _held = true),
      onTapUp: (_) => setState(() => _held = false),
      onTapCancel: () => setState(() => _held = false),
      child: AnimatedScale(
        scale: _held ? 0.93 : 1.0,
        duration: const Duration(milliseconds: 90),
        curve: Curves.easeOut,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedDefaultTextStyle(
                duration: FeedImmersiveTheme.motionFast,
                curve: FeedImmersiveTheme.settleCurve,
                style: TextStyle(
                  color: selected ? Colors.white : Colors.white60,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  fontSize: 16,
                  letterSpacing: selected ? 0.0 : 0.1,
                  shadows: FeedImmersiveTheme.textShadow,
                ),
                child: Text(widget.label),
              ),
              const SizedBox(height: 5),
              AnimatedContainer(
                duration: FeedImmersiveTheme.motionFast,
                curve: FeedImmersiveTheme.settleCurve,
                height: 3,
                width: selected ? 24 : 0,
                decoration: const BoxDecoration(
                  gradient: FeedImmersiveTheme.brandGradient,
                  borderRadius: BorderRadius.all(Radius.circular(2)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ImmersiveEmptyState extends StatelessWidget {
  const _ImmersiveEmptyState({
    required this.tabIndex,
    required this.topPadding,
    required this.onRefresh,
  });

  final int tabIndex;
  final double topPadding;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final isVideo = tabIndex == 0;
    final title = isVideo ? 'No videos yet' : 'No posts yet';
    final body = isVideo
        ? 'Pull down to refresh or create a video post.'
        : 'Pull down to refresh or create the first post.';
    return Padding(
      padding: EdgeInsets.only(top: topPadding),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isVideo ? Icons.play_circle_outline : Icons.dynamic_feed_outlined,
              color: Colors.white70,
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedStatusBanner extends StatelessWidget {
  const _FeedStatusBanner({
    required this.message,
    required this.pendingActionCount,
  });

  final String? message;
  final int pendingActionCount;

  @override
  Widget build(BuildContext context) {
    final text = [
      if (pendingActionCount > 0)
        '$pendingActionCount offline action${pendingActionCount == 1 ? '' : 's'} queued',
      if (message != null) message!,
    ].join(' · ');
    if (text.isEmpty) return const SizedBox.shrink();
    return IgnorePointer(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ),
      ),
    );
  }
}

class _LiveFeedList extends StatelessWidget {
  const _LiveFeedList({required this.liveFuture, required this.topPadding});

  final Future<List<LiveFeedItem>> liveFuture;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<LiveFeedItem>>(
      future: liveFuture,
      builder: (context, snapshot) {
        final items = snapshot.data;
        if (items == null) {
          return Padding(
            padding: EdgeInsets.only(top: topPadding + 40),
            child: const Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),
          );
        }
        if (items.isEmpty) {
          return ListView(
            padding: EdgeInsets.fromLTRB(16, topPadding, 16, 24),
            children: const [_EmptyLiveState()],
          );
        }
        return ListView.separated(
          padding: EdgeInsets.fromLTRB(16, topPadding, 16, 24),
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) => _LiveFeedCard(item: items[index]),
        );
      },
    );
  }
}

class _LiveFeedCard extends StatelessWidget {
  const _LiveFeedCard({required this.item});

  final LiveFeedItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (item.thumbnailUrl != null && item.thumbnailUrl!.isNotEmpty)
              Image.network(item.thumbnailUrl!, fit: BoxFit.cover)
            else
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF111827), Color(0xFFBE185D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.82),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 12,
              top: 12,
              child: Chip(
                avatar: const Icon(Icons.circle, color: Colors.red, size: 14),
                label: Text(item.type == 'space' ? 'LIVE SPACE' : 'LIVE'),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              bottom: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.hostName} · ${item.viewerCount} watching${item.topic == null ? '' : ' · ${item.topic}'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyLiveState extends StatelessWidget {
  const _EmptyLiveState();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Icon(Icons.sensors, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            const Expanded(
              child: Text('No live streams or spaces are active right now.'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentSheet extends StatefulWidget {
  const _CommentSheet({required this.post});

  final FeedPost post;

  @override
  State<_CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<_CommentSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Comments',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            widget.post.body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 5,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Add a comment',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(_controller.text),
              icon: const Icon(Icons.send),
              label: const Text('Comment'),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedActionButton extends StatelessWidget {
  const _FeedActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor: Theme.of(context).colorScheme.onSurfaceVariant,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        minimumSize: const Size(0, 40),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}

class PostDetailScreen extends StatelessWidget {
  const PostDetailScreen({
    super.key,
    required this.post,
    required this.isSaved,
    required this.onLike,
    required this.onSave,
    required this.onComment,
    required this.onRefeed,
    required this.onShare,
  });

  final FeedPost post;
  final bool isSaved;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Post')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                child: Text(post.authorName.characters.first.toUpperCase()),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      post.authorName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      [
                        post.meta,
                        if (post.location?.isNotEmpty ?? false) post.location!,
                      ].join(' · '),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (post.body.trim().isNotEmpty)
            Text(post.body, style: Theme.of(context).textTheme.titleMedium),
          if ((post.mediaUrl ?? post.mediaUrls.firstOrNull) != null) ...[
            const SizedBox(height: 16),
            FeedMediaPreview(post: post),
          ],
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _PostMetric(label: 'Likes', value: post.likesCount),
              _PostMetric(label: 'Comments', value: post.commentsCount),
              _PostMetric(label: 'Views', value: post.viewsCount),
              _PostMetric(label: 'Refeeds', value: post.refeedsCount),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.spaceBetween,
            children: [
              _FeedActionButton(
                icon: Icons.favorite_border,
                label: 'Like',
                onPressed: onLike,
              ),
              _FeedActionButton(
                icon: Icons.mode_comment_outlined,
                label: 'Comment',
                onPressed: onComment,
              ),
              _FeedActionButton(
                icon: Icons.repeat,
                label: 'Refeed',
                onPressed: onRefeed,
              ),
              _FeedActionButton(
                icon: isSaved ? Icons.bookmark : Icons.bookmark_border,
                label: isSaved ? 'Saved' : 'Save',
                onPressed: onSave,
              ),
              _FeedActionButton(
                icon: Icons.ios_share,
                label: 'Share',
                onPressed: onShare,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PostMetric extends StatelessWidget {
  const _PostMetric({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text('$value $label'),
      avatar: const Icon(Icons.trending_up, size: 16),
    );
  }
}

class FeedMediaPreview extends StatelessWidget {
  const FeedMediaPreview({super.key, required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context) {
    final mediaType =
        post.mediaType ??
        (post.mediaTypes.isNotEmpty ? post.mediaTypes.first : null);
    final mediaUrl = post.mediaUrl ?? post.mediaUrls.firstOrNull;
    if (mediaType == 'video') {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
            ),
            child: FeedVideoPlayer(
              url: mediaUrl,
              localPath: post.localMediaPath,
            ),
          ),
        ),
      );
    }

    final localPath = post.localMediaPath;
    final image = localPath != null && File(localPath).existsSync()
        ? Image.file(
            File(localPath),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _RemoteImageFallback(url: mediaUrl),
          )
        : _RemoteImageFallback(url: mediaUrl);

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: AspectRatio(aspectRatio: 4 / 3, child: image),
    );
  }
}

class _RemoteImageFallback extends StatelessWidget {
  const _RemoteImageFallback({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    final source = url;
    if (source == null || source.isEmpty) {
      return ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
      );
    }

    return Image.network(
      source,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: const Center(child: Icon(Icons.broken_image_outlined)),
      ),
    );
  }
}

class ProfilePanel extends StatelessWidget {
  const ProfilePanel({super.key, required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.displayName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '@${profile.handle}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                if (profile.bio.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    profile.bio,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                const Text('Stored locally'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class PlaceholderPanel extends StatelessWidget {
  const PlaceholderPanel({super.key, required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    body,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
