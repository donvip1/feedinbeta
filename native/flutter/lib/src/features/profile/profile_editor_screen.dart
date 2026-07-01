import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/profile_repository_contract.dart';
import '../../data/remote/post_views_remote_data_source.dart';
import '../../data/remote/social_graph_remote_data_source.dart';
import '../feed/feed_post.dart';
import 'parity/past_spaces_remote_data_source.dart';
import 'parity/profile_presenter.dart';
import 'parity/profile_tokens.dart';
import 'parity/profile_view_models.dart';
import 'parity/widgets/connections_modal.dart';
import 'parity/widgets/past_spaces_card.dart';
import 'parity/widgets/posts_grid.dart';
import 'parity/widgets/profile_avatar.dart';
import 'parity/widgets/profile_details_cards.dart';
import 'parity/widgets/role_plan_badges.dart';
import 'parity/widgets/social_links_card.dart';
import 'parity/widgets/verified_badge.dart';
import 'parity/widgets/view_history_card.dart';
import 'user_profile.dart';

class ProfileEditorScreen extends StatefulWidget {
  const ProfileEditorScreen({
    super.key,
    required this.profile,
    required this.profileRepository,
    required this.feedRepository,
    required this.onSaved,
    this.socialGraphDataSource,
    this.postViewsDataSource,
    this.profileSectionsDataSource,
  });

  final UserProfile profile;
  final ProfileRepositoryContract profileRepository;
  final LocalFeedRepositoryContract feedRepository;
  final ValueChanged<UserProfile> onSaved;

  /// Live follow-graph access for the connections modal. Optional so existing
  /// hosts that do not inject it still build; falls back to an auto-detecting
  /// instance that reads the Supabase singleton.
  final SocialGraphRemoteDataSource? socialGraphDataSource;

  /// Live access to the post view-history contract for the View History card.
  /// Optional; falls back to an auto-detecting instance like the follow graph.
  final PostViewsRemoteDataSource? postViewsDataSource;

  /// Live access to the extra profile sections (Past Spaces + the total-likes
  /// aggregate for the Likes stat). Optional; falls back to an auto-detecting
  /// instance like the other two data sources.
  final ProfileSectionsRemoteDataSource? profileSectionsDataSource;

  @override
  State<ProfileEditorScreen> createState() => _ProfileEditorScreenState();
}

class _ProfileEditorScreenState extends State<ProfileEditorScreen> {
  late final TextEditingController _displayNameController;
  late final TextEditingController _handleController;
  late final TextEditingController _bioController;
  late final TextEditingController _locationController;
  late final TextEditingController _websiteController;
  late final TextEditingController _instagramController;
  late final TextEditingController _twitterController;
  late final TextEditingController _linkedinController;
  late final TextEditingController _facebookController;
  late final TextEditingController _tiktokController;
  late final TextEditingController _youtubeController;
  late Future<List<FeedPost>> _postsFuture;
  late final SocialGraphRemoteDataSource _socialGraph;
  late final PostViewsRemoteDataSource _postViews;
  late final ProfileSectionsRemoteDataSource _profileSections;
  late Future<int> _totalLikesFuture;
  bool _isSaving = false;
  String? _message;
  String? _errorMessage;

  UserProfile get _profile => widget.profile;

  @override
  void initState() {
    super.initState();
    _displayNameController = TextEditingController(
      text: widget.profile.displayName,
    );
    _handleController = TextEditingController(text: widget.profile.handle);
    _bioController = TextEditingController(text: widget.profile.bio);
    _locationController = TextEditingController(
      text: widget.profile.location ?? '',
    );
    _websiteController = TextEditingController(
      text: widget.profile.websiteUrl ?? '',
    );
    _instagramController = TextEditingController(
      text: widget.profile.instagramUrl ?? '',
    );
    _twitterController = TextEditingController(
      text: widget.profile.twitterUrl ?? '',
    );
    _linkedinController = TextEditingController(
      text: widget.profile.linkedinUrl ?? '',
    );
    _facebookController = TextEditingController(
      text: widget.profile.facebookUrl ?? '',
    );
    _tiktokController = TextEditingController(
      text: widget.profile.tiktokUrl ?? '',
    );
    _youtubeController = TextEditingController(
      text: widget.profile.youtubeUrl ?? '',
    );
    _postsFuture = widget.feedRepository.loadPostsByUser(widget.profile.userId);
    _socialGraph =
        widget.socialGraphDataSource ??
        SocialGraphRemoteDataSource.autoDetect();
    _postViews =
        widget.postViewsDataSource ?? PostViewsRemoteDataSource.autoDetect();
    _profileSections =
        widget.profileSectionsDataSource ??
        ProfileSectionsRemoteDataSource.autoDetect();
    _totalLikesFuture = _profileSections.fetchTotalLikes(
      widget.profile.userId,
    );
  }

