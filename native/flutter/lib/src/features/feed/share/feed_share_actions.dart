import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../data/remote/message_recipient_remote_data_source.dart';
import '../../create/story_publisher.dart';
import '../../groups/data/communities_remote_data_source.dart';
import '../../messages/message_recipient.dart';
import '../feed_post.dart';
import '../feed_share_service.dart';
import 'feed_media_downloader.dart';

/// A friend or group the current post can be shared to, in the share drawer's
/// searchable sub-views.
class ShareTarget {
  const ShareTarget({
    required this.id,
    required this.title,
    this.subtitle,
    this.avatarUrl,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? avatarUrl;
}

/// Behaviour seam for the web-parity share drawer. The immersive feed builds
/// [FeedShareActionsImpl]; widget tests inject a fake so the sheet can be
/// exercised without Supabase or the gallery.
abstract interface class FeedShareActions {
  /// Media is present, so Story / Download are offered.
  bool get hasMedia;

  /// Current saved state for the "Save Post" row label.
  bool get isSaved;

  Future<void> shareToStory();

  /// Friends are found by search (matches the web sub-view's search field).
  Future<List<ShareTarget>> searchFriends(String query);
  Future<void> sendToFriend(ShareTarget friend);

  Future<List<ShareTarget>> loadGroups();
  Future<void> sendToGroup(ShareTarget group);

  Future<void> copyLink();

  /// Toggle save; returns the new saved state.
  Future<bool> toggleSave();

  Future<void> download();

  /// Native OS share sheet — the "More" quick action.
  Future<void> shareExternal();
}

/// Concrete share actions wired to the existing native data sources, mirroring
/// `src/components/feed/MobileShareSheet.tsx`.
class FeedShareActionsImpl implements FeedShareActions {
  FeedShareActionsImpl({
    required this.post,
    required this.shareService,
    required bool isConfigured,
    required bool initiallySaved,
    required Future<bool> Function() onToggleSave,
    Future<void> Function()? onExternalShared,
    StoryPublisher? storyPublisher,
    MessageRecipientRemoteDataSource? recipients,
    CommunitiesRemoteDataSource? communities,
    FeedMediaDownloader? downloader,
  }) : _isConfigured = isConfigured,
       _saved = initiallySaved,
       _onToggleSave = onToggleSave,
       _onExternalShared = onExternalShared,
       _storyPublisher = storyPublisher ?? StoryPublisher(),
       _recipients =
           recipients ??
           MessageRecipientRemoteDataSource(isConfigured: isConfigured),
       _communities =
           communities ?? CommunitiesRemoteDataSource.autoDetect(),
       _downloader = downloader ?? FeedMediaDownloader();

  final FeedPost post;
  final FeedShareService shareService;
  final bool _isConfigured;
  final Future<bool> Function() _onToggleSave;
  final Future<void> Function()? _onExternalShared;
  final StoryPublisher _storyPublisher;
  final MessageRecipientRemoteDataSource _recipients;
  final CommunitiesRemoteDataSource _communities;
  final FeedMediaDownloader _downloader;

  bool _saved;

  /// The concrete post whose media/link is shared (resolves re-shares).
  FeedPost get _content => post.displayedPost;

  String? get _mediaUrl {
    final direct = _content.mediaUrl?.trim();
    if (direct != null && direct.isNotEmpty) return direct;
    final first = _content.mediaUrls.isNotEmpty
        ? _content.mediaUrls.first.trim()
        : '';
    return first.isEmpty ? null : first;
  }

  bool get _isVideo => _content.hasVideoMedia;

  @override
  bool get hasMedia => _mediaUrl != null;

  @override
  bool get isSaved => _saved;

  @override
  Future<void> shareToStory() async {
    final url = _mediaUrl;
    if (url == null) {
      throw const StoryPublishException('This post has no media to share.');
    }
    await _storyPublisher.publishSharedMedia(
      mediaUrl: url,
      mediaType: _isVideo ? 'video' : 'image',
    );
  }

  @override
  Future<List<ShareTarget>> searchFriends(String query) async {
    final results = await _recipients.searchRecipients(query);
    return results
        .map(
          (MessageRecipient r) => ShareTarget(
            id: r.userId,
            title: r.displayName,
            subtitle: '@${r.username}',
            avatarUrl: r.avatarUrl,
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<void> sendToFriend(ShareTarget friend) async {
    if (!_isConfigured) return;
    final conversationId = await _recipients.createServerConversation(
      friend.id,
    );
    if (conversationId == null) {
      throw const _ShareException('Could not open the conversation.');
    }
    final client = Supabase.instance.client;
    await client.from('messages').insert({
      'conversation_id': conversationId,
      'sender_id': client.auth.currentUser?.id,
      'content': shareService.shareText(post),
      'media_type': 'text',
    });
  }

  @override
  Future<List<ShareTarget>> loadGroups() async {
    final communities = await _communities.fetchCommunities();
    return communities
        .map(
          (c) => ShareTarget(
            id: c.id,
            title: c.name,
            subtitle: '${c.memberCount} members',
            avatarUrl: c.avatarUrl,
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<void> sendToGroup(ShareTarget group) async {
    await _communities.sendMessage(
      groupId: group.id,
      body: shareService.shareText(post),
    );
  }

  @override
  Future<void> copyLink() => shareService.copyPostLink(post);

  @override
  Future<bool> toggleSave() async {
    _saved = await _onToggleSave();
    return _saved;
  }

  @override
  Future<void> download() =>
      _downloader.saveToGallery(url: _mediaUrl ?? '', isVideo: _isVideo);

  @override
  Future<void> shareExternal() async {
    await shareService.openNativeShareSheet(post);
    // Best-effort share analytics; never blocks the user action.
    await _onExternalShared?.call();
  }
}

class _ShareException implements Exception {
  const _ShareException(this.message);
  final String message;
  @override
  String toString() => message;
}
