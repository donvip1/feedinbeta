import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/connectivity/connectivity_service.dart';
import '../../core/connectivity/offline_notice.dart';
import '../../core/sync/sync_service.dart';
import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/profile_repository_contract.dart';
import '../../data/remote/social_graph_remote_data_source.dart';
import '../feed/feed_post.dart';
import '../feed/feed_post_pager_screen.dart';
import 'parity/profile_presenter.dart';
import 'parity/profile_tokens.dart';
import 'parity/profile_view_models.dart';
import 'user_profile.dart';
import 'widgets/profile_header.dart';
import 'widgets/profile_post_grid.dart';
import 'widgets/profile_stats_row.dart';

class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({
    super.key,
    required this.userId,
    required this.profileRepository,
    required this.feedRepository,
    required this.connectivityService,
    required this.syncService,
    required this.currentUserId,
    required this.onOpenUserProfile,
    this.socialGraphDataSource,
  });

  final String userId;
  final ProfileRepositoryContract profileRepository;
  final LocalFeedRepositoryContract feedRepository;
  final ConnectivityService connectivityService;
  final SyncServiceContract syncService;
  final String currentUserId;
  final ValueChanged<String> onOpenUserProfile;
  final SocialGraphRemoteDataSource? socialGraphDataSource;

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  late final SocialGraphRemoteDataSource _socialGraph =
      widget.socialGraphDataSource ?? SocialGraphRemoteDataSource.autoDetect();
  UserProfile? _profile;
  List<FeedPost> _posts = const [];
  bool _loading = true;
  bool _following = false;
  bool _followLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<dynamic>([
        widget.profileRepository.loadProfileForUser(widget.userId),
        widget.feedRepository.loadPostsByUser(widget.userId),
        _socialGraph.isCurrentUserFollowing(widget.userId),
      ]);
      if (!mounted) return;
      final profile = results[0] as UserProfile?;
      if (profile == null) {
        setState(() {
          _loading = false;
          _error = 'This profile could not be found.';
        });
        return;
      }
      setState(() {
        _profile = profile;
        _posts = results[1] as List<FeedPost>;
        _following = results[2] as bool;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'This profile is unavailable right now.';
      });
    }
  }

  Future<void> _toggleFollow() async {
    if (_followLoading) return;
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
    setState(() => _followLoading = true);
    try {
      final following = await _socialGraph.toggleFollow(widget.userId);
      if (!mounted) return;
      setState(() {
        _following = following;
        if (_profile != null) {
          final delta = following ? 1 : -1;
          _profile = _profile!.copyWith(
            followersCount: (_profile!.followersCount + delta).clamp(
              0,
              1 << 31,
            ),
          );
        }
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update the follow state.')),
      );
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  Future<void> _openLink(String raw) async {
    final normalized = raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : 'https://$raw';
    final uri = Uri.tryParse(normalized);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open that link.')),
      );
    }
  }

  void _openTile(PostTileView tile) {
    final index = _posts.indexWhere((post) => post.id == tile.id);
    if (index < 0) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FeedPostPagerScreen(
          posts: _posts,
          initialIndex: index,
          feedRepository: widget.feedRepository,
          syncService: widget.syncService,
          connectivityService: widget.connectivityService,
          currentUserId: widget.currentUserId,
          onOpenUserProfile: widget.onOpenUserProfile,
          socialGraphDataSource: _socialGraph,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ProfileColors.background,
      appBar: AppBar(
        backgroundColor: ProfileColors.background,
        foregroundColor: ProfileColors.foreground,
        title: Text(_profile?.displayName ?? 'Profile'),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: ProfileColors.primary),
            )
          : _error != null
          ? _ProfileError(message: _error!, onRetry: _load)
          : _buildProfile(_profile!),
    );
  }

  Widget _buildProfile(UserProfile profile) {
    final tiles = [for (final post in _posts) ProfilePresenter.tile(post)];
    return RefreshIndicator(
      color: ProfileColors.primary,
      backgroundColor: ProfileColors.card,
      onRefresh: _load,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: ProfileHeader(
              profile: profile,
              onOpenLink: _openLink,
              primaryActionLabel: _following ? 'Following' : 'Follow',
              primaryActionIcon: _following
                  ? Icons.check_rounded
                  : Icons.person_add_alt_1_rounded,
              primaryActionLoading: _followLoading,
              onPrimaryAction: _socialGraph.currentUserId == widget.userId
                  ? null
                  : _toggleFollow,
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
              child: ProfileStatsRow(
                counts: ProfileCountsView(
                  posts: _posts.length,
                  followers: profile.followersCount,
                  following: profile.followingCount,
                  views: profile.totalViews,
                ),
                onTap: (_) {},
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Text(
                'Posts',
                style: TextStyle(
                  color: ProfileColors.foreground,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            hasScrollBody: true,
            child: ProfilePostGrid(
              view: PostsGridView(tiles: tiles),
              onOpenTile: _openTile,
              emptyTitle: 'No posts yet',
              emptySubtitle: 'This creator has not shared any posts yet.',
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.person_off_outlined,
              size: 56,
              color: ProfileColors.mutedForeground,
            ),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: ProfileTextStyles.emptyTitle,
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
