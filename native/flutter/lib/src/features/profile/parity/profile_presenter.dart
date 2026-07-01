/// Mapping helpers from the local persistence layer (`UserProfile`, `FeedPost`)
/// into the UI-facing view-models in `profile_view_models.dart`.
///
/// The parity widgets never read a repo or Supabase directly — the host screen
/// builds view-models with these helpers and passes them down. Everything here
/// is pure and depends only on the local models, so it analyzes cleanly and is
/// easy to unit-test.
///
/// Where a field/count is not yet available locally (followers/following user
/// lists, friends) the mapper produces an honest empty/unavailable view rather
/// than inventing a backend call — matching the project's offline-first
/// first-pass parity goal. View history is resolved live from the
/// `get_view_history` RPC and mapped here from [ViewedPost] rows.
library;

import '../../../data/remote/post_views_remote_data_source.dart';
import '../../../data/remote/social_graph_remote_data_source.dart';
import '../../feed/feed_post.dart';
import '../user_profile.dart';
import 'past_spaces_remote_data_source.dart';
import 'profile_view_models.dart';

/// Web PURPOSE_OPTIONS map (Profile.tsx): purpose key -> human label.
const Map<String, String> profilePurposeLabels = {
  'friends': 'Make friends',
  'dating': 'Dating',
  'networking': 'Networking',
  'business': 'Business',
  'gaming': 'Gaming',
  'learning': 'Learning',
  'content': 'Find content',
  'streaming': 'Live streaming',
  'browsing': 'Just browsing',
};

/// Pure mappers grouped under one namespace so the host imports a single file.
class ProfilePresenter {
  const ProfilePresenter._();

  /// Resolve the verified tier from a profile. Explicit plan metadata wins;
  /// legacy `isPremium` still maps older rows to premium.
  static VerifiedTier verifiedTier(UserProfile profile) {
    final plan = profile.planTier?.toLowerCase() ?? '';
    if (plan.contains('premium')) return VerifiedTier.premium;
    if (plan.contains('pro') || plan.contains('popular')) {
      return VerifiedTier.pro;
    }
    return profile.isPremium ? VerifiedTier.premium : VerifiedTier.none;
  }

  /// Resolve the header badge bundle from role and plan metadata.
  static ProfileBadgeSet badges(UserProfile profile) {
    final role = _roleKind(profile.role);
    return ProfileBadgeSet(
      verifiedTier: verifiedTier(profile),
      role: role,
      plan: _planKind(profile.planTier, profile.isPremium),
      showRole: role != null,
    );
  }

  /// Build the counts row from the local profile. Friends/likes/posts are not
  /// tracked on the local profile yet; [postsCount] can be supplied by the host
  /// after loading the user's posts.
  static ProfileCountsView counts(UserProfile profile, {int postsCount = 0}) {
    return ProfileCountsView(
      followers: profile.followersCount,
      following: profile.followingCount,
      views: profile.totalViews,
      posts: postsCount,
    );
  }

  /// Map a single local [FeedPost] to a grid tile, classifying it as
  /// image/video/text from the available media metadata.
  static PostTileView tile(FeedPost post) {
    final mediaUrl =
        _trimmedOrNull(post.localMediaPath) ??
        _trimmedOrNull(post.mediaUrl) ??
        _firstNonEmpty(post.mediaUrls);
    final mediaType = post.mediaType ?? _firstNonEmpty(post.mediaTypes);
    final mediaCount = post.mediaUrls.isNotEmpty ? post.mediaUrls.length : 1;

    final PostTileMedia kind;
    if (mediaUrl == null || mediaUrl.isEmpty) {
      kind = PostTileMedia.text;
    } else if (mediaType == 'video') {
      kind = PostTileMedia.video;
    } else {
      kind = PostTileMedia.image;
    }

    return PostTileView(
      id: post.id,
      mediaUrl: mediaUrl,
      content: post.body,
      media: kind,
      viewsCount: post.viewsCount,
      mediaCount: mediaCount,
    );
  }

  /// Map a list of local posts (newest-first ordering preserved) to a grid.
  static PostsGridView postsGrid(
    List<FeedPost> posts, {
    required bool isOwnProfile,
    bool isLoading = false,
  }) {
    return PostsGridView(
      tiles: [for (final post in posts) tile(post)],
      isOwnProfile: isOwnProfile,
      isLoading: isLoading,
    );
  }

