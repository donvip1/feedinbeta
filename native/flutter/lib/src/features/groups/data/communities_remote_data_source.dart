import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'community_models.dart';

class CommunitiesRemoteDataSource {
  const CommunitiesRemoteDataSource({required this.isConfigured});

  factory CommunitiesRemoteDataSource.autoDetect() {
    try {
      Supabase.instance.client;
      return const CommunitiesRemoteDataSource(isConfigured: true);
    } catch (_) {
      return const CommunitiesRemoteDataSource(isConfigured: false);
    }
  }

  final bool isConfigured;

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  String? get currentUserId => _client?.auth.currentUser?.id;

  Future<List<CommunitySummary>> fetchCommunities() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    final results = await Future.wait([
      client
          .from('groups')
          .select(_groupFields)
          .order('updated_at', ascending: false),
      client
          .from('group_members')
          .select('group_id, role')
          .eq('user_id', userId),
      client
          .from('group_join_requests')
          .select('group_id')
          .eq('user_id', userId)
          .eq('status', 'pending'),
    ]);
    final roles = <String, String>{
      for (final row in results[1])
        row['group_id'].toString(): row['role']?.toString() ?? 'member',
    };
    final pending = <String>{
      for (final row in results[2]) row['group_id'].toString(),
    };
    return results[0]
        .map(
          (row) => _mapCommunity(
            Map<String, dynamic>.from(row),
            viewerRole: roles[row['id'].toString()],
            requestPending: pending.contains(row['id'].toString()),
          ),
        )
        .toList();
  }

  Future<CommunitySummary?> fetchCommunity(String groupId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return null;
    final row = await client
        .from('groups')
        .select(_groupFields)
        .eq('id', groupId)
        .maybeSingle();
    if (row == null) return null;
    final membership = await client
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();
    final request = await client
        .from('group_join_requests')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    return _mapCommunity(
      Map<String, dynamic>.from(row),
      viewerRole: membership?['role']?.toString(),
      requestPending: request != null,
    );
  }

  Future<CommunitySummary> createCommunity({
    required String name,
    required String description,
    required bool isPrivate,
    required bool isPremium,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) {
      throw const AuthException('Sign in to create a community.');
    }
    final row = await client
        .from('groups')
        .insert({
          'name': name.trim(),
          'description': description.trim(),
          'created_by': userId,
          'is_private': isPrivate,
          'is_premium': isPremium,
          'requires_subscription': isPremium,
        })
        .select(_groupFields)
        .single();
    return _mapCommunity(Map<String, dynamic>.from(row), viewerRole: 'owner');
  }

  Future<CommunityJoinResult> joinCommunity(String groupId) async {
    final client = _client;
    if (client == null) throw StateError('Communities are unavailable.');
    final response = await client.rpc(
      'join_group',
      params: {'p_group_id': groupId},
    );
    return response?.toString() == 'requested'
        ? CommunityJoinResult.requested
        : CommunityJoinResult.joined;
  }

  Future<String> joinViaInvite(String inviteCode) async {
    final client = _client;
    if (client == null) throw StateError('Communities are unavailable.');
    final response = await client.rpc(
      'join_group_via_invite',
      params: {'p_invite_code': inviteCode.trim().toLowerCase()},
    );
    return response.toString();
  }

  Future<void> leaveCommunity(String groupId) async {
    final client = _client;
    if (client == null) return;
    await client.rpc('leave_group', params: {'p_group_id': groupId});
  }

  Future<List<CommunityMember>> fetchMembers(String groupId) async {
    final client = _client;
    if (client == null) return const [];
    final rows = await client
        .from('group_members')
        .select('user_id, role, joined_at')
        .eq('group_id', groupId)
        .order('joined_at');
    final userIds = rows
        .map((row) => row['user_id'].toString())
        .toSet()
        .toList();
    final profiles = userIds.isEmpty
        ? const <Map<String, dynamic>>[]
        : await client
              .from('profiles')
              .select('id, display_name, username, avatar_url')
              .inFilter('id', userIds);
    final byId = {for (final row in profiles) row['id'].toString(): row};
    return rows.map((row) {
      final profile = byId[row['user_id'].toString()];
      final name = profile?['display_name']?.toString().trim();
      final username = profile?['username']?.toString().trim();
      return CommunityMember(
        userId: row['user_id'].toString(),
        role: row['role']?.toString() ?? 'member',
        joinedAtMillis: communityMillis(row['joined_at']),
        displayName: name?.isNotEmpty == true
            ? name!
            : username?.isNotEmpty == true
            ? username!
            : 'feedIn user',
        username: username?.isNotEmpty == true ? username : null,
        avatarUrl: profile?['avatar_url']?.toString(),
      );
    }).toList();
  }

  Future<List<CommunityMessage>> fetchMessages(String groupId) async {
    final client = _client;
    if (client == null) return const [];
    final rows = await client
        .from('group_messages')
        .select(
          'id, group_id, sender_id, content, media_url, storage_bucket, '
          'storage_path, media_type, file_name, created_at',
        )
        .eq('group_id', groupId)
        .isFilter('deleted_at', null)
        .order('created_at')
        .limit(100);
    final senderIds = rows
        .map((row) => row['sender_id'].toString())
        .toSet()
        .toList();
    final profiles = senderIds.isEmpty
        ? const <Map<String, dynamic>>[]
        : await client
              .from('profiles')
              .select('id, display_name, username, avatar_url')
              .inFilter('id', senderIds);
    final byId = {for (final row in profiles) row['id'].toString(): row};

    return Future.wait(
      rows.map((row) async {
        final profile = byId[row['sender_id'].toString()];
        final displayName = profile?['display_name']?.toString().trim();
        final username = profile?['username']?.toString().trim();
        String? mediaUrl = row['media_url']?.toString();
        final storagePath = row['storage_path']?.toString();
        final storageBucket = row['storage_bucket']?.toString();
        if ((mediaUrl == null || mediaUrl.isEmpty) &&
            storagePath != null &&
            storagePath.isNotEmpty &&
            storageBucket != null &&
            storageBucket.isNotEmpty) {
          try {
            mediaUrl = await client.storage
                .from(storageBucket)
                .createSignedUrl(storagePath, 3600);
          } catch (_) {}
        }
        return CommunityMessage(
          id: row['id'].toString(),
          groupId: row['group_id'].toString(),
          senderId: row['sender_id'].toString(),
          senderName: displayName?.isNotEmpty == true
              ? displayName!
              : username?.isNotEmpty == true
              ? username!
              : 'feedIn user',
          senderAvatarUrl: profile?['avatar_url']?.toString(),
          content: row['content']?.toString() ?? '',
          mediaUrl: mediaUrl,
          mediaType: row['media_type']?.toString(),
          fileName: row['file_name']?.toString(),
          createdAtMillis: communityMillis(row['created_at']),
        );
      }),
    );
  }

  Future<void> sendMessage({
    required String groupId,
    required String body,
  }) async {
    final client = _client;
    final userId = currentUserId;
    final content = body.trim();
    if (client == null || userId == null || content.isEmpty) return;
    await client.from('group_messages').insert({
      'group_id': groupId,
      'sender_id': userId,
      'content': content,
    });
  }

  Future<void> sendImage({
    required String groupId,
    required String localPath,
    String caption = '',
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return;
    final file = File(localPath);
    if (!file.existsSync()) throw StateError('Selected image is unavailable.');
    final extension = localPath.contains('.')
        ? localPath.split('.').last.toLowerCase()
        : 'jpg';
    final storagePath =
        '$groupId/$userId/${DateTime.now().microsecondsSinceEpoch}.$extension';
    await client.storage
        .from('group-media')
        .upload(
          storagePath,
          file,
          fileOptions: FileOptions(
            contentType: extension == 'png'
                ? 'image/png'
                : extension == 'webp'
                ? 'image/webp'
                : 'image/jpeg',
          ),
        );
    await client.from('group_messages').insert({
      'group_id': groupId,
      'sender_id': userId,
      'content': caption.trim(),
      'storage_bucket': 'group-media',
      'storage_path': storagePath,
      'media_type': 'image',
      'file_name': localPath.split('/').last,
      'file_size': file.lengthSync(),
    });
  }

  CommunitySummary _mapCommunity(
    Map<String, dynamic> row, {
    String? viewerRole,
    bool requestPending = false,
  }) {
    return CommunitySummary(
      id: row['id'].toString(),
      name: row['name']?.toString() ?? 'Community',
      description: row['description']?.toString() ?? '',
      createdBy: row['created_by']?.toString() ?? '',
      isPrivate: row['is_private'] == true,
      isPremium:
          row['is_premium'] == true || row['requires_subscription'] == true,
      memberCount: communityInt(row['member_count']),
      postCount: communityInt(row['post_count']),
      inviteCode: row['invite_code']?.toString() ?? '',
      updatedAtMillis: communityMillis(row['updated_at']),
      avatarUrl: row['avatar_url']?.toString(),
      coverUrl: row['cover_url']?.toString(),
      viewerRole: viewerRole,
      joinRequestPending: requestPending,
    );
  }

  static const _groupFields =
      'id, name, description, avatar_url, cover_url, created_by, is_private, '
      'is_premium, requires_subscription, member_count, post_count, invite_code, updated_at';
}
