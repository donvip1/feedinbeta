import '../../../data/remote/messages_remote_data_source.dart';
import '../data/conversation_store.dart';
import '../domain/conversation.dart';

/// Seeds/refreshes the new [ConversationStore] from the EXISTING backend
/// contract (`get_conversations_with_details`), so the new Chats surface shows
/// real conversations with zero backend change. Read-only toward legacy code:
/// it consumes [MessagesRemoteDataSource] without modifying it.
///
/// The mapping is exposed pure ([conversationFromRemote]) so it is unit-tested
/// without a network.
class ConversationsBackfill {
  ConversationsBackfill({
    required MessagesRemoteDataSource remote,
    required ConversationStore store,
    required this.selfUserId,
  }) : _remote = remote,
       _store = store;

  final MessagesRemoteDataSource _remote;
  final ConversationStore _store;
  final String selfUserId;

  /// Pull the server inbox and upsert every conversation. Returns how many
  /// were applied. Failures leave the local inbox untouched (stale > empty).
  Future<int> run() async {
    final List<RemoteConversation> remotes;
    try {
      remotes = await _remote.fetchConversations();
    } catch (_) {
      return 0;
    }
    var applied = 0;
    for (final remote in remotes) {
      await _store.upsert(
        conversationFromRemote(remote, selfUserId: selfUserId),
      );
      applied += 1;
    }
    return applied;
  }

  /// Pure mapping: server DM row -> unified [Conversation].
  static Conversation conversationFromRemote(
    RemoteConversation remote, {
    required String selfUserId,
  }) {
    final otherId = remote.otherUserId ?? '';
    return Conversation(
      id: remote.serverConversationId,
      type: ConversationType.dm,
      memberIds: [selfUserId, if (otherId.isNotEmpty) otherId],
      title: remote.title,
      lastMessageAt: remote.updatedAtMillis,
      avatarUrl: remote.otherUserAvatarUrl,
      lastMessagePreview: remote.lastMessagePreview,
      unreadCount: remote.unreadCount,
    );
  }
}