  @override
  void didUpdateWidget(covariant ProfileEditorScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile.userId != widget.profile.userId) {
      _postsFuture = widget.feedRepository.loadPostsByUser(
        widget.profile.userId,
      );
      _totalLikesFuture = _profileSections.fetchTotalLikes(
        widget.profile.userId,
      );
      _displayNameController.text = widget.profile.displayName;
      _handleController.text = widget.profile.handle;
      _bioController.text = widget.profile.bio;
      _locationController.text = widget.profile.location ?? '';
      _websiteController.text = widget.profile.websiteUrl ?? '';
      _instagramController.text = widget.profile.instagramUrl ?? '';
      _twitterController.text = widget.profile.twitterUrl ?? '';
      _linkedinController.text = widget.profile.linkedinUrl ?? '';
      _facebookController.text = widget.profile.facebookUrl ?? '';
      _tiktokController.text = widget.profile.tiktokUrl ?? '';
      _youtubeController.text = widget.profile.youtubeUrl ?? '';
    }
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _handleController.dispose();
    _bioController.dispose();
    _locationController.dispose();
    _websiteController.dispose();
    _instagramController.dispose();
    _twitterController.dispose();
    _linkedinController.dispose();
    _facebookController.dispose();
    _tiktokController.dispose();
    _youtubeController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final displayName = _displayNameController.text.trim();
    final handle = _safeHandle(_handleController.text);
    if (displayName.length < 2 || handle.length < 3) {
      setState(
        () => _errorMessage =
            'Add a display name and a handle with at least 3 characters.',
      );
      return;
    }

    setState(() {
      _isSaving = true;
      _message = null;
      _errorMessage = null;
    });

    final profile = widget.profile.copyWith(
      displayName: displayName,
      handle: handle,
      bio: _bioController.text.trim(),
      location: _emptyToNull(_locationController.text),
      websiteUrl: _emptyToNull(_websiteController.text),
      instagramUrl: _emptyToNull(_instagramController.text),
      twitterUrl: _emptyToNull(_twitterController.text),
      linkedinUrl: _emptyToNull(_linkedinController.text),
      facebookUrl: _emptyToNull(_facebookController.text),
      tiktokUrl: _emptyToNull(_tiktokController.text),
      youtubeUrl: _emptyToNull(_youtubeController.text),
    );

