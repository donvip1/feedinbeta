import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/profile/user_profile.dart';

class ProfileRemoteDataSource {
  const ProfileRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<UserProfile?> fetchProfile(String userId) async {
    if (!isConfigured) return null;

    final row = await Supabase.instance.client
        .from('profiles')
        .select('id, display_name, username, bio, updated_at')
        .eq('id', userId)
        .maybeSingle();

    if (row == null) return null;
    return _mapProfile(row);
  }

  Future<void> upsertProfile(UserProfile profile) async {
    if (!isConfigured || profile.userId == 'local-demo') return;

    await Supabase.instance.client.from('profiles').upsert({
      'id': profile.userId,
      'display_name': profile.displayName,
      'username': profile.handle,
      'bio': profile.bio,
    });
  }

  UserProfile _mapProfile(Map<String, dynamic> row) {
    final updatedAt = DateTime.tryParse(row['updated_at']?.toString() ?? '');
    final displayName = row['display_name']?.toString();
    final username = row['username']?.toString();

    return UserProfile(
      userId: row['id'].toString(),
      displayName:
          displayName == null || displayName.isEmpty ? 'FEEDIN User' : displayName,
      handle: username == null || username.isEmpty ? 'feedin_user' : username,
      bio: row['bio']?.toString() ?? '',
      completedAtMillis:
          updatedAt?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }
}
