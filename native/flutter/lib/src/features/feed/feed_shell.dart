import 'package:flutter/material.dart';

import '../../data/local/local_feed_repository_contract.dart';
import '../profile/user_profile.dart';
import '../settings/settings_screen.dart';
import 'feed_post.dart';
import '../messages/messages_screen.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../../core/storage/local_storage_maintenance.dart';
import '../../core/sync/sync_service.dart';

class FeedShell extends StatefulWidget {
  const FeedShell({
    super.key,
    required this.displayName,
    required this.profile,
    required this.feedRepository,
    required this.messagesRepository,
    required this.syncService,
    required this.storageMaintenance,
    required this.onSignOut,
  });

  final String displayName;
  final UserProfile profile;
  final LocalFeedRepositoryContract feedRepository;
  final LocalMessagesRepositoryContract messagesRepository;
  final SyncServiceContract syncService;
  final LocalStorageMaintenance storageMaintenance;
  final VoidCallback onSignOut;

  @override
  State<FeedShell> createState() => _FeedShellState();
}

class _FeedShellState extends State<FeedShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      FeedScreen(feedRepository: widget.feedRepository),
      const PlaceholderPanel(
        title: 'Create post',
        body:
            'Drafts, media picking, upload queue, and offline publishing start here.',
      ),
      MessagesScreen(
        messagesRepository: widget.messagesRepository,
        profile: widget.profile,
      ),
      ProfilePanel(profile: widget.profile),
      SettingsScreen(
        syncService: widget.syncService,
        storageMaintenance: widget.storageMaintenance,
        onSignOut: widget.onSignOut,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('FEEDIN'),
            Text(
              widget.displayName,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Feed',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle),
            label: 'Create',
          ),
          NavigationDestination(
            icon: Icon(Icons.mail_outline),
            selectedIcon: Icon(Icons.mail),
            label: 'Messages',
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
  const FeedScreen({super.key, required this.feedRepository});

  final LocalFeedRepositoryContract feedRepository;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late Future<List<FeedPost>> _postsFuture;
  int _pendingActionCount = 0;
  String? _message;

  @override
  void initState() {
    super.initState();
    _postsFuture = widget.feedRepository.loadPosts();
    _loadPendingActionCount();
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
    });
    await _loadPendingActionCount();
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

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: posts.length + 1,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index == 0) {
                return FeedHeader(
                  message: _message,
                  pendingActionCount: _pendingActionCount,
                );
              }

              final post = posts[index - 1];
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
}

class FeedHeader extends StatelessWidget {
  const FeedHeader({
    super.key,
    required this.message,
    required this.pendingActionCount,
  });

  final String? message;
  final int pendingActionCount;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(label: Text('Local-first')),
            Chip(label: Text('Cross-platform')),
            Chip(label: Text('Server-secured')),
          ],
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
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              post.authorName,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              post.body,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              post.meta,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.favorite_border),
                  label: const Text('Like'),
                  onPressed: onLike,
                ),
                ActionChip(
                  avatar: const Icon(Icons.bookmark_border),
                  label: const Text('Save'),
                  onPressed: onSave,
                ),
                ActionChip(
                  avatar: const Icon(Icons.mode_comment_outlined),
                  label: const Text('Comment'),
                  onPressed: onComment,
                ),
              ],
            ),
          ],
        ),
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
