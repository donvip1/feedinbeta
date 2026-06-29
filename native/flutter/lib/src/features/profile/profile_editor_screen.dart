import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/profile_repository_contract.dart';
import '../feed/feed_post.dart';
import 'parity/profile_presenter.dart';
import 'parity/profile_view_models.dart';
import 'parity/widgets/connections_modal.dart';
import 'parity/widgets/posts_grid.dart';
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
  });

  final UserProfile profile;
  final ProfileRepositoryContract profileRepository;
  final LocalFeedRepositoryContract feedRepository;
  final ValueChanged<UserProfile> onSaved;

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
  }

  @override
  void didUpdateWidget(covariant ProfileEditorScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile.userId != widget.profile.userId) {
      _postsFuture = widget.feedRepository.loadPostsByUser(
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
        _ProfileHero(profile: _profile),
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
                onOpen: _copyLink,
              ),
              const SizedBox(height: 16),
              ViewHistoryCard(
                view: ProfilePresenter.viewHistory,
                onOpenPost: (_) {},
              ),
              const SizedBox(height: 24),
              _ProfilePostsGrid(postsFuture: _postsFuture, isOwnProfile: true),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _copyLink(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Link copied to clipboard')));
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
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Posts',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
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
  const _ProfileHero({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    final coverUrl = profile.coverUrl;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 210,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: coverUrl == null || coverUrl.isEmpty
                    ? const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0xFFFF3D9A),
                              Color(0xFF2563EB),
                              Color(0xFF101521),
                            ],
                          ),
                        ),
                      )
                    : Image.network(coverUrl, fit: BoxFit.cover),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Theme.of(context).scaffoldBackgroundColor,
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 16,
                bottom: -42,
                child: _ProfileAvatar(profile: profile),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 50, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      profile.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  if (ProfilePresenter.verifiedTier(profile) !=
                      VerifiedTier.none) ...[
                    const SizedBox(width: 6),
                    VerifiedBadge(
                      tier: ProfilePresenter.verifiedTier(profile),
                      size: BadgeSize.md,
                    ),
                  ],
                ],
              ),
              if (ProfilePresenter.badges(profile).hasRowBadges) ...[
                const SizedBox(height: 8),
                RolePlanBadges(badges: ProfilePresenter.badges(profile)),
              ],
              const SizedBox(height: 2),
              Text(
                '@${profile.handle}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (profile.bio.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(profile.bio),
              ],
              const SizedBox(height: 10),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  if (profile.location?.isNotEmpty ?? false)
                    _MetaPill(
                      icon: Icons.place_outlined,
                      label: profile.location!,
                    ),
                  if (profile.websiteUrl?.isNotEmpty ?? false)
                    _MetaPill(icon: Icons.link, label: profile.websiteUrl!),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _ProfileStat(
                    value: profile.followersCount,
                    label: 'Followers',
                    onTap: () =>
                        _openConnections(context, ConnectionsTab.followers),
                  ),
                  _ProfileStat(
                    value: profile.followingCount,
                    label: 'Following',
                    onTap: () =>
                        _openConnections(context, ConnectionsTab.following),
                  ),
                  _ProfileStat(value: profile.totalViews, label: 'Views'),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Opens the Followers/Following connections sheet. Local user lists are not
  /// available yet, so the modal shows just the counts with graceful empty
  /// lists until a social-graph repository is wired upstream.
  void _openConnections(BuildContext context, ConnectionsTab tab) {
    showConnectionsModal(
      context,
      view: ProfilePresenter.connections(profile, defaultTab: tab),
      onOpenUser: (_) {},
      onToggleFollow: (_) {},
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

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = profile.avatarUrl;
    return Container(
      width: 92,
      height: 92,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Theme.of(context).scaffoldBackgroundColor,
          width: 5,
        ),
      ),
      child: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundImage: avatarUrl == null || avatarUrl.isEmpty
            ? null
            : NetworkImage(avatarUrl),
        child: Text(
          profile.displayName.characters.first.toUpperCase(),
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 28),
        ),
      ),
    );
  }
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.value, required this.label, this.onTap});

  final int value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _compact(value),
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
    return Expanded(
      child: onTap == null
          ? content
          : InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: content,
              ),
            ),
    );
  }

  String _compact(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return value.toString();
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
