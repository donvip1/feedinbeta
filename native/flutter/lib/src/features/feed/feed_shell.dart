import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/notifications/push_notification_service.dart';
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
import '../../data/remote/post_views_remote_data_source.dart';
import '../groups/screens/groups_screen.dart';
import '../wallet/wallet_screen.dart';
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
    required this.pushNotificationService,
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
  final PushNotificationService pushNotificationService;
  final VoidCallback onSignOut;

  @override
  State<FeedShell> createState() => _FeedShellState();
}

class _FeedShellState extends State<FeedShell> {
  int _index = 0;
  bool _showNotifications = false;
  late final StreamSubscription<FeedinRealtimeEvent> _realtimeSubscription;
  StreamSubscription<String>? _pushTapSub;
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
    unawaited(_initPush());
  }

  @override
  void dispose() {
    _realtimeSubscription.cancel();
    _pushTapSub?.cancel();
    widget.foregroundSyncCoordinator.stop();
    widget.realtimeService.disconnect();
    super.dispose();
  }

  Future<void> _connectRealtime() async {
    await widget.realtimeService.connect();
    if (!mounted) return;
    setState(() => _realtimeConnected = widget.realtimeService.isConnected);
  }

  /// Set up push notifications once the authenticated shell is mounted: request
  /// permission, register this device's FCM token for the user, and route
  /// notification taps (foreground/background/terminated) into the existing
  /// notification deep-link handler.
  Future<void> _initPush() async {
    final push = widget.pushNotificationService;
    await push.initialize();
    await push.registerForUser();
    if (!mounted) return;
    _pushTapSub = push.notificationTaps.listen(_openNotificationRoute);
    final initialRoute = await push.initialRoute();
    if (initialRoute != null && mounted) {
      _openNotificationRoute(initialRoute);
    }
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
      case FeedinRealtimeEventType.notificationChanged:
        _refreshNotificationBadge();
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
        _index = 1;
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

  /// Create is a floating "+" action (web parity), pushed as a full route.
  Future<void> _openCreate() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Create')),
          body: CreatePostScreen(
            draftRepository: widget.postDraftRepository,
            uploadQueueRepository: widget.uploadQueueRepository,
            uploadQueueService: widget.uploadQueueService,
            onPostUploaded: () => setState(() => _feedRealtimeVersion++),
          ),
        ),
      ),
    );
  }

  /// Settings lives under Profile (web parity), pushed as a full route.
  void _openSettings() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Settings')),
          body: SettingsScreen(
            syncService: widget.syncService,
            uploadQueueService: widget.uploadQueueService,
            storageDiagnosticsService: widget.storageDiagnosticsService,
            preferencesRepository: widget.preferencesRepository,
            realtimeConnected: _realtimeConnected,
            storageMaintenance: widget.storageMaintenance,
            onSignOut: widget.onSignOut,
          ),
        ),
      ),
    );
  }

  /// Groups (group conversations) — reachable from the Chats tab app bar.
  void _openGroups() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeCtx) => Scaffold(
          backgroundColor: Colors.black,
          body: GroupsScreen(
            currentUserId: _profile.userId,
            onBack: () => Navigator.of(routeCtx).pop(),
          ),
        ),
      ),
    );
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
      MessagesScreen(
        messagesRepository: widget.messagesRepository,
        conversationStarter: widget.conversationStarter,
        syncService: widget.syncService,
        profile: _profile,
        realtimeVersion: _messagesRealtimeVersion,
        initialConversationId: _initialConversationId,
      ),
      const WalletScreen(),
      ProfileEditorScreen(
        profile: _profile,
        profileRepository: widget.profileRepository,
        feedRepository: widget.feedRepository,
        onSaved: (profile) => setState(() => _profile = profile),
      ),
    ];

    // The feed (immersive) and Wallet both draw their own chrome, so the shared
    // AppBar is hidden while either is on screen.
    final immersiveFeed = _index == 0 && !_showNotifications;
    final hideAppBar = immersiveFeed || (_index == 2 && !_showNotifications);

    return Scaffold(
      backgroundColor: immersiveFeed ? Colors.black : null,
      appBar: hideAppBar
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
                if (_index == 1)
                  IconButton(
                    tooltip: 'Groups',
                    onPressed: _openGroups,
                    icon: const Icon(Icons.groups_2_outlined),
                  ),
                if (_index == 3)
                  IconButton(
                    tooltip: 'Settings',
                    onPressed: _openSettings,
                    icon: const Icon(Icons.settings_outlined),
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
      floatingActionButton: (immersiveFeed || _showNotifications)
          ? null
          : FloatingActionButton(
              onPressed: _openCreate,
              tooltip: 'Create',
              child: const Icon(Icons.add),
            ),
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
            icon: Icon(Icons.mail_outline),
            selectedIcon: Icon(Icons.mail),
            label: 'Chats',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Wallet',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
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
  final PostViewsRemoteDataSource _postViews =
      PostViewsRemoteDataSource.autoDetect();
  int _pendingActionCount = 0;
  String? _message;
  int _tabIndex = 0;
  int _activePage = 0;
  bool _isLoadingMore = false;
  bool _hasMorePosts = true;
  final Set<String> _savedPostIds = {};
  final Set<String> _likedPostIds = {};
  // Posts whose view has been recorded this session, so a post is counted once
  // even if it scrolls in and out of focus.
  final Set<String> _recordedViewIds = {};

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

  /// Best-effort record that [post] was viewed. De-duplicated per session so a
  /// post is counted once, and never allowed to disrupt the feed (the data
  /// source swallows remote errors).
  void _recordView(FeedPost post) {
    if (!_recordedViewIds.add(post.id)) return;
    unawaited(_postViews.recordView(post.id));
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
          content = _ImmersiveLoadingState(topPadding: overlayHeight);
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
    // Record a view for whichever post is currently in focus — covers the first
    // post on load and the active post after every page change / tab switch.
    // Scheduled post-frame so it never calls into recordView during build; the
    // per-session id set keeps it to one record per post.
    if (posts.isNotEmpty) {
      final activePost = posts[_activePage.clamp(0, posts.length - 1)];
      if (!_recordedViewIds.contains(activePost.id)) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _recordView(activePost),
        );
      }
    }
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

/// Branded full-bleed loading state for the immersive feed: a soft pulsing
/// glyph over black, replacing the bare white spinner so the first paint feels
/// intentional rather than empty.
class _ImmersiveLoadingState extends StatefulWidget {
  const _ImmersiveLoadingState({required this.topPadding});

  final double topPadding;

  @override
  State<_ImmersiveLoadingState> createState() => _ImmersiveLoadingStateState();
}

class _ImmersiveLoadingStateState extends State<_ImmersiveLoadingState>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: widget.topPadding),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FadeTransition(
              opacity: Tween(begin: 0.45, end: 1.0).animate(_controller),
              child: ScaleTransition(
                scale: Tween(begin: 0.92, end: 1.04).animate(
                  CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
                ),
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: FeedImmersiveTheme.brandGradient,
                    boxShadow: [
                      BoxShadow(color: Color(0x66FF3D9A), blurRadius: 24),
                    ],
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Loading your feed…',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

/// Looping left-to-right shimmer used by skeleton placeholders.
class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.child});

  final Widget child;

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final dx = bounds.width * (_controller.value * 2 - 1);
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: const [
                Color(0x14FFFFFF),
                Color(0x33FFFFFF),
                Color(0x14FFFFFF),
              ],
              stops: const [0.35, 0.5, 0.65],
              transform: _SlideGradient(dx),
            ).createShader(bounds);
          },
          child: child,
        );
      },
    );
  }
}