    try {
      await widget.profileRepository.syncProfile(profile);
      widget.onSaved(profile);
      if (!mounted) return;
      setState(() => _message = 'Profile saved and synced.');
    } catch (error) {
      await widget.profileRepository.saveCurrentProfile(profile);
      widget.onSaved(profile);
      if (!mounted) return;
      setState(() {
        _message = null;
        _errorMessage =
            'Profile saved locally, but Supabase sync failed: '
            '${_formatError(error)}';
      });
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  static String _formatError(Object error) {
    return error
        .toString()
        .replaceFirst('PostgrestException(message: ', '')
        .replaceFirst(RegExp(r', code: .*'), '')
        .replaceFirst(RegExp(r', details: .*'), '');
  }

  static String _safeHandle(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(RegExp('[^a-z0-9_]+'), '_')
        .replaceAll(RegExp('_+'), '_')
        .replaceAll(RegExp('^_|_\$'), '');
  }

  static String? _emptyToNull(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _ProfileHero(
          profile: _profile,
          socialGraph: _socialGraph,
          totalLikesFuture: _totalLikesFuture,
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Edit profile',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _displayNameController,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _handleController,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Handle',
                  prefixText: '@',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _bioController,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Bio',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _locationController,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Location',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _websiteController,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(
                  labelText: 'Website',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              _SocialLinksEditor(
                instagramController: _instagramController,
                twitterController: _twitterController,
                linkedinController: _linkedinController,
                facebookController: _facebookController,
                tiktokController: _tiktokController,
                youtubeController: _youtubeController,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _isSaving ? null : _save,
                icon: const Icon(Icons.save_outlined),
                label: Text(_isSaving ? 'Saving...' : 'Save profile'),
              ),
              if (_message != null) ...[
                const SizedBox(height: 12),
                Text(
                  _message!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ],
              const SizedBox(height: 24),
              SocialLinksCard(
                links: ProfilePresenter.socialLinks(_profile),
                onOpen: _openLink,
              ),
              const SizedBox(height: 24),
              _ProfilePostsGrid(postsFuture: _postsFuture, isOwnProfile: true),
              _PastSpacesSection(
                profileSections: _profileSections,
                userId: _profile.userId,
                onOpenSpace: _openSpace,
              ),
              const SizedBox(height: 16),
              _ViewHistorySection(postViews: _postViews),
              _ProfileDetailsSection(profile: _profile),
            ],
          ),
        ),
      ],
    );
  }

  /// Opens a recorded space. No in-app live-space route is exposed to the
  /// profile tab yet, so this copies the space id to the clipboard and shows a
  /// note — mirroring the profile's other "wired upstream later" affordances
  /// (post-detail navigation) rather than silently doing nothing.
  Future<void> _openSpace(String spaceId) async {
    await Clipboard.setData(ClipboardData(text: spaceId));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Space replay opens once live spaces are wired.')),
    );
  }

  /// Opens a social link in the platform browser. Normalises bare hosts to
  /// https and falls back to copying the URL to the clipboard if the platform
  /// cannot launch it (no handler / launch failure).
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
}

/// Stateful host for the View History card: loads the viewer's recently-viewed
/// posts from `get_view_history`, renders the presentational [ViewHistoryCard],
/// and supports clearing the history. Like the connections sheet, all backend
/// access lives here and the card stays purely presentational.
class _ViewHistorySection extends StatefulWidget {
  const _ViewHistorySection({required this.postViews});

  final PostViewsRemoteDataSource postViews;

  @override
  State<_ViewHistorySection> createState() => _ViewHistorySectionState();
}

class _ViewHistorySectionState extends State<_ViewHistorySection> {
  // null while loading; an (empty) list once resolved.
  List<ViewedPost>? _history;
  bool _failed = false;
  bool _clearing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await widget.postViews.fetchViewHistory();
      if (!mounted) return;
      setState(() {
        _history = rows;
        _failed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _history = const [];
        _failed = true;
      });
    }
  }

  Future<void> _clear() async {
    if (_clearing) return;
    setState(() => _clearing = true);
    try {
      await widget.postViews.clearHistory();
      if (!mounted) return;
      setState(() => _history = const []);
    } catch (_) {
      // Leave the existing rows in place on failure.
    } finally {
      if (mounted) setState(() => _clearing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = _history;
    final view = history == null
        ? ProfilePresenter.viewHistoryLoading
        : ProfilePresenter.viewHistoryLoaded(history, canClear: !_failed);
    return ViewHistoryCard(
      view: view,
      onOpenPost: (_) {},
      onClear: _clearing ? null : _clear,
    );
  }
}

/// Stateful host for the Past Spaces section: loads the user's ended live
/// spaces from `live_spaces` via [ProfileSectionsRemoteDataSource] and renders
/// the presentational [PastSpacesCard]. Like the other sections, all backend
/// access lives here and the card stays purely presentational. The whole
/// section (including its top spacing) hides while loading or when empty, so
/// there is no dead gap on profiles without spaces.
class _PastSpacesSection extends StatefulWidget {
  const _PastSpacesSection({
    required this.profileSections,
    required this.userId,
    required this.onOpenSpace,
  });

  final ProfileSectionsRemoteDataSource profileSections;
  final String userId;
  final ValueChanged<String> onOpenSpace;

  @override
  State<_PastSpacesSection> createState() => _PastSpacesSectionState();
}

class _PastSpacesSectionState extends State<_PastSpacesSection> {
  // null while loading; a (possibly empty) list once resolved.
  List<PastSpace>? _spaces;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _PastSpacesSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId) {
      _spaces = null;
      _load();
    }
  }

  Future<void> _load() async {
    final rows = await widget.profileSections.fetchPastSpaces(widget.userId);
    if (!mounted) return;
    setState(() => _spaces = rows);
  }

  @override
  Widget build(BuildContext context) {
    final spaces = _spaces;
    final view = spaces == null
        ? ProfilePresenter.pastSpacesLoading
        : ProfilePresenter.pastSpacesLoaded(spaces);
    // Nothing to show (loading or empty) -> render zero-size, no top spacer.
    if (view.isLoading || !view.hasContent) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: PastSpacesCard(view: view, onOpenSpace: widget.onOpenSpace),
    );
  }
}

