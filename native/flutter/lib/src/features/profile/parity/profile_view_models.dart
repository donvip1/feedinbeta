import 'package:flutter/widgets.dart';

/// UI-facing, immutable view-models consumed by the Profile parity widgets
/// under `parity/widgets/`.
///
/// These are deliberately decoupled from the persistence layer
/// (`user_profile.dart`, the feed/messages repos, Supabase). They depend only
/// on the Flutter foundation library so this file analyzes cleanly on its own.
///
/// The host screen is responsible for mapping `UserProfile` (+ counts, role,
/// plan, relationship, follower/friend/post/history queries) into these views
/// and passing them to the presentational widgets. Widgets NEVER read Supabase
/// or a repo directly — they take a view + callbacks.
///
/// Includes two small pure helpers the widgets reuse:
///  * [compactCount] — 1.2K / 3.4M number formatting.
///  * [countryFlagEmoji] — emoji flag from an ISO-3166 alpha-2 code.
///  * [relativeTimeShort] — '2h ago' / 'just now' (replaces date-fns).

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Verified-badge tier driving which PNG (or fallback icon) renders inline
/// after the display name. Resolved upstream from the active subscription tier
/// name (web: name.includes('premium') -> premium; 'pro'/'popular' -> pro).
enum VerifiedTier { none, pro, premium }

/// Verified-badge render size (web sm/md/lg == 19/23/27px).
enum BadgeSize { sm, md, lg }

/// Admin role kinds (web ROLE_CONFIG keys). Visibility is decided upstream.
enum RoleBadgeKind { superAdmin, developer, admin, moderator }

/// Subscription plan kinds (web PLAN_CONFIG keys).
enum PlanBadgeKind { premium, pro, popular }

/// The seven social networks rendered as brand-styled pills, in render order.
enum SocialNetwork {
  instagram,
  twitter,
  linkedin,
  facebook,
  tiktok,
  youtube,
  website,
}

/// Followers/Following modal active tab.
enum ConnectionsTab { followers, following }

/// Media kind of a post-grid tile.
enum PostTileMedia { image, video, text }

/// Actions surfaced by the post-tile actions menu (Promote excluded by rules).
enum PostTileAction { view, delete }

// ---------------------------------------------------------------------------
// Small value objects
// ---------------------------------------------------------------------------

/// A lightweight user reference used by avatars, modal rows and history rows.
@immutable
class ProfileUserRef {
  const ProfileUserRef({
    required this.id,
    this.displayName,
    this.username,
    this.avatarUrl,
    this.bio,
  });

  final String id;
  final String? displayName;
  final String? username;
  final String? avatarUrl;
  final String? bio;

  /// Resolved name with web fallback.
  String get nameOrFallback =>
      (displayName != null && displayName!.trim().isNotEmpty)
      ? displayName!
      : 'Unknown';

  /// Resolved @handle text with web fallback (no leading '@').
  String get usernameOrFallback =>
      (username != null && username!.trim().isNotEmpty) ? username! : 'user';

  /// First grapheme used for the gradient-initials avatar fallback.
  String get initial {
    final source = (displayName != null && displayName!.trim().isNotEmpty)
        ? displayName!.trim()
        : '';
    if (source.isEmpty) return 'U';
    return source.characters.first.toUpperCase();
  }
}

/// A verified/role/plan badge bundle resolved upstream for one profile. Every
/// field is independently nullable so the widget renders only what is present.
@immutable
class ProfileBadgeSet {
  const ProfileBadgeSet({
    this.verifiedTier = VerifiedTier.none,
    this.role,
    this.plan,
    this.showRole = false,
  });

  /// Drives the inline VerifiedBadge after the name.
  final VerifiedTier verifiedTier;

  /// Admin role chip; null when the user has no admin role.
  final RoleBadgeKind? role;

  /// Subscription plan chip; null when the user has no active plan.
  final PlanBadgeKind? plan;

  /// Upstream-computed visibility for the admin role chip (own profile or
  /// viewer-is-admin). The widget honors it; when false, role is not shown.
  final bool showRole;

  /// Effective role to render after applying the visibility gate.
  RoleBadgeKind? get visibleRole => showRole ? role : null;

  bool get hasRowBadges => visibleRole != null || plan != null;
}

/// One social link to render as a brand pill.
@immutable
class SocialLinkVm {
  const SocialLinkVm({required this.network, required this.url});

  final SocialNetwork network;
  final String url;

  /// Human label rendered on the pill.
  String get label {
    switch (network) {
      case SocialNetwork.instagram:
        return 'Instagram';
      case SocialNetwork.twitter:
        return 'Twitter';
      case SocialNetwork.linkedin:
        return 'LinkedIn';
      case SocialNetwork.facebook:
        return 'Facebook';
      case SocialNetwork.tiktok:
        return 'TikTok';
      case SocialNetwork.youtube:
        return 'YouTube';
      case SocialNetwork.website:
        return 'Website';
    }
  }
}

