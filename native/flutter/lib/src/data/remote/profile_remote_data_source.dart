import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/profile/user_profile.dart';

class ProfileRemoteDataSource {
  const ProfileRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<UserProfile?> fetchProfile(String userId) async {
    if (!isConfigured) return null;

    final row = await Supabase.instance.client
        .from('profiles')
        .select(
          'id, display_name, username, bio, avatar_url, cover_url, banner_url, location, website_url, instagram_url, twitter_url, linkedin_url, facebook_url, tiktok_url, youtube_url, role, plan_tier, followers_count, following_count, total_views, is_premium, updated_at',
        )
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
      'location': profile.location,
      'website_url': profile.websiteUrl,
      'instagram_url': profile.instagramUrl,
      'twitter_url': profile.twitterUrl,
      'linkedin_url': profile.linkedinUrl,
      'facebook_url': profile.facebookUrl,
      'tiktok_url': profile.tiktokUrl,
      'youtube_url': profile.youtubeUrl,
    });
  }

  UserProfile _mapProfile(Map<String, dynamic> row) {
    final updatedAt = DateTime.tryParse(row['updated_at']?.toString() ?? '');
    final displayName = row['display_name']?.toString();
    final username = row['username']?.toString();

    return UserProfile(
      userId: row['id'].toString(),
      displayName: displayName == null || displayName.isEmpty
          ? 'feedIn User'
          : displayName,
      handle: username == null || username.isEmpty ? 'feedin_user' : username,
      bio: row['bio']?.toString() ?? '',
      avatarUrl: row['avatar_url']?.toString(),
      coverUrl: row['cover_url']?.toString() ?? row['banner_url']?.toString(),
      location: row['location']?.toString(),
      websiteUrl: row['website_url']?.toString(),
      instagramUrl: row['instagram_url']?.toString(),
      twitterUrl: row['twitter_url']?.toString(),
      linkedinUrl: row['linkedin_url']?.toString(),
      facebookUrl: row['facebook_url']?.toString(),
      tiktokUrl: row['tiktok_url']?.toString(),
      youtubeUrl: row['youtube_url']?.toString(),
      role: row['role']?.toString(),
      planTier: row['plan_tier']?.toString(),
      followersCount: row['followers_count'] as int? ?? 0,
      followingCount: row['following_count'] as int? ?? 0,
      totalViews: row['total_views'] as int? ?? 0,
      isPremium: row['is_premium'] as bool? ?? false,
      completedAtMillis:
          updatedAt?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }
}