/// Renders the "Details" cards (Purpose + Marital Status) from the local
/// profile. Both fields are absent from the native [UserProfile] today (see the
/// FLAG on [ProfileDetailsView]), so this resolves to an empty view and renders
/// nothing — the wiring is in place for when the shared model carries them.
class _ProfileDetailsSection extends StatelessWidget {
  const _ProfileDetailsSection({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    final view = ProfilePresenter.details(profile);
    if (view.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: ProfileDetailsCards(view: view),
    );
  }
}

class _ProfilePostsGrid extends StatelessWidget {
  const _ProfilePostsGrid({
    required this.postsFuture,
    required this.isOwnProfile,
  });

  final Future<List<FeedPost>> postsFuture;
  final bool isOwnProfile;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<FeedPost>>(
      future: postsFuture,
      builder: (context, snapshot) {
        final posts = snapshot.data;
        final view = posts == null
            ? const PostsGridView(isLoading: true)
            : ProfilePresenter.postsGrid(posts, isOwnProfile: isOwnProfile);
        final count = view.tiles.length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.grid_view_rounded,
                  size: 18,
                  color: ProfileColors.primary,
                ),
                const SizedBox(width: ProfileSpacing.sm),
                Text(
                  count > 0 ? 'Posts ($count)' : 'Posts',
                  style: ProfileTextStyles.sectionTitle,
                ),
              ],
            ),
            const SizedBox(height: ProfileSpacing.md),
            PostsGrid(
              view: view,
              onAction: (tile, action) {
                if (action == PostTileAction.delete) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Post deletion is coming soon.'),
                    ),
                  );
                }
                // View Post navigation is wired upstream once a post-detail
                // route is exposed to the profile tab.
              },
            ),
          ],
        );
      },
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.profile,
    required this.socialGraph,
    required this.totalLikesFuture,
  });

  final UserProfile profile;
  final SocialGraphRemoteDataSource socialGraph;

  /// Resolves the header "Likes" stat (sum of the user's active-post likes).
  final Future<int> totalLikesFuture;

  @override
  Widget build(BuildContext context) {
    final coverUrl = profile.coverUrl;
    final hasCover = coverUrl != null && coverUrl.isNotEmpty;
    final badges = ProfilePresenter.badges(profile);
    final verifiedTier = ProfilePresenter.verifiedTier(profile);
    final location = profile.location?.trim() ?? '';
    final website = profile.websiteUrl?.trim() ?? '';

    // Outer diameter of the avatar including its background-colored ring.
    const avatarRing =
        ProfileSpacing.avatarDiameter + ProfileSpacing.avatarBorderWidth * 2;
    // Vertical offset of the avatar's top edge (web -mt-20 pull-up over cover).
    const avatarTop = ProfileSpacing.coverHeight - ProfileSpacing.avatarOverlap;
    // Band tall enough to fully contain the overlapping avatar (no clipping
    // onto the identity block below).
    const bandHeight = avatarTop + avatarRing;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // --- Cover band (web h-64) with a bottom fade into the background and
        //     the avatar overlapping its lower edge (web -mt-20, centered). ---
        SizedBox(
          height: bandHeight,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              SizedBox(
                height: ProfileSpacing.coverHeight,
                width: double.infinity,
                child: hasCover
                    ? Image.network(
                        coverUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: ProfileGradients.coverPlaceholder,
                          ),
                        ),
                      )
                    : const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: ProfileGradients.coverPlaceholder,
                        ),
                      ),
              ),
              // Fade the bottom of the cover into the page background so the
              // overlapping avatar reads cleanly (web from-transparent to-bg).
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                height: ProfileSpacing.coverHeight,
                child: const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, ProfileColors.background],
                      stops: [0.55, 1.0],
                    ),
                  ),
                ),
              ),
              Positioned(
                top: avatarTop,
                child: _ProfileAvatar(profile: profile),
              ),
            ],
          ),
        ),
        // --- Centered identity block (web text-center). ---
        Padding(
          padding: const EdgeInsets.fromLTRB(
            ProfileSpacing.lg,
            ProfileSpacing.md,
            ProfileSpacing.lg,
            0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      profile.displayName.trim().isEmpty
                          ? 'Unknown'
                          : profile.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: ProfileTextStyles.displayName,
                    ),
                  ),
                  if (verifiedTier != VerifiedTier.none) ...[
                    const SizedBox(width: ProfileSpacing.xs),
                    VerifiedBadge(tier: verifiedTier, size: BadgeSize.md),
                  ],
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '@${profile.handle.trim().isEmpty ? 'user' : profile.handle}',
                textAlign: TextAlign.center,
                style: ProfileTextStyles.handle,
              ),
              if (badges.hasRowBadges) ...[
                const SizedBox(height: ProfileSpacing.sm),
                // web: <div className="flex justify-center"> around the badges.
                Align(
                  alignment: Alignment.center,
                  child: RolePlanBadges(badges: badges),
                ),
              ],
              const SizedBox(height: ProfileSpacing.lg),
              _ProfileCountsRow(
                profile: profile,
                totalLikesFuture: totalLikesFuture,
                onOpenConnections: (tab) => _openConnections(context, tab),
              ),
              if (profile.bio.trim().isNotEmpty) ...[
                const SizedBox(height: ProfileSpacing.lg),
                Text(
                  profile.bio,
                  textAlign: TextAlign.center,
                  style: ProfileTextStyles.bio,
                ),
              ],
              if (location.isNotEmpty || website.isNotEmpty) ...[
                const SizedBox(height: ProfileSpacing.md),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: ProfileSpacing.md,
                  runSpacing: ProfileSpacing.sm,
                  children: [
                    if (location.isNotEmpty)
                      _MetaPill(icon: Icons.place_outlined, label: location),
                    if (website.isNotEmpty)
                      _MetaPill(icon: Icons.language, label: website),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// Opens the Followers/Following connections sheet backed by the live follow
  /// graph. The sheet loads follower/following rows from [socialGraph] and
  /// supports follow/unfollow toggles inline.
  void _openConnections(BuildContext context, ConnectionsTab tab) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ProfileColors.card,
      barrierColor: ProfileColors.barrier,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: ProfileRadii.sheetTop),
      builder: (_) => _ConnectionsSheet(
        profile: profile,
        socialGraph: socialGraph,
        defaultTab: tab,
      ),
    );
  }
}