  /// Build the initial (pre-load) Connections modal state from counts only.
  ///
  /// Used as the loading/seed view before the social-graph rows arrive. The
  /// host swaps in [connectionsLoaded] once [SocialGraphRemoteDataSource]
  /// resolves the follower/following lists.
  static ConnectionsModalView connections(
    UserProfile profile, {
    ConnectionsTab defaultTab = ConnectionsTab.followers,
    bool isLoading = false,
  }) {
    return ConnectionsModalView(
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      defaultTab: defaultTab,
      isLoading: isLoading,
    );
  }

  /// Map a single social-graph [SocialConnection] into a modal row. [ownUserId]
  /// hides the toggle on the viewer's own row.
  static FollowRowView followRow(
    SocialConnection connection, {
    String? ownUserId,
    bool isProcessing = false,
  }) {
    return FollowRowView(
      user: ProfileUserRef(
        id: connection.userId,
        displayName: connection.displayName,
        username: connection.username,
        avatarUrl: connection.avatarUrl,
        bio: connection.bio,
      ),
      isFollowedByMe: connection.isFollowedByMe,
      isOwnRow: ownUserId != null && connection.userId == ownUserId,
      isProcessing: isProcessing,
    );
  }

  /// Build the fully-loaded Connections modal state from resolved follower and
  /// following lists. Counts default to the list lengths but can be overridden
  /// with the profile's stored counts via [followersCount]/[followingCount].
  static ConnectionsModalView connectionsLoaded({
    required List<SocialConnection> followers,
    required List<SocialConnection> following,
    String? ownUserId,
    int? followersCount,
    int? followingCount,
    ConnectionsTab defaultTab = ConnectionsTab.followers,
    Set<String> processingUserIds = const {},
  }) {
    return ConnectionsModalView(
      followers: [
        for (final c in followers)
          followRow(
            c,
            ownUserId: ownUserId,
            isProcessing: processingUserIds.contains(c.userId),
          ),
      ],
      following: [
        for (final c in following)
          followRow(
            c,
            ownUserId: ownUserId,
            isProcessing: processingUserIds.contains(c.userId),
          ),
      ],
      followersCount: followersCount ?? followers.length,
      followingCount: followingCount ?? following.length,
      defaultTab: defaultTab,
    );
  }

  /// View History card state while the `get_view_history` RPC is loading.
  static const ViewHistoryView viewHistoryLoading = ViewHistoryView(
    isLoading: true,
  );

  /// Map resolved recently-viewed [ViewedPost] rows into the View History card
  /// view-model. [canClear] gates the clear-all control (own history only); it
  /// is additionally suppressed when there is nothing to clear.
  static ViewHistoryView viewHistoryLoaded(
    List<ViewedPost> posts, {
    bool canClear = true,
  }) {
    return ViewHistoryView(
      items: [for (final post in posts) viewHistoryItem(post)],
      canClear: canClear && posts.isNotEmpty,
    );
  }

  /// Map a single [ViewedPost] into a View History row, classifying the author
  /// reference for the leading avatar + name/@username.
  static ViewHistoryItemView viewHistoryItem(ViewedPost post) {
    return ViewHistoryItemView(
      postId: post.postId,
      viewedAtMillis: post.viewedAtMillis,
      content: post.content,
      mediaUrl: post.mediaUrl,
      author: ProfileUserRef(
        id: post.authorId ?? post.postId,
        displayName: post.authorName,
        username: post.authorUsername,
        avatarUrl: post.authorAvatarUrl,
      ),
    );
  }

  /// Parse the profile's free-form `location` into city/country halves so the
  /// header can compose 'city, country'. Splits on the first comma; the whole
  /// string becomes the city when there is no comma.
  static ({String? city, String? country}) splitLocation(String? location) {
    final raw = location?.trim();
    if (raw == null || raw.isEmpty) return (city: null, country: null);
    final comma = raw.indexOf(',');
    if (comma < 0) return (city: raw, country: null);
    final city = raw.substring(0, comma).trim();
    final country = raw.substring(comma + 1).trim();
    return (
      city: city.isEmpty ? null : city,
      country: country.isEmpty ? null : country,
    );
  }

  /// Build the header view-model from a local profile. Social/role/plan and
  /// relationship flags that are not stored locally fall back to safe defaults.
  static ProfileHeaderView header(
    UserProfile profile, {
    int postsCount = 0,
    bool isOwnProfile = true,
  }) {
    final loc = splitLocation(profile.location);
    return ProfileHeaderView(
      userId: profile.userId,
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      city: loc.city,
      country: loc.country,
      websiteUrl: profile.websiteUrl,
      badges: badges(profile),
      isOwnProfile: isOwnProfile,
      counts: counts(profile, postsCount: postsCount),
    );
  }