class _SlideGradient extends GradientTransform {
  const _SlideGradient(this.dx);

  final double dx;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(dx, 0, 0);
  }
}

/// Skeleton placeholder for a live card while the live list loads.
class _LiveCardSkeleton extends StatelessWidget {
  const _LiveCardSkeleton();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: AspectRatio(
        aspectRatio: 9 / 16,
        child: _Shimmer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  _SkeletonBar(width: 120, height: 14),
                  const SizedBox(height: 12),
                  _SkeletonBar(width: double.infinity, height: 18),
                  const SizedBox(height: 8),
                  _SkeletonBar(width: 180, height: 18),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.12),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _SkeletonBar(width: 100, height: 12),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _SkeletonBar(width: double.infinity, height: 46, radius: 14),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SkeletonBar extends StatelessWidget {
  const _SkeletonBar({
    required this.width,
    required this.height,
    this.radius = 8,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(radius),
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
        // Cap card height at ~70% of the viewport (web `max-h-[70vh]`) so the
        // portrait 9:16 cards stay one-per-screen on tall/wide displays.
        final maxCardHeight = MediaQuery.of(context).size.height * 0.7;
        if (items == null) {
          return ListView(
            padding: EdgeInsets.fromLTRB(16, topPadding, 16, 24),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: maxCardHeight),
                  child: const _LiveCardSkeleton(),
                ),
              ),
            ],
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
          separatorBuilder: (_, _) => const SizedBox(height: 16),
          itemBuilder: (context, index) => Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: maxCardHeight),
              child: _LiveFeedCard(item: items[index]),
            ),
          ),
        );
      },
    );
  }
}