/// Stateful host for the connections modal: loads follower/following rows from
/// the live follow graph and drives inline follow/unfollow toggles. Renders the
/// presentational [ConnectionsModalBody] with a freshly-built view-model.
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
    // Initial state is already loading; no pre-await setState (would fire
    // during initState). Await the two list reads, then publish results.
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

class _SocialLinksEditor extends StatelessWidget {
  const _SocialLinksEditor({
    required this.instagramController,
    required this.twitterController,
    required this.linkedinController,
    required this.facebookController,
    required this.tiktokController,
    required this.youtubeController,
  });

  final TextEditingController instagramController;
  final TextEditingController twitterController;
  final TextEditingController linkedinController;
  final TextEditingController facebookController;
  final TextEditingController tiktokController;
  final TextEditingController youtubeController;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      childrenPadding: EdgeInsets.zero,
      title: const Text('Social links'),
      subtitle: const Text('Add public profile links for web parity.'),
      children: [
        _SocialLinkField(label: 'Instagram', controller: instagramController),
        _SocialLinkField(label: 'Twitter / X', controller: twitterController),
        _SocialLinkField(label: 'LinkedIn', controller: linkedinController),
        _SocialLinkField(label: 'Facebook', controller: facebookController),
        _SocialLinkField(label: 'TikTok', controller: tiktokController),
        _SocialLinkField(label: 'YouTube', controller: youtubeController),
      ],
    );
  }
}

