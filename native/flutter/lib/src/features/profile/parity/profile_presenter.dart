/// Mapping helpers from the local persistence layer (`UserProfile`, `FeedPost`)
/// into the UI-facing view-models in `profile_view_models.dart`.
///
/// The parity widgets never read a repo or Supabase directly — the host screen
/// builds view-models with these helpers and passes them down. Everything here
/// is pure and depends only on the local models, so it analyzes cleanly and is
/// easy to unit-test.
///
/// Where a field/count is not yet available locally (followers/following user
/// lists, friends, view history, social link URLs, admin role, plan tier) the
/// mapper produces a graceful empty/placeholder view rather than inventing a
/// backend call — matching the project's offline-first first-pass parity goal.
library;

import '../../feed/feed_post.dart';
import '../user_profile.dart';
import 'profile_view_models.dart';

/// Pure mappers grouped under one namespace so the host imports a single file.
class ProfilePresenter {
  const ProfilePresenter._();

  /// Resolve the verified tier from a profile. Only `isPremium` is available
  /// locally today, so premium maps to [VerifiedTier.premium] and everything
  /// else to [VerifiedTier.none]. Pro/popular tiers require a subscription
  /// tier name that the local model does not carry yet.
  static VerifiedTier verifiedTier(UserProfile profile) {
    return profile.isPremium ? VerifiedTier.premium : VerifiedTier.none;
  }

  /// Resolve the header badge bundle. Admin role is not stored locally, so it
  /// is always null/hidden; the plan chip is shown for premium profiles.
  static ProfileBadgeSet badges(UserProfile profile) {
    return ProfileBadgeSet(
      verifiedTier: verifiedTier(profile),
      plan: profile.isPremium ? PlanBadgeKind.premium : null,
      showRole: false,
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
    final mediaUrl = post.mediaUrl ?? _firstNonEmpty(post.mediaUrls);
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

  /// Resolve the social links list from the local profile. Only `websiteUrl`
  /// is stored locally today, so at most the Website pill is produced; the
  /// other six networks need profile columns that are not in the local model
  /// yet (see report). Returns an empty list when there is no website.
  static List<SocialLinkVm> socialLinks(UserProfile profile) {
    final website = profile.websiteUrl?.trim();
    return [
      if (website != null && website.isNotEmpty)
        SocialLinkVm(network: SocialNetwork.website, url: website),
    ];
  }

  static String? _firstNonEmpty(List<String> values) {
    for (final value in values) {
      if (value.trim().isNotEmpty) return value;
    }
    return null;
  }
}
