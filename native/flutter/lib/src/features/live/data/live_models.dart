/// Immutable data models for the live streaming + audio-space experience.
///
/// Column mappings mirror the native Supabase schema in
/// `20260624000100_native_core_schema.sql` (base `live_streams` / `live_spaces`)
/// and `20260624000600_native_advanced_live_calls_schema.sql` (the advanced
/// viewer / comment / reaction / gift / speaker / message tables). These are the
/// tables the RLS policies in `20260624000700_native_extended_rls_policies.sql`
/// expose, so the remote data source only ever reads/writes columns that
/// actually exist on the live database.
library;

import 'dart:convert';

/// Kind of live room shown in the browse list. `stream` == video broadcast
/// (`live_streams`), `space` == audio room (`live_spaces`).
enum LiveRoomKind { stream, space }

/// A host-published "PULSE" spotlight card shown to viewers inside a live
/// stream: an announcement, promo code, or product highlight. Mirrors the web
/// `HostCard` shape in `stream-v2/AICatchUpPanel.tsx` (emoji + title + body +
/// optional link) so the same JSON round-trips between web and native.
///
/// Persisted under `live_streams.stream_features.host_cards` (a JSON array).
/// See the module report for the backend gap: the `stream_features` column may
/// not exist on the deployed schema, in which case host cards are read/written
/// best-effort and simply do not persist.
class HostCard {
  const HostCard({
    required this.id,
    required this.emoji,
    required this.title,
    this.body = '',
    this.link,
  });

  final String id;
  final String emoji;
  final String title;
  final String body;
  final String? link;

  /// Emoji palette offered in the host add-card form (web `CARD_EMOJIS`).
  static const emojiPalette = <String>[
    '🔥',
    '🎁',
    '💎',
    '🎯',
    '🛍️',
    '📢',
    '🎶',
    '⚡',
    '🏷️',
    '💰',
  ];

  bool get hasLink => link != null && link!.trim().isNotEmpty;

  HostCard copyWith({String? emoji, String? title, String? body, String? link}) {
    return HostCard(
      id: id,
      emoji: emoji ?? this.emoji,
      title: title ?? this.title,
      body: body ?? this.body,
      link: link ?? this.link,
    );
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'emoji': emoji,
    'title': title,
    'body': body,
    if (hasLink) 'link': link!.trim(),
  };

  static HostCard? tryFromJson(Object? value) {
    if (value is! Map) return null;
    final map = Map<String, Object?>.from(value);
    final id = map['id']?.toString();
    final title = map['title']?.toString();
    if (id == null || id.isEmpty || title == null || title.trim().isEmpty) {
      return null;
    }
    final emoji = map['emoji']?.toString();
    final link = map['link']?.toString();
    return HostCard(
      id: id,
      emoji: (emoji != null && emoji.isNotEmpty) ? emoji : '🔥',
      title: title.trim(),
      body: map['body']?.toString() ?? '',
      link: (link != null && link.trim().isNotEmpty) ? link.trim() : null,
    );
  }

  /// Parse the `stream_features.host_cards` array into an ordered card list,
  /// tolerating a raw JSON list, a JSON-encoded string, or a null/absent value.
  static List<HostCard> listFrom(Object? hostCardsValue) {
    final raw = hostCardsValue;
    Iterable<Object?> entries;
    if (raw is List) {
      entries = raw;
    } else if (raw is String && raw.trim().isNotEmpty) {
      final decoded = _tryDecode(raw);
      entries = decoded is List ? decoded : const [];
    } else {
      entries = const [];
    }
    return [
      for (final entry in entries)
        if (HostCard.tryFromJson(entry) case final card?) card,
    ];
  }
}

