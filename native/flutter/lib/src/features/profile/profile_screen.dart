/// Modern, visually-rich profile screen (the Profile tab entry point).
///
/// Composes the small reusable widgets under `widgets/` into a collapsing
/// header + pinned 4-tab content section:
///   * [ProfileHeader]    — cover banner, overlapping avatar with an online dot,
///                          name + verified/role/plan badges, @handle, bio, a
///                          location/website meta row and the Edit/Settings
///                          actions.
///   * [ProfileStatsRow]  — tappable Posts / Followers / Following / Views.
///   * [ProfileTabBar]    — Posts / Reels / Tagged / Saved.
///   * [ProfilePostGrid]  — the grid body for each tab (skeleton / empty /
///                          error+retry / loaded).
///
/// Data:
///   * Posts + Reels grids are backed by [LocalFeedRepositoryContract]. The
///     screen loads the user's posts once via `loadPostsByUser(userId)`, maps
///     them to tiles with [ProfilePresenter], and filters: Posts = all tiles,
///     Reels = video tiles only.
///   * Tagged + Saved have no native source yet, so they render honest empty
///     states rather than fabricated content.
///
/// This is a pure widget: it takes its inputs (profile, repositories, callbacks)
/// via the constructor and performs no Supabase singleton work at construction.
/// The follow graph used by the Followers/Following modal is optional and falls
/// back to [SocialGraphRemoteDataSource.autoDetect] like the existing editor.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/profile_repository_contract.dart';
import '../../data/remote/social_graph_remote_data_source.dart';
import '../feed/feed_post.dart';
import 'parity/profile_presenter.dart';
import 'parity/profile_tokens.dart';
import 'parity/profile_view_models.dart';
import 'parity/widgets/connections_modal.dart';
import 'profile_editor_screen.dart';
import 'user_profile.dart';
import 'widgets/profile_header.dart';
import 'widgets/profile_post_grid.dart';
import 'widgets/profile_stats_row.dart';
import 'widgets/profile_tab_bar.dart';