  /// Resolve the social links list from the local profile in web render order.
  static List<SocialLinkVm> socialLinks(UserProfile profile) {
    return [
      if (_trimmedOrNull(profile.instagramUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.instagram, url: url),
      if (_trimmedOrNull(profile.twitterUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.twitter, url: url),
      if (_trimmedOrNull(profile.linkedinUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.linkedin, url: url),
      if (_trimmedOrNull(profile.facebookUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.facebook, url: url),
      if (_trimmedOrNull(profile.tiktokUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.tiktok, url: url),
      if (_trimmedOrNull(profile.youtubeUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.youtube, url: url),
      if (_trimmedOrNull(profile.websiteUrl) case final url?)
        SocialLinkVm(network: SocialNetwork.website, url: url),
    ];
  }

  /// Past Spaces section state while the `live_spaces` read is in flight.
  static const PastSpacesView pastSpacesLoading = PastSpacesView(
    isLoading: true,
  );

  /// Map resolved [PastSpace] rows into the Past Spaces section view-model,
  /// preserving the newest-first ordering from the data source.
  static PastSpacesView pastSpacesLoaded(List<PastSpace> spaces) {
    return PastSpacesView(
      spaces: [for (final space in spaces) pastSpace(space)],
    );
  }

  /// Map a single [PastSpace] into a row view, composing the web duration
  /// label ('Xm' / 'Xh Ym') from the started/ended timestamps.
  static PastSpaceView pastSpace(PastSpace space) {
    return PastSpaceView(
      id: space.id,
      title: space.title.trim().isEmpty ? 'Live space' : space.title,
      coverImageUrl: space.coverImageUrl,
      endedAtMillis: space.endedAtMillis,
      durationLabel: _durationLabel(space.startedAtMillis, space.endedAtMillis),
      viewerCount: space.viewerCount,
      hasRecording:
          space.recordingUrl != null && space.recordingUrl!.trim().isNotEmpty,
    );
  }

  /// Web `getDuration`: minutes -> 'Xm', or 'Yh Zm' past an hour. Null when
  /// either timestamp is missing or the span is negative.
  static String? _durationLabel(int? startMillis, int? endMillis) {
    if (startMillis == null || endMillis == null) return null;
    final ms = endMillis - startMillis;
    if (ms < 0) return null;
    final mins = ms ~/ 60000;
    if (mins < 60) return '${mins}m';
    return '${mins ~/ 60}h ${mins % 60}m';
  }

  /// Build the "Details" block (purpose chips + marital status) from the local
  /// profile. Purpose keys are mapped through [profilePurposeLabels].
  ///
  /// FLAG: `purpose` and `maritalStatus` are not on the native [UserProfile]
  /// yet, so these default to empty/null and the [purpose]/[maritalStatus]
  /// overrides let a host inject them once the shared model carries the fields.
  static ProfileDetailsView details(
    UserProfile profile, {
    List<String> purpose = const [],
    String? maritalStatus,
  }) {
    return ProfileDetailsView(
      purposeChips: [
        for (final key in purpose)
          profilePurposeLabels[key.trim().toLowerCase()] ?? key,
      ],
      maritalStatus: _titleCase(maritalStatus),
    );
  }

  /// Title-case a single-word/hyphenated status ('in_relationship' ->
  /// 'In Relationship') for display; null/empty passes through as null.
  static String? _titleCase(String? value) {
    final raw = value?.trim();
    if (raw == null || raw.isEmpty) return null;
    return raw
        .split(RegExp(r'[_\s-]+'))
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
        .join(' ');
  }

  static RoleBadgeKind? _roleKind(String? value) {
    switch (value?.trim().toLowerCase()) {
      case 'super_admin':
      case 'superadmin':
      case 'full_access':
        return RoleBadgeKind.superAdmin;
      case 'developer':
        return RoleBadgeKind.developer;
      case 'admin':
        return RoleBadgeKind.admin;
      case 'moderator':
        return RoleBadgeKind.moderator;
      default:
        return null;
    }
  }

  static PlanBadgeKind? _planKind(String? value, bool isPremium) {
    final plan = value?.trim().toLowerCase();
    if (plan != null && plan.isNotEmpty) {
      if (plan.contains('premium')) return PlanBadgeKind.premium;
      if (plan.contains('pro')) return PlanBadgeKind.pro;
      if (plan.contains('popular')) return PlanBadgeKind.popular;
    }
    return isPremium ? PlanBadgeKind.premium : null;
  }

  static String? _trimmedOrNull(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  static String? _firstNonEmpty(List<String> values) {
    for (final value in values) {
      if (value.trim().isNotEmpty) return value;
    }
    return null;
  }
}