class _SocialLinkField extends StatelessWidget {
  const _SocialLinkField({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: TextInputType.url,
        textInputAction: TextInputAction.next,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}

/// 128px header avatar with the web 4px background-colored ring + drop shadow,
/// wrapping the shared [ProfileAvatar] gradient-initials fallback.
class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    final initial = profile.displayName.trim().isEmpty
        ? 'U'
        : profile.displayName.trim().characters.first.toUpperCase();
    return Container(
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: ProfileColors.background, // web border-background ring color
        boxShadow: ProfileShadows.avatar,
      ),
      padding: const EdgeInsets.all(ProfileSpacing.avatarBorderWidth),
      child: ProfileAvatar(
        diameter: ProfileSpacing.avatarDiameter,
        initial: initial,
        imageUrl: profile.avatarUrl,
      ),
    );
  }
}

/// Centered Followers / Following / Friends / Likes / Views stats (web
/// `flex-wrap gap-6` five-stat row). Followers and Following open the live
/// connections sheet; Likes resolves live from the total-likes aggregate; Views
/// is static from the profile.
///
/// FLAG: the "Friends" stat needs the `friend_requests` table + the
/// `are_mutual_friends` RPC (both used by the web), neither of which exists in
/// the native schema. It is rendered as a non-interactive '—/Friends' cell so
/// the row matches the web layout honestly instead of inventing a count/modal.
class _ProfileCountsRow extends StatelessWidget {
  const _ProfileCountsRow({
    required this.profile,
    required this.totalLikesFuture,
    required this.onOpenConnections,
  });

  final UserProfile profile;
  final Future<int> totalLikesFuture;
  final ValueChanged<ConnectionsTab> onOpenConnections;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: ProfileSpacing.xl,
      runSpacing: ProfileSpacing.md,
      children: [
        _ProfileStat(
          value: profile.followersCount,
          label: 'Followers',
          onTap: () => onOpenConnections(ConnectionsTab.followers),
        ),
        _ProfileStat(
          value: profile.followingCount,
          label: 'Following',
          onTap: () => onOpenConnections(ConnectionsTab.following),
        ),
        // Friends: unavailable natively (no friend_requests table). Muted
        // placeholder matching the web "Not Friends"/'—' non-mutual state.
        const _ProfileStat.placeholder(label: 'Friends'),
        FutureBuilder<int>(
          future: totalLikesFuture,
          builder: (context, snapshot) =>
              _ProfileStat(value: snapshot.data ?? 0, label: 'Likes'),
        ),
        _ProfileStat(value: profile.totalViews, label: 'Views'),
      ],
    );
  }
}

/// One centered stat (bold value over a muted label). Tappable stats get a soft
/// rounded ripple matching the web hover:opacity affordance. The [placeholder]
/// variant renders a muted em-dash value for stats native cannot resolve yet.
class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.value, required this.label, this.onTap})
    : isPlaceholder = false;

  const _ProfileStat.placeholder({required this.label})
    : value = 0,
      onTap = null,
      isPlaceholder = true;

  final int value;
  final String label;
  final VoidCallback? onTap;
  final bool isPlaceholder;

  @override
  Widget build(BuildContext context) {
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          isPlaceholder ? '—' : compactCount(value),
          style: isPlaceholder
              ? ProfileTextStyles.statValue.copyWith(
                  color: ProfileColors.mutedForeground,
                )
              : ProfileTextStyles.statValue,
        ),
        const SizedBox(height: 2),
        Text(label, style: ProfileTextStyles.statLabel),
      ],
    );
    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      borderRadius: ProfileRadii.tile,
      child: InkWell(
        onTap: onTap,
        borderRadius: ProfileRadii.tile,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ProfileSpacing.sm,
            vertical: ProfileSpacing.xs,
          ),
          child: content,
        ),
      ),
    );
  }
}

/// Muted icon + label meta chip (location / website) used under the header.
class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: ProfileColors.mutedForeground),
        const SizedBox(width: ProfileSpacing.xs + 2),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: ProfileTextStyles.meta,
          ),
        ),
      ],
    );
  }
}