/// The Profile tab. Constructor mirrors [ProfileEditorScreen] so the coordinator
/// can drop it into the shell where the editor is built today, adding two
/// callbacks: [onEditSaved] (fires when the pushed editor saves) and
/// [onOpenSettings] (the shell wires app settings).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.profile,
    required this.profileRepository,
    required this.feedRepository,
    required this.onEditSaved,
    required this.onOpenSettings,
    this.socialGraphDataSource,
  });

  /// The current user's profile (same object the Profile tab has today).
  final UserProfile profile;

  /// Passed through to the editor for save/sync.
  final ProfileRepositoryContract profileRepository;

  /// Source for the Posts/Reels grids and for the editor.
  final LocalFeedRepositoryContract feedRepository;

  /// Fires with the updated profile whenever the pushed editor saves, so the
  /// host can update its own copy (mirrors the editor's `onSaved`).
  final ValueChanged<UserProfile> onEditSaved;

  /// Opens app settings — wired by the coordinator/shell.
  final VoidCallback onOpenSettings;

  /// Live follow-graph access for the Followers/Following modal. Optional;
  /// falls back to an auto-detecting instance like the editor.
  final SocialGraphRemoteDataSource? socialGraphDataSource;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late final SocialGraphRemoteDataSource _socialGraph;
  late UserProfile _profile;

  List<FeedPost> _posts = const [];
  bool _postsLoading = true;
  bool _postsError = false;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    _tabController = TabController(length: 4, vsync: this);
    _socialGraph =
        widget.socialGraphDataSource ??
        SocialGraphRemoteDataSource.autoDetect();
    _loadPosts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadPosts() async {
    if (!_postsLoading || _posts.isNotEmpty) {
      setState(() {
        _postsLoading = true;
        _postsError = false;
      });
    }
    try {
      final posts = await widget.feedRepository.loadPostsByUser(_profile.userId);
      if (!mounted) return;
      setState(() {
        _posts = posts;
        _postsLoading = false;
        _postsError = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _postsLoading = false;
        _postsError = true;
      });
    }
  }

  // --- Actions -------------------------------------------------------------

  Future<void> _openEditor() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          backgroundColor: ProfileColors.background,
          appBar: AppBar(
            backgroundColor: ProfileColors.background,
            foregroundColor: ProfileColors.foreground,
            title: const Text('Edit profile'),
          ),
          body: ProfileEditorScreen(
            profile: _profile,
            profileRepository: widget.profileRepository,
            feedRepository: widget.feedRepository,
            socialGraphDataSource: widget.socialGraphDataSource,
            onSaved: (updated) {
              setState(() => _profile = updated);
              widget.onEditSaved(updated);
            },
          ),
        ),
      ),
    );
    // The editor may have added/changed posts; refresh the grids on return.
    if (mounted) _loadPosts();
  }

  void _openConnections(ConnectionsTab tab) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ProfileColors.card,
      barrierColor: ProfileColors.barrier,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: ProfileRadii.sheetTop),
      builder: (_) => _ConnectionsSheet(
        profile: _profile,
        socialGraph: _socialGraph,
        defaultTab: tab,
      ),
    );
  }

  void _onStatTap(ProfileStat stat) {
    switch (stat) {
      case ProfileStat.posts:
        _tabController.animateTo(0);
      case ProfileStat.followers:
        _openConnections(ConnectionsTab.followers);
      case ProfileStat.following:
        _openConnections(ConnectionsTab.following);
      case ProfileStat.views:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Total views across your posts.'),
          ),
        );
    }
  }

  Future<void> _openLink(String url) async {
    final uri = _normaliseUrl(url);
    if (uri != null) {
      try {
        final launched = await launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
        );
        if (launched) return;
      } catch (_) {
        // fall through to clipboard fallback below
      }
    }
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Could not open link; copied to clipboard')),
    );
  }

  static Uri? _normaliseUrl(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    final withScheme =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : 'https://$trimmed';
    return Uri.tryParse(withScheme);
  }

  void _onOpenTile(PostTileView tile) {
    // Post-detail navigation is wired upstream once a post-detail route is
    // exposed to the Profile tab (mirrors the parity grid's behavior).
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Post detail opens once wired.')),
    );
  }

  // --- Build ---------------------------------------------------------------

  List<PostTileView> get _allTiles => [
    for (final post in _posts) ProfilePresenter.tile(post),
  ];

  @override
  Widget build(BuildContext context) {
    final allTiles = _allTiles;
    final reelTiles = [
      for (final tile in allTiles)
        if (tile.media == PostTileMedia.video) tile,
    ];

    final counts = ProfileCountsView(
      posts: _posts.length,
      followers: _profile.followersCount,
      following: _profile.followingCount,
      views: _profile.totalViews,
    );

    return ColoredBox(
      color: ProfileColors.background,
      child: NestedScrollView(
        headerSliverBuilder: (context, _) => [
          SliverToBoxAdapter(
            child: ProfileHeader(
              profile: _profile,
              onEditProfile: _openEditor,
              onOpenSettings: widget.onOpenSettings,
              onOpenLink: _openLink,
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                ProfileSpacing.lg,
                ProfileSpacing.md,
                ProfileSpacing.lg,
                ProfileSpacing.lg,
              ),
              child: ProfileStatsRow(counts: counts, onTap: _onStatTap),
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _PinnedTabBar(
              child: ProfileTabBar(controller: _tabController),
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            // Posts — all tiles.
            _RefreshableTab(
              onRefresh: _loadPosts,
              storageKey: 'profile-posts',
              child: ProfilePostGrid(
                view: PostsGridView(
                  tiles: allTiles,
                  isOwnProfile: true,
                  isLoading: _postsLoading,
                ),
                hasError: _postsError,
                onRetry: _loadPosts,
                onOpenTile: _onOpenTile,
                emptyTitle: 'No posts yet',
                emptySubtitle: 'Posts you share will show up here.',
              ),
            ),
            // Reels — video tiles only.
            _RefreshableTab(
              onRefresh: _loadPosts,
              storageKey: 'profile-reels',
              child: ProfilePostGrid(
                view: PostsGridView(
                  tiles: reelTiles,
                  isOwnProfile: true,
                  isLoading: _postsLoading,
                ),
                hasError: _postsError,
                onRetry: _loadPosts,
                onOpenTile: _onOpenTile,
                emptyIcon: Icons.movie_creation_outlined,
                emptyTitle: 'No reels yet',
                emptySubtitle: 'Videos you post will appear here.',
              ),
            ),
            // Tagged — no native source yet: honest empty state.
            ProfilePostGrid(
              view: const PostsGridView(isOwnProfile: true),
              onOpenTile: _onOpenTile,
              emptyIcon: Icons.person_pin_outlined,
              emptyTitle: 'No tags yet',
              emptySubtitle: 'Posts you\'re tagged in will show up here.',
            ),
            // Saved — no native source yet: honest empty state.
            ProfilePostGrid(
              view: const PostsGridView(isOwnProfile: true),
              onOpenTile: _onOpenTile,
              emptyIcon: Icons.bookmark_border_rounded,
              emptyTitle: 'Nothing saved yet',
              emptySubtitle: 'Save posts to find them again here.',
            ),
          ],
        ),
      ),
    );
  }
}