/// One human-readable purpose chip (e.g. key 'friends' -> 'Make friends').
@immutable
class PurposeChipVm {
  const PurposeChipVm({required this.label});
  final String label;
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

/// Cached-merge of the web `useProfileCounts` result, consumed by the header
/// counts row. All fields default to 0 so a partial view-model renders safely.
@immutable
class ProfileCountsView {
  const ProfileCountsView({
    this.followers = 0,
    this.following = 0,
    this.friends = 0,
    this.likes = 0,
    this.views = 0,
    this.posts = 0,
  });

  final int followers;
  final int following;
  final int friends;
  final int likes;
  final int views;
  final int posts;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/// Everything the [ProfileHeader] renders. Pure data; constructed by the host
/// from `UserProfile` + counts + resolved badges + relationship flags.
@immutable
class ProfileHeaderView {
  const ProfileHeaderView({
    required this.userId,
    required this.displayName,
    required this.handle,
    required this.counts,
    this.bio = '',
    this.avatarUrl,
    this.coverUrl,
    this.city,
    this.country,
    this.detectedCountryCode,
    this.occupation,
    this.websiteUrl,
    this.purposeChips = const [],
    this.badges = const ProfileBadgeSet(),
    this.isOwnProfile = false,
    this.isFollowingMe = false,
    this.areMutualFriends = false,
  });

  final String userId;
  final String displayName;

  /// Bare handle (no leading '@').
  final String handle;
  final String bio;
  final String? avatarUrl;
  final String? coverUrl;

  /// Either may be present; the widget composes 'city, country'.
  final String? city;
  final String? country;

  /// ISO-3166 alpha-2 code used for the country-flag emoji.
  final String? detectedCountryCode;
  final String? occupation;
  final String? websiteUrl;

  final List<PurposeChipVm> purposeChips;
  final ProfileBadgeSet badges;

  /// Controls settings/upload affordances and Friends gating.
  final bool isOwnProfile;

  /// On another user's profile: that user follows the viewer.
  final bool isFollowingMe;

  /// Drives the Friends-stat gating (own profile OR mutual -> interactive).
  final bool areMutualFriends;

  final ProfileCountsView counts;

  String get nameOrFallback =>
      displayName.trim().isNotEmpty ? displayName : 'Unknown';

  String get handleOrFallback => handle.trim().isNotEmpty ? handle : 'user';

  /// First grapheme for the gradient-initials avatar fallback.
  String get avatarInitial {
    if (displayName.trim().isEmpty) return 'U';
    return displayName.trim().characters.first.toUpperCase();
  }

  /// Composed 'city, country' (or whichever is present); null when neither.
  String? get locationLine {
    final c = city?.trim();
    final co = country?.trim();
    final hasC = c != null && c.isNotEmpty;
    final hasCo = co != null && co.isNotEmpty;
    if (hasC && hasCo) return '$c, $co';
    if (hasC) return c;
    if (hasCo) return co;
    return null;
  }

  bool get hasAvatar => avatarUrl != null && avatarUrl!.trim().isNotEmpty;
  bool get hasCover => coverUrl != null && coverUrl!.trim().isNotEmpty;
  bool get hasBio => bio.trim().isNotEmpty;
  bool get hasWebsite => websiteUrl != null && websiteUrl!.trim().isNotEmpty;
  bool get hasOccupation => occupation != null && occupation!.trim().isNotEmpty;

  /// Friends stat is interactive only for own profile or mutual friends.
  bool get friendsInteractive => isOwnProfile || areMutualFriends;
}

// ---------------------------------------------------------------------------
// Connections / Friends modals
// ---------------------------------------------------------------------------

/// One row in the Followers/Following list.
@immutable
class FollowRowView {
  const FollowRowView({
    required this.user,
    this.isFollowedByMe = false,
    this.isOwnRow = false,
    this.isProcessing = false,
  });

  final ProfileUserRef user;

  /// Drives the Follow/Following toggle label/style.
  final bool isFollowedByMe;

  /// Hides the action button on the viewer's own row.
  final bool isOwnRow;

  /// Disables the button mid-toggle.
  final bool isProcessing;
}

/// One row in the Friends list.
@immutable
class FriendRowView {
  const FriendRowView({required this.user, this.isOwnRow = false});

  final ProfileUserRef user;

  /// Hides the Chat / view-profile actions on the viewer's own row.
  final bool isOwnRow;
}

/// Whole Followers/Following modal state.
@immutable
class ConnectionsModalView {
  const ConnectionsModalView({
    this.followers = const [],
    this.following = const [],
    this.followersCount = 0,
    this.followingCount = 0,
    this.defaultTab = ConnectionsTab.followers,
    this.isLoading = false,
    this.listsUnavailable = false,
  });

  final List<FollowRowView> followers;
  final List<FollowRowView> following;
  final int followersCount;
  final int followingCount;
  final ConnectionsTab defaultTab;
  final bool isLoading;

  /// True when counts are known but native has no follower/following row source.
  ///
  /// This lets the UI avoid dishonest "No followers" copy when the count is
  /// non-zero but the underlying list cannot be loaded in native yet.
  final bool listsUnavailable;
}

/// Whole Friends modal state.
@immutable
class FriendsModalView {
  const FriendsModalView({
    this.friends = const [],
    this.friendsCount = 0,
    this.isLoading = false,
  });