/// Tall, premium portrait live card matching the web `LiveFeedCard`: a 9:16
/// thumbnail (or gradient fallback for spaces/streams) with a pulsing LIVE
/// badge, a viewer-count pill, an optional topic chip, a host row with a
/// ring-framed avatar, and a full-width join / watch button.
class _LiveFeedCard extends StatelessWidget {
  const _LiveFeedCard({required this.item});

  final LiveFeedItem item;

  bool get _isSpace => item.type == 'space';

  @override
  Widget build(BuildContext context) {
    final hasThumb = item.thumbnailUrl != null && item.thumbnailUrl!.isNotEmpty;
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: AspectRatio(
        aspectRatio: 9 / 16,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0x80FF2D55), width: 2),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background: thumbnail or themed gradient with an animated
              // pulse for spaces (audio) vs streams (video).
              if (hasThumb)
                Image.network(
                  item.thumbnailUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => _LiveCardBackdrop(isSpace: _isSpace),
                )
              else
                _LiveCardBackdrop(isSpace: _isSpace),

              // Legibility scrim.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x4D000000),
                      Color(0x66000000),
                      Color(0xE6000000),
                    ],
                    stops: [0.0, 0.45, 1.0],
                  ),
                ),
              ),

              // LIVE + type badges, top-left.
              Positioned(
                left: 12,
                top: 12,
                child: Row(
                  children: [
                    const _PulsingLiveBadge(),
                    const SizedBox(width: 6),
                    _LiveTag(
                      icon: _isSpace ? Icons.mic : Icons.podcasts,
                      label: _isSpace ? 'Space' : 'Stream',
                    ),
                  ],
                ),
              ),

              // Viewer count, top-right.
              Positioned(
                right: 12,
                top: 12,
                child: _LiveTag(
                  icon: Icons.people_alt_outlined,
                  label: _formatViewers(item.viewerCount),
                ),
              ),

              // Title, host, and join button, bottom.
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (item.topic != null && item.topic!.trim().isNotEmpty) ...[
                      _TopicChip(label: item.topic!.trim()),
                      const SizedBox(height: 10),
                    ],
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        height: 1.15,
                        shadows: [
                          Shadow(color: Color(0x99000000), blurRadius: 8),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _LiveHostRow(hostName: item.hostName),
                    const SizedBox(height: 14),
                    _LiveJoinButton(isSpace: _isSpace),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Themed gradient backdrop for a thumbnail-less live card. Spaces get an
/// animated audio-wave motif; streams get a soft pulsing broadcast glyph.
class _LiveCardBackdrop extends StatefulWidget {
  const _LiveCardBackdrop({required this.isSpace});

  final bool isSpace;

  @override
  State<_LiveCardBackdrop> createState() => _LiveCardBackdropState();
}

class _LiveCardBackdropState extends State<_LiveCardBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  // Per-bar phase offsets so the equaliser doesn't move in lockstep.
  static const _barCount = 14;
  late final List<double> _phases = [
    for (var i = 0; i < _barCount; i++) (i * 0.37) % 1.0,
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gradient = widget.isSpace
        ? const LinearGradient(
            colors: [Color(0xFF2A1257), Color(0xFF6B1FB3), Color(0xFF3A0F66)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          )
        : const LinearGradient(
            colors: [Color(0xFF3D0A1F), Color(0xFFBE185D), Color(0xFF7A1030)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );

    return DecoratedBox(
      decoration: BoxDecoration(gradient: gradient),
      child: Center(
        child: widget.isSpace
            ? AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      for (var i = 0; i < _barCount; i++) ...[
                        _EqualizerBar(
                          value: _controller.value,
                          phase: _phases[i],
                        ),
                        if (i != _barCount - 1) const SizedBox(width: 4),
                      ],
                    ],
                  );
                },
              )
            : FadeTransition(
                opacity: Tween(begin: 0.35, end: 0.7).animate(_controller),
                child: const Icon(
                  Icons.podcasts,
                  size: 72,
                  color: Color(0x66FFFFFF),
                ),
              ),
      ),
    );
  }
}