/// Small profile projection embedded alongside live rows. Kept minimal so the
/// PostgREST embed only selects columns that exist on `profiles`.
class LiveProfile {
  const LiveProfile({
    required this.id,
    this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String id;
  final String? displayName;
  final String? username;
  final String? avatarUrl;

  /// Best-effort human label: display name → @username → "feedIn user".
  String get label {
    if (displayName != null && displayName!.trim().isNotEmpty) {
      return displayName!.trim();
    }
    if (username != null && username!.trim().isNotEmpty) {
      return '@${username!.trim()}';
    }
    return 'feedIn user';
  }

  /// First grapheme for an avatar fallback badge.
  String get initial {
    final source = displayName?.trim().isNotEmpty == true
        ? displayName!.trim()
        : username?.trim().isNotEmpty == true
        ? username!.trim()
        : 'U';
    // `source` always falls back to 'U', so it is never empty here.
    return source.substring(0, 1).toUpperCase();
  }

  static LiveProfile? tryFromEmbed(Object? value) {
    if (value is Map) {
      final map = Map<String, Object?>.from(value);
      final id = map['id']?.toString();
      if (id == null || id.isEmpty) return null;
      String? text(String key) {
        final raw = map[key]?.toString();
        return (raw != null && raw.isNotEmpty) ? raw : null;
      }

      return LiveProfile(
        id: id,
        displayName: text('display_name'),
        username: text('username'),
        avatarUrl: text('avatar_url'),
      );
    }
    return null;
  }
}

/// A live video stream summary for the browse grid + viewer header.
class LiveStreamSummary {
  const LiveStreamSummary({
    required this.id,
    required this.hostId,
    required this.title,
    required this.status,
    required this.viewerCount,
    this.description,
    this.thumbnailUrl,
    this.playbackUrl,
    this.startedAtMillis,
    this.host,
    this.hostCards = const [],
  });

  final String id;
  final String hostId;
  final String title;
  final String status;
  final int viewerCount;
  final String? description;
  final String? thumbnailUrl;

  /// HLS playback URL for the [video_player] `VideoPlayerController`. Null until
  /// the broadcaster has an ingest configured (native broadcasting is not built).
  final String? playbackUrl;
  final int? startedAtMillis;
  final LiveProfile? host;

  /// Host-published PULSE spotlight cards, decoded from
  /// `stream_features.host_cards`. Empty when the column is absent or the host
  /// has published none (the common case). See [HostCard].
  final List<HostCard> hostCards;

  bool get isLive => status == 'live';

  factory LiveStreamSummary.fromJson(Map<String, Object?> json) {
    String? text(String key) {
      final raw = json[key]?.toString();
      return (raw != null && raw.isNotEmpty) ? raw : null;
    }

    return LiveStreamSummary(
      id: json['id']?.toString() ?? '',
      hostId: json['user_id']?.toString() ?? '',
      title: text('title') ?? 'Live stream',
      status: text('status') ?? 'ended',
      viewerCount: _parseInt(json['viewer_count']),
      description: text('description'),
      thumbnailUrl: text('thumbnail_url'),
      playbackUrl: text('playback_url'),
      startedAtMillis: _parseNullableMillis(json['started_at']),
      host: LiveProfile.tryFromEmbed(json['profiles'] ?? json['host']),
      hostCards: hostCardsFromFeatures(json['stream_features']),
    );
  }

  LiveStreamSummary copyWith({List<HostCard>? hostCards}) {
    return LiveStreamSummary(
      id: id,
      hostId: hostId,
      title: title,
      status: status,
      viewerCount: viewerCount,
      description: description,
      thumbnailUrl: thumbnailUrl,
      playbackUrl: playbackUrl,
      startedAtMillis: startedAtMillis,
      host: host,
      hostCards: hostCards ?? this.hostCards,
    );
  }
}

/// Extract the ordered [HostCard] list from a `stream_features` value, which may
/// arrive as a decoded map, a JSON-encoded string, or be entirely absent.
List<HostCard> hostCardsFromFeatures(Object? streamFeatures) {
  final features = streamFeatures;
  Map<String, Object?>? map;
  if (features is Map) {
    map = Map<String, Object?>.from(features);
  } else if (features is String && features.trim().isNotEmpty) {
    final decoded = _tryDecode(features);
    if (decoded is Map) map = Map<String, Object?>.from(decoded);
  }
  if (map == null) return const [];
  return HostCard.listFrom(map['host_cards']);
}

/// A live audio space summary for the browse grid + room header.
class LiveSpaceSummary {
  const LiveSpaceSummary({
    required this.id,
    required this.hostId,
    required this.title,
    required this.status,
    required this.viewerCount,
    this.description,
    this.topicCategory,
    this.startedAtMillis,
    this.host,
  });

  final String id;
  final String hostId;
  final String title;
  final String status;
  final int viewerCount;
  final String? description;
  final String? topicCategory;
  final int? startedAtMillis;
  final LiveProfile? host;

  bool get isLive => status == 'live';

  factory LiveSpaceSummary.fromJson(Map<String, Object?> json) {
    String? text(String key) {
      final raw = json[key]?.toString();
      return (raw != null && raw.isNotEmpty) ? raw : null;
    }

    return LiveSpaceSummary(
      id: json['id']?.toString() ?? '',
      hostId: json['user_id']?.toString() ?? '',
      title: text('title') ?? 'Live space',
      status: text('status') ?? 'ended',
      viewerCount: _parseInt(json['viewer_count']),
      description: text('description'),
      topicCategory: text('topic_category'),
      startedAtMillis: _parseNullableMillis(json['started_at']),
      host: LiveProfile.tryFromEmbed(json['profiles'] ?? json['host']),
    );
  }
}

/// A chat line in a live stream (`live_stream_comments`).
class LiveComment {
  const LiveComment({
    required this.id,
    required this.userId,
    required this.content,
    required this.createdAtMillis,
    this.author,
  });

  final String id;
  final String userId;
  final String content;
  final int createdAtMillis;
  final LiveProfile? author;

  factory LiveComment.fromJson(Map<String, Object?> json) {
    return LiveComment(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      createdAtMillis: _parseMillis(json['created_at']),
      author: LiveProfile.tryFromEmbed(json['profiles'] ?? json['author']),
    );
  }
}

/// A chat line in a live audio space (`live_space_messages`).
class SpaceMessage {
  const SpaceMessage({
    required this.id,
    required this.userId,
    required this.content,
    required this.createdAtMillis,
    this.author,
  });

  final String id;
  final String userId;
  final String content;
  final int createdAtMillis;
  final LiveProfile? author;

  factory SpaceMessage.fromJson(Map<String, Object?> json) {
    return SpaceMessage(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      createdAtMillis: _parseMillis(json['created_at']),
      author: LiveProfile.tryFromEmbed(json['profiles'] ?? json['author']),
    );
  }
}

/// A speaker/participant row in an audio space (`live_space_speakers`).
///
/// The native table exposes `role` (host/speaker), `status`
/// (invited/active/left), `muted`, `joined_at`, `left_at`. It does NOT have the
/// web `has_raised_hand` / `is_muted` columns, so those web-only affordances are
/// not modeled natively.
class SpaceSpeaker {
  const SpaceSpeaker({
    required this.userId,
    required this.role,
    required this.status,
    required this.muted,
    this.profile,
  });

  final String userId;
  final String role;
  final String status;
  final bool muted;
  final LiveProfile? profile;

  bool get isHost => role == 'host';

  factory SpaceSpeaker.fromJson(Map<String, Object?> json) {
    return SpaceSpeaker(
      userId: json['user_id']?.toString() ?? '',
      role: json['role']?.toString() ?? 'speaker',
      status: json['status']?.toString() ?? 'active',
      muted: json['muted'] == true,
      profile: LiveProfile.tryFromEmbed(json['profiles'] ?? json['profile']),
    );
  }
}

/// One float-up reaction event (`live_stream_reactions` / `live_space_reactions`).
class LiveReactionEvent {
  const LiveReactionEvent({
    required this.id,
    required this.reactionType,
    this.userId,
  });

  final String id;
  final String reactionType;

  /// Author of the reaction, when present on the row. Realtime INSERT payloads
  /// carry `user_id`, so the viewer can suppress re-floating its own reaction
  /// (which it already floated optimistically).
  final String? userId;

  /// Emoji for a reaction key, mirroring the web `REACTION_EMOJIS` map.
  String get emoji => reactionEmojiFor(reactionType);

  factory LiveReactionEvent.fromJson(Map<String, Object?> json) {
    final userId = json['user_id']?.toString();
    return LiveReactionEvent(
      id:
          json['id']?.toString() ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      reactionType: json['reaction_type']?.toString() ?? 'heart',
      userId: (userId != null && userId.isNotEmpty) ? userId : null,
    );
  }
}

/// One gift event (`live_stream_gifts` / `live_space_gifts`).
class LiveGiftEvent {
  const LiveGiftEvent({
    required this.id,
    required this.senderId,
    required this.giftType,
    required this.creditValue,
  });

  final String id;
  final String senderId;
  final String giftType;
  final int creditValue;

  String get emoji => giftEmojiFor(giftType);

  factory LiveGiftEvent.fromJson(Map<String, Object?> json) {
    return LiveGiftEvent(
      id: json['id']?.toString() ?? '',
      senderId: json['sender_id']?.toString() ?? '',
      giftType: json['gift_type']?.toString() ?? 'gift',
      creditValue: _parseInt(json['credit_value']),
    );
  }
}

/// A selectable gift in the send-gift sheet. Mirrors the web `GIFTS` catalog so
/// the same `gift_type` / `credit_value` pairs are written to the DB, but is
/// defined client-side (there is no seed data for `gift_appreciation_options`).
class LiveGiftOption {
  const LiveGiftOption({
    required this.type,
    required this.label,
    required this.emoji,
    required this.creditValue,
  });

  final String type;
  final String label;
  final String emoji;
  final int creditValue;

  static const catalog = <LiveGiftOption>[
    LiveGiftOption(type: 'rose', label: 'Rose', emoji: '🌹', creditValue: 10),
    LiveGiftOption(
      type: 'coffee',
      label: 'Coffee',
      emoji: '☕',
      creditValue: 20,
    ),
    LiveGiftOption(type: 'heart', label: 'Love', emoji: '❤️', creditValue: 50),
    LiveGiftOption(
      type: 'diamond',
      label: 'Diamond',
      emoji: '💎',
      creditValue: 100,
    ),
    LiveGiftOption(
      type: 'crown',
      label: 'Crown',
      emoji: '👑',
      creditValue: 250,
    ),
    LiveGiftOption(
      type: 'rocket',
      label: 'Rocket',
      emoji: '🚀',
      creditValue: 500,
    ),
    LiveGiftOption(
      type: 'castle',
      label: 'Castle',
      emoji: '🏰',
      creditValue: 1000,
    ),
    LiveGiftOption(
      type: 'universe',
      label: 'Universe',
      emoji: '🌌',
      creditValue: 2500,
    ),
  ];
}

/// A tappable reaction in the reaction bar. Mirrors the web `REACTION_EMOJIS`
/// keys so the same `reaction_type` strings are written to the DB.
class LiveReactionOption {
  const LiveReactionOption({required this.type, required this.emoji});

  final String type;
  final String emoji;

  static const bar = <LiveReactionOption>[
    LiveReactionOption(type: 'heart', emoji: '❤️'),
    LiveReactionOption(type: 'like', emoji: '👍'),
    LiveReactionOption(type: 'laugh', emoji: '😂'),
    LiveReactionOption(type: 'fire', emoji: '🔥'),
    LiveReactionOption(type: 'clap', emoji: '👏'),
    LiveReactionOption(type: 'love', emoji: '😍'),
  ];
}

/// Emoji for a live reaction key. Mirrors the web `REACTION_EMOJIS` map; unknown
/// keys fall back to the heart used across the web reaction surfaces.
String reactionEmojiFor(String type) {
  const map = {
    'heart': '❤️',
    'like': '👍',
    'laugh': '😂',
    'fire': '🔥',
    'clap': '👏',
    'love': '😍',
    'star': '⭐',
    'party': '🎉',
    '100': '💯',
    'rocket': '🚀',
    'sparkle': '✨',
  };
  return map[type] ?? '❤️';
}

/// Emoji for a gift key. Mirrors the web `GIFTS` catalog; unknown keys fall back
/// to a wrapped-gift glyph.
String giftEmojiFor(String type) {
  for (final option in LiveGiftOption.catalog) {
    if (option.type == type) return option.emoji;
  }
  return '🎁';
}

/// Best-effort JSON decode used when a JSON column arrives as a String rather
/// than an already-decoded structure. Returns null on any parse failure.
Object? _tryDecode(String source) {
  try {
    return jsonDecode(source);
  } catch (_) {
    return null;
  }
}

int _parseInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int _parseMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value?.toString() ?? '')?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

int? _parseNullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}