/// Wraps a tab body in a [RefreshIndicator] + [PageStorage] key so pull-to-
/// refresh works and scroll position is preserved across tab switches.
class _RefreshableTab extends StatelessWidget {
  const _RefreshableTab({
    required this.onRefresh,
    required this.storageKey,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final String storageKey;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: ProfileColors.primary,
      backgroundColor: ProfileColors.card,
      onRefresh: onRefresh,
      child: KeyedSubtree(
        key: PageStorageKey<String>(storageKey),
        child: child,
      ),
    );
  }
}

/// Pinned tab-bar header delegate. Fixed extent (icon + label tab height) with
/// an opaque background so scrolled content does not show through.
class _PinnedTabBar extends SliverPersistentHeaderDelegate {
  const _PinnedTabBar({required this.child});

  final Widget child;

  static const double _extent = 72;

  @override
  double get minExtent => _extent;

  @override
  double get maxExtent => _extent;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return ColoredBox(
      color: ProfileColors.background,
      child: SizedBox.expand(child: child),
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedTabBar oldDelegate) =>
      oldDelegate.child != child;
}

/// Stateful host for the Followers/Following modal: loads rows from the live
/// follow graph and drives inline follow/unfollow toggles, rendering the
/// presentational [ConnectionsModalBody]. Mirrors the editor's sheet so the two
/// profile surfaces behave identically.
class _ConnectionsSheet extends StatefulWidget {
  const _ConnectionsSheet({
    required this.profile,
    required this.socialGraph,
    required this.defaultTab,
  });

  final UserProfile profile;
  final SocialGraphRemoteDataSource socialGraph;
  final ConnectionsTab defaultTab;

  @override
  State<_ConnectionsSheet> createState() => _ConnectionsSheetState();
}

class _ConnectionsSheetState extends State<_ConnectionsSheet> {
  List<SocialConnection> _followers = const [];
  List<SocialConnection> _following = const [];
  final Set<String> _processing = <String>{};
  bool _isLoading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        widget.socialGraph.fetchFollowers(widget.profile.userId),
        widget.socialGraph.fetchFollowing(widget.profile.userId),
      ]);
      if (!mounted) return;
      setState(() {
        _followers = results[0];
        _following = results[1];
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _failed = true;
      });
    }
  }

  Future<void> _toggleFollow(ProfileUserRef user) async {
    if (_processing.contains(user.id)) return;
    setState(() => _processing.add(user.id));
    try {
      final nowFollowing = await widget.socialGraph.toggleFollow(user.id);
      if (!mounted) return;
      setState(() {
        _followers = _applyFollowState(_followers, user.id, nowFollowing);
        _following = _applyFollowState(_following, user.id, nowFollowing);
      });
    } catch (_) {
      // Leave state unchanged on failure; the row simply stops processing.
    } finally {
      if (mounted) {
        setState(() => _processing.remove(user.id));
      }
    }
  }

  static List<SocialConnection> _applyFollowState(
    List<SocialConnection> list,
    String userId,
    bool isFollowedByMe,
  ) {
    return [
      for (final c in list)
        if (c.userId == userId)
          SocialConnection(
            userId: c.userId,
            displayName: c.displayName,
            username: c.username,
            avatarUrl: c.avatarUrl,
            bio: c.bio,
            isFollowedByMe: isFollowedByMe,
          )
        else
          c,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final view = _isLoading
        ? ProfilePresenter.connections(
            widget.profile,
            defaultTab: widget.defaultTab,
            isLoading: true,
          )
        : _failed
        ? ConnectionsModalView(
            followersCount: widget.profile.followersCount,
            followingCount: widget.profile.followingCount,
            defaultTab: widget.defaultTab,
            listsUnavailable: true,
          )
        : ProfilePresenter.connectionsLoaded(
            followers: _followers,
            following: _following,
            ownUserId: widget.profile.userId,
            followersCount: widget.profile.followersCount,
            followingCount: widget.profile.followingCount,
            defaultTab: widget.defaultTab,
            processingUserIds: _processing,
          );

    return ConnectionsModalBody(
      view: view,
      onOpenUser: (_) {},
      onToggleFollow: _toggleFollow,
    );
  }
}
