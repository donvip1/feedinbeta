/// Mapping helpers from the local persistence layer (`UserProfile`, `FeedPost`)
/// into the UI-facing view-models in `profile_view_models.dart`.
///
/// The parity widgets never read a repo or Supabase directly — the host screen
/// builds view-models with these helpers and passes them down. Everything here
/// is pure and depends only on the local models, so it analyzes cleanly and is
/// easy to unit-test.
///
/// Where a field/count is not yet available locally (followers/following user
/// lists, friends, view history) the mapper
/// produces an honest empty/unavailable view rather than inventing a backend
/// call — matching the project's offline-first first-pass parity goal.
library;

import '../../feed/feed_post.dart';
import '../user_profile.dart';
import 'profile_view_models.dart';

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

  /// Build a Connections modal state from counts only.
  ///
  /// The active native schema/contract exposes follower/following counts, but
  /// not the row-level follow graph. Mark non-zero count lists unavailable so
  /// the sheet does not claim there are no followers when only rows are absent.
  static ConnectionsModalView connections(
    UserProfile profile, {
    ConnectionsTab defaultTab = ConnectionsTab.followers,
  }) {
    return ConnectionsModalView(
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      defaultTab: defaultTab,
      listsUnavailable:
          profile.followersCount > 0 || profile.followingCount > 0,
    );
  }

  /// Native has no view-history contract/RPC wired yet, so render the real
  /// empty state instead of fabricating recently viewed posts.
  static const ViewHistoryView viewHistory = ViewHistoryView(canClear: false);

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