  final List<FriendRowView> friends;
  final int friendsCount;
  final bool isLoading;
}

// ---------------------------------------------------------------------------
// Posts grid
// ---------------------------------------------------------------------------

/// One square tile in the posts grid.
@immutable
class PostTileView {
  const PostTileView({
    required this.id,
    this.mediaUrl,
    this.thumbnailUrl,
    this.content,
    this.media = PostTileMedia.text,
    this.viewsCount = 0,
    this.mediaCount = 1,
  });

  final String id;

  /// Primary media URL (image source, or video source if no thumbnail).
  final String? mediaUrl;

  /// Optional poster frame for video tiles (preferred over [mediaUrl]).
  final String? thumbnailUrl;

  /// Caption used for text-only tiles.
  final String? content;

  final PostTileMedia media;
  final int viewsCount;

  /// >1 drives the stacked-layers multi-media indicator.
  final int mediaCount;

  bool get showViewBadge => viewsCount > 0;
  bool get isMulti => mediaCount > 1;

  /// Best image URL to display for image/video tiles.
  String? get displayImageUrl {
    if (media == PostTileMedia.video) {
      final t = thumbnailUrl;
      if (t != null && t.trim().isNotEmpty) return t;
    }
    final m = mediaUrl;
    return (m != null && m.trim().isNotEmpty) ? m : null;
  }
}

/// Whole posts-grid state.
@immutable
class PostsGridView {
  const PostsGridView({
    this.tiles = const [],
    this.isOwnProfile = false,
    this.isLoading = false,
  });

  final List<PostTileView> tiles;

  /// Gates the Delete action in the tile menu.
  final bool isOwnProfile;

  /// Toggles the skeleton vs content.
  final bool isLoading;

  bool get isEmpty => !isLoading && tiles.isEmpty;
}

// ---------------------------------------------------------------------------
// View history
// ---------------------------------------------------------------------------

/// One row in the View History list.
@immutable
class ViewHistoryItemView {
  const ViewHistoryItemView({
    required this.postId,
    required this.viewedAtMillis,
    this.content,
    this.mediaUrl,
    this.author,
  });

  final String postId;

  /// Epoch millis the post was viewed (for relative-time formatting).
  final int viewedAtMillis;

  /// Post caption; 'No caption' fallback applied by the widget.
  final String? content;
  final String? mediaUrl;

  /// Author reference for the leading avatar + name/@username.
  final ProfileUserRef? author;

  String get contentOrFallback {
    final c = content?.trim();
    return (c != null && c.isNotEmpty) ? c : 'No caption';
  }
}

/// Whole View History card state.
@immutable
class ViewHistoryView {
  const ViewHistoryView({
    this.items = const [],
    this.isLoading = false,
    this.canClear = false,
  });

  final List<ViewHistoryItemView> items;
  final bool isLoading;

  /// Gates the clear-all button (own history only).
  final bool canClear;

  bool get isEmpty => !isLoading && items.isEmpty;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/// Compact large numbers: 1.2K / 3.4M (web parity). Trailing '.0' trimmed.
String compactCount(int value) {
  if (value >= 1000000) {
    return '${_trim1(value / 1000000)}M';
  }
  if (value >= 1000) {
    return '${_trim1(value / 1000)}K';
  }
  return value.toString();
}

String _trim1(double v) {
  final s = v.toStringAsFixed(1);
  return s.endsWith('.0') ? s.substring(0, s.length - 2) : s;
}

/// Emoji flag from an ISO-3166 alpha-2 country code (e.g. 'US' -> 🇺🇸).
/// Returns null for anything that isn't exactly two ASCII letters.
String? countryFlagEmoji(String? code) {
  if (code == null) return null;
  final c = code.trim().toUpperCase();
  if (c.length != 2) return null;
  final a = c.codeUnitAt(0);
  final b = c.codeUnitAt(1);
  if (a < 0x41 || a > 0x5A || b < 0x41 || b > 0x5A) return null;
  const base = 0x1F1E6; // regional indicator 'A'
  return String.fromCharCode(base + (a - 0x41)) +
      String.fromCharCode(base + (b - 0x41));
}

/// Short relative time with suffix ('just now', '2h ago', '3d ago').
/// Replaces date-fns `formatDistanceToNow(..., { addSuffix: true })`.
String relativeTimeShort(int millis, {DateTime? now}) {
  final ref = now ?? DateTime.now();
  final then = DateTime.fromMillisecondsSinceEpoch(millis);
  final diff = ref.difference(then);
  final secs = diff.inSeconds;
  if (secs < 0) return 'just now';
  if (secs < 45) return 'just now';
  final mins = diff.inMinutes;
  if (mins < 60) return '${mins}m ago';
  final hours = diff.inHours;
  if (hours < 24) return '${hours}h ago';
  final days = diff.inDays;
  if (days < 7) return '${days}d ago';
  if (days < 30) return '${(days / 7).floor()}w ago';
  if (days < 365) return '${(days / 30).floor()}mo ago';
  return '${(days / 365).floor()}y ago';
}
