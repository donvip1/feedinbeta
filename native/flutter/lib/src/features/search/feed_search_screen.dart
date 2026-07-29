import 'dart:async';

import 'package:flutter/material.dart';

import '../../data/local/local_feed_repository_contract.dart';
import '../feed/feed_post.dart';
import '../profile/parity/profile_tokens.dart';
import '../profile/parity/profile_view_models.dart';
import '../profile/parity/widgets/profile_avatar.dart';
import '../profile/widgets/profile_post_grid.dart';
import '../profile/parity/profile_presenter.dart';

class FeedSearchScreen extends StatefulWidget {
  const FeedSearchScreen({
    super.key,
    required this.feedRepository,
    required this.onOpenPerson,
    required this.onOpenPost,
  });

  final LocalFeedRepositoryContract feedRepository;
  final ValueChanged<FeedSearchPerson> onOpenPerson;
  final ValueChanged<FeedPost> onOpenPost;

  @override
  State<FeedSearchScreen> createState() => _FeedSearchScreenState();
}

class _FeedSearchScreenState extends State<FeedSearchScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _controller = TextEditingController();
  late final TabController _tabs = TabController(length: 3, vsync: this);
  Timer? _debounce;
  FeedSearchResults _results = const FeedSearchResults();
  bool _loading = false;
  String? _error;
  int _requestVersion = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _tabs.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(value));
  }

  Future<void> _search(String raw) async {
    final query = raw.trim();
    final version = ++_requestVersion;
    if (query.isEmpty) {
      setState(() {
        _loading = false;
        _error = null;
        _results = const FeedSearchResults();
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await widget.feedRepository.search(query);
      if (!mounted || version != _requestVersion) return;
      setState(() {
        _loading = false;
        _results = results;
      });
    } catch (_) {
      if (!mounted || version != _requestVersion) return;
      setState(() {
        _loading = false;
        _error = 'Search is unavailable right now.';
      });
    }
  }

  void _openHashtag(FeedSearchHashtag hashtag) {
    _controller.text = '#${hashtag.tag}';
    _controller.selection = TextSelection.collapsed(
      offset: _controller.text.length,
    );
    _tabs.animateTo(0);
    unawaited(_search(_controller.text));
  }

  void _openTile(PostTileView tile) {
    for (final post in _results.posts) {
      if (post.id == tile.id) {
        widget.onOpenPost(post);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ProfileColors.background,
      appBar: AppBar(
        backgroundColor: ProfileColors.background,
        foregroundColor: ProfileColors.foreground,
        title: const Text('Search'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: ProfileColors.primary,
          unselectedLabelColor: ProfileColors.mutedForeground,
          indicatorColor: ProfileColors.primary,
          tabs: const [
            Tab(text: 'Posts'),
            Tab(text: 'People'),
            Tab(text: 'Hashtags'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: TextField(
              controller: _controller,
              autofocus: true,
              onChanged: _onQueryChanged,
              textInputAction: TextInputAction.search,
              onSubmitted: _search,
              decoration: InputDecoration(
                hintText: 'Search posts, people, and hashtags',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        onPressed: () {
                          _controller.clear();
                          _onQueryChanged('');
                          setState(() {});
                        },
                        icon: const Icon(Icons.close),
                      ),
                filled: true,
                fillColor: ProfileColors.card,
                border: OutlineInputBorder(
                  borderRadius: ProfileRadii.tile,
                  borderSide: const BorderSide(color: ProfileColors.border),
                ),
              ),
            ),
          ),
          if (_loading)
            const LinearProgressIndicator(
              minHeight: 2,
              color: ProfileColors.primary,
              backgroundColor: ProfileColors.muted,
            ),
          Expanded(child: _buildResults()),
        ],
      ),
    );
  }

  Widget _buildResults() {
    final query = _controller.text.trim();
    if (_error != null) {
      return _SearchMessage(
        icon: Icons.cloud_off_outlined,
        title: _error!,
        actionLabel: 'Retry',
        onAction: () => _search(query),
      );
    }
    if (query.isEmpty) {
      return const _SearchMessage(
        icon: Icons.manage_search_rounded,
        title: 'Find something on feedIn',
        subtitle: 'Search captions, creators, usernames, and hashtags.',
      );
    }

    return TabBarView(
      controller: _tabs,
      children: [
        _results.posts.isEmpty
            ? const _SearchMessage(
                icon: Icons.dynamic_feed_outlined,
                title: 'No posts found',
              )
            : ProfilePostGrid(
                view: PostsGridView(
                  tiles: [
                    for (final post in _results.posts)
                      ProfilePresenter.tile(post),
                  ],
                ),
                onOpenTile: _openTile,
                emptyTitle: 'No posts found',
              ),
        _results.people.isEmpty
            ? const _SearchMessage(
                icon: Icons.people_outline,
                title: 'No people found',
              )
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: _results.people.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final person = _results.people[index];
                  return ListTile(
                    onTap: () => widget.onOpenPerson(person),
                    leading: ProfileAvatar(
                      diameter: 46,
                      initial: person.displayName.trim().isEmpty
                          ? 'U'
                          : person.displayName.trim().characters.first,
                      imageUrl: person.avatarUrl,
                    ),
                    title: Text(
                      person.displayName,
                      style: const TextStyle(
                        color: ProfileColors.foreground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(
                      [
                        '@${person.handle}',
                        if (person.bio?.trim().isNotEmpty == true)
                          person.bio!.trim(),
                      ].join('\n'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: ProfileColors.mutedForeground,
                      ),
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: ProfileColors.mutedForeground,
                    ),
                  );
                },
              ),
        _results.hashtags.isEmpty
            ? const _SearchMessage(icon: Icons.tag, title: 'No hashtags found')
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: _results.hashtags.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final hashtag = _results.hashtags[index];
                  return ListTile(
                    onTap: () => _openHashtag(hashtag),
                    leading: const CircleAvatar(
                      backgroundColor: ProfileColors.muted,
                      foregroundColor: ProfileColors.primary,
                      child: Icon(Icons.tag),
                    ),
                    title: Text(
                      '#${hashtag.tag}',
                      style: const TextStyle(
                        color: ProfileColors.foreground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(
                      '${hashtag.postCount} ${hashtag.postCount == 1 ? 'post' : 'posts'}',
                      style: const TextStyle(
                        color: ProfileColors.mutedForeground,
                      ),
                    ),
                  );
                },
              ),
      ],
    );
  }
}

class _SearchMessage extends StatelessWidget {
  const _SearchMessage({
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 52, color: ProfileColors.mutedForeground),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: ProfileTextStyles.emptyTitle,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: ProfileTextStyles.emptySubtitle,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 18),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