class _EqualizerBar extends StatelessWidget {
  const _EqualizerBar({required this.value, required this.phase});

  final double value;
  final double phase;

  @override
  Widget build(BuildContext context) {
    // Triangle wave from the controller value offset by the bar's phase.
    final t = (value + phase) % 1.0;
    final amplitude = (t < 0.5 ? t : 1.0 - t) * 2; // 0..1
    final height = 16 + amplitude * 56;
    return Container(
      width: 5,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0x99FF3D9A),
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }
}

/// Red "LIVE" badge with a softly pulsing dot, mirroring the web's
/// `bg-red-500 animate-pulse` badge.
class _PulsingLiveBadge extends StatefulWidget {
  const _PulsingLiveBadge();

  @override
  State<_PulsingLiveBadge> createState() => _PulsingLiveBadgeState();
}

class _PulsingLiveBadgeState extends State<_PulsingLiveBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFFF2D55),
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(color: Color(0x66FF2D55), blurRadius: 10),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: Tween(begin: 0.4, end: 1.0).animate(_controller),
            child: Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 6),
          const Text(
            'LIVE',
            style: TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }
}

/// Small translucent pill (icon + label) used for the type and viewer badges.
class _LiveTag extends StatelessWidget {
  const _LiveTag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.white),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _TopicChip extends StatelessWidget {
  const _TopicChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _LiveHostRow extends StatelessWidget {
  const _LiveHostRow({required this.hostName});

  final String hostName;

  @override
  Widget build(BuildContext context) {
    final trimmed = hostName.trim();
    final initial = trimmed.isEmpty
        ? 'H'
        : trimmed.characters.first.toUpperCase();
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xB3FF2D55), width: 2),
          ),
          padding: const EdgeInsets.all(2),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [Color(0xFFFF3D9A), Color(0xFFFF7A45)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Center(
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            trimmed.isEmpty ? 'Host' : trimmed,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              shadows: [Shadow(color: Color(0x99000000), blurRadius: 6)],
            ),
          ),
        ),
      ],
    );
  }
}

class _LiveJoinButton extends StatelessWidget {
  const _LiveJoinButton({required this.isSpace});

  final bool isSpace;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 46,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFFFF2D55),
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [
            BoxShadow(
              color: Color(0x40FF2D55),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSpace ? Icons.headphones : Icons.play_arrow,
              size: 20,
              color: Colors.white,
            ),
            const SizedBox(width: 8),
            Text(
              isSpace ? 'Join Space' : 'Watch Live',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
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
    return Padding(
      padding: const EdgeInsets.only(top: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.06),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            ),
            child: const Icon(Icons.sensors, color: Colors.white70, size: 40),
          ),
          const SizedBox(height: 18),
          const Text(
            'Nothing live right now',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              'When someone starts a stream or audio space, it will show up here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white60, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatViewers(int value) {
  if (value >= 1000000) {
    final v = (value / 1000000).toStringAsFixed(1);
    return '${v.endsWith('.0') ? v.substring(0, v.length - 2) : v}M';
  }
  if (value >= 1000) {
    final v = (value / 1000).toStringAsFixed(1);
    return '${v.endsWith('.0') ? v.substring(0, v.length - 2) : v}K';
  }
  return value.toString();
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
