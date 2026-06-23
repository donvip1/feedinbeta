import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';

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
import '../notifications/notifications_screen.dart';
import '../profile/profile_editor_screen.dart';
import '../profile/user_profile.dart';
import '../settings/settings_screen.dart';
import 'feed_post.dart';
import 'feed_video_player.dart';

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

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
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
      ),
      CreatePostScreen(
        draftRepository: widget.postDraftRepository,
        uploadQueueRepository: widget.uploadQueueRepository,
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

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'FEEDIN',
              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0),
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
          IconButton(
            tooltip: 'Notifications',
            onPressed: () {
              setState(() => _showNotifications = !_showNotifications);
            },
            icon: const Icon(Icons.notifications_none),
          ),
        ],
      ),
      body: _showNotifications
          ? NotificationsScreen(
              notificationRepository: widget.notificationRepository,
              onOpenRoute: _openNotificationRoute,
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

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    super.key,
    required this.feedRepository,
    required this.realtimeVersion,
  });

  final LocalFeedRepositoryContract feedRepository;
  final int realtimeVersion;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late Future<List<FeedPost>> _postsFuture;
  int _pendingActionCount = 0;
  String? _message;
  int _tabIndex = 0;
  bool _isLoadingMore = false;
  bool _hasMorePosts = true;

  @override
  void initState() {
    super.initState();
    _postsFuture = widget.feedRepository.loadPosts();
    _loadPendingActionCount();
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
      _message = 'New feed activity synced.';
    });
    await _loadPendingActionCount();
  }

  Future<void> _loadPendingActionCount() async {
    final count = await widget.feedRepository.pendingActionCount();
    if (!mounted) return;
    setState(() => _pendingActionCount = count);
  }

  Future<void> _refresh() async {
    final result = await widget.feedRepository.refresh();
    if (!mounted) return;
    setState(() {
      _postsFuture = Future.value(result.posts);
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

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<FeedPost>>(
      future: _postsFuture,
      builder: (context, snapshot) {
        final posts = snapshot.data;

        if (posts == null) {
          return const Center(child: CircularProgressIndicator());
        }

        final filteredPosts = _filterPosts(posts);

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: filteredPosts.length + 2,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index == 0) {
                return FeedHeader(
                  message: _message,
                  pendingActionCount: _pendingActionCount,
                  selectedIndex: _tabIndex,
                  onTabChanged: (value) => setState(() => _tabIndex = value),
                );
              }

              if (index == filteredPosts.length + 1) {
                return LoadMoreFeedButton(
                  enabled: _tabIndex != 2 && _hasMorePosts,
                  isLoading: _isLoadingMore,
                  onPressed: _loadMore,
                );
              }

              final post = filteredPosts[index - 1];
              return FeedPostCard(
                post: post,
                onLike: () => _queueAction(
                  () => widget.feedRepository.queueLike(post.id),
                ),
                onSave: () => _queueAction(
                  () => widget.feedRepository.queueSave(post.id),
                ),
                onComment: () => _queueAction(
                  () => widget.feedRepository.queueComment(
                    post.id,
                    'Queued comment',
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  List<FeedPost> _filterPosts(List<FeedPost> posts) {
    final filtered = switch (_tabIndex) {
      0 => posts.where((post) => post.mediaType == 'video').toList(),
      1 => posts.where((post) => post.mediaType != 'video').toList(),
      2 => const <FeedPost>[],
      _ => posts,
    };
    return filtered.isEmpty && _tabIndex != 2 ? posts : filtered;
  }
}

class LoadMoreFeedButton extends StatelessWidget {
  const LoadMoreFeedButton({
    super.key,
    required this.enabled,
    required this.isLoading,
    required this.onPressed,
  });

  final bool enabled;
  final bool isLoading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: OutlinedButton.icon(
        onPressed: enabled && !isLoading ? onPressed : null,
        icon: isLoading
            ? const SizedBox.square(
                dimension: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.expand_more),
        label: Text(
          isLoading
              ? 'Loading'
              : enabled
              ? 'Load more'
              : 'No more posts',
        ),
      ),
    );
  }
}

class FeedHeader extends StatelessWidget {
  const FeedHeader({
    super.key,
    required this.message,
    required this.pendingActionCount,
    required this.selectedIndex,
    required this.onTabChanged,
  });

  final String? message;
  final int pendingActionCount;
  final int selectedIndex;
  final ValueChanged<int> onTabChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: SegmentedButton<int>(
                selected: {selectedIndex},
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: 0, label: Text('Videos')),
                  ButtonSegment(value: 1, label: Text('Photos & Text')),
                  ButtonSegment(value: 2, label: Text('Live')),
                ],
                onSelectionChanged: (selection) =>
                    onTabChanged(selection.first),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0x33FF3D9A), Color(0x222563EB)],
            ),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0x33FF3D9A)),
          ),
          child: const Padding(
            padding: EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(Icons.auto_awesome, color: Color(0xFFFF3D9A)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Local-first FEEDIN preview with cached media and queued actions.',
                  ),
                ),
              ],
            ),
          ),
        ),
        if (pendingActionCount > 0 || message != null) ...[
          const SizedBox(height: 10),
          Text(
            [
              if (pendingActionCount > 0)
                '$pendingActionCount offline action${pendingActionCount == 1 ? '' : 's'} queued',
              if (message != null) message!,
            ].join(' · '),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class FeedPostCard extends StatelessWidget {
  const FeedPostCard({
    super.key,
    required this.post,
    required this.onLike,
    required this.onSave,
    required this.onComment,
  });

  final FeedPost post;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onComment;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFF3D9A), Color(0xFFFF7A45)],
                    ),
                    border: Border.all(color: Colors.white12, width: 2),
                  ),
                  child: Center(
                    child: Text(
                      post.authorName.characters.first.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.authorName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        post.meta,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'More',
                  onPressed: () {},
                  icon: const Icon(Icons.more_vert),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              post.body,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (post.mediaUrl != null) ...[
              const SizedBox(height: 12),
              FeedMediaPreview(post: post),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                  onPressed: () {},
                ),
                _FeedActionButton(
                  icon: Icons.bookmark_border,
                  label: 'Save',
                  onPressed: onSave,
                ),
                _FeedActionButton(
                  icon: Icons.ios_share,
                  label: 'Share',
                  onPressed: () {},
                ),
              ],
            ),
          ],
        ),
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
    return IconButton(
      tooltip: label,
      onPressed: onPressed,
      icon: Icon(icon, size: 22),
      style: IconButton.styleFrom(
        foregroundColor: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}

class FeedMediaPreview extends StatelessWidget {
  const FeedMediaPreview({super.key, required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context) {
    final mediaType = post.mediaType;
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
              url: post.mediaUrl,
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
            errorBuilder: (_, _, _) => _RemoteImageFallback(url: post.mediaUrl),
          )
        : _RemoteImageFallback(url: post.mediaUrl);

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
