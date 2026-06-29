class UserProfile {
  const UserProfile({
    required this.userId,
    required this.displayName,
    required this.handle,
    required this.bio,
    required this.completedAtMillis,
    this.avatarUrl,
    this.coverUrl,
    this.location,
    this.websiteUrl,
    this.instagramUrl,
    this.twitterUrl,
    this.linkedinUrl,
    this.facebookUrl,
    this.tiktokUrl,
    this.youtubeUrl,
    this.role,
    this.planTier,
    this.followersCount = 0,
    this.followingCount = 0,
    this.totalViews = 0,
    this.isPremium = false,
  });

  final String userId;
  final String displayName;
  final String handle;
  final String bio;
  final int completedAtMillis;
  final String? avatarUrl;
  final String? coverUrl;
  final String? location;
  final String? websiteUrl;
  final String? instagramUrl;
  final String? twitterUrl;
  final String? linkedinUrl;
  final String? facebookUrl;
  final String? tiktokUrl;
  final String? youtubeUrl;
  final String? role;
  final String? planTier;
  final int followersCount;
  final int followingCount;
  final int totalViews;
  final bool isPremium;

  UserProfile copyWith({
    String? displayName,
    String? handle,
    String? bio,
    String? avatarUrl,
    String? coverUrl,
    String? location,
    String? websiteUrl,
    String? instagramUrl,
    String? twitterUrl,
    String? linkedinUrl,
    String? facebookUrl,
    String? tiktokUrl,
    String? youtubeUrl,
    String? role,
    String? planTier,
    int? followersCount,
    int? followingCount,
    int? totalViews,
    bool? isPremium,
  }) {
    return UserProfile(
      userId: userId,
      displayName: displayName ?? this.displayName,
      handle: handle ?? this.handle,
      bio: bio ?? this.bio,
      completedAtMillis: completedAtMillis,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      coverUrl: coverUrl ?? this.coverUrl,
      location: location ?? this.location,
      websiteUrl: websiteUrl ?? this.websiteUrl,
      instagramUrl: instagramUrl ?? this.instagramUrl,
      twitterUrl: twitterUrl ?? this.twitterUrl,
      linkedinUrl: linkedinUrl ?? this.linkedinUrl,
      facebookUrl: facebookUrl ?? this.facebookUrl,
      tiktokUrl: tiktokUrl ?? this.tiktokUrl,
      youtubeUrl: youtubeUrl ?? this.youtubeUrl,
      role: role ?? this.role,
      planTier: planTier ?? this.planTier,
      followersCount: followersCount ?? this.followersCount,
      followingCount: followingCount ?? this.followingCount,
      totalViews: totalViews ?? this.totalViews,
      isPremium: isPremium ?? this.isPremium,
    );
  }

  factory UserProfile.fromJson(Map<String, Object?> json) {
    return UserProfile(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      handle: json['handle'] as String,
      bio: json['bio'] as String,
      completedAtMillis: json['completedAtMillis'] as int,
      avatarUrl: json['avatarUrl'] as String?,
      coverUrl: json['coverUrl'] as String?,
      location: json['location'] as String?,
      websiteUrl: json['websiteUrl'] as String?,
      instagramUrl: json['instagramUrl'] as String?,
      twitterUrl: json['twitterUrl'] as String?,
      linkedinUrl: json['linkedinUrl'] as String?,
      facebookUrl: json['facebookUrl'] as String?,
      tiktokUrl: json['tiktokUrl'] as String?,
      youtubeUrl: json['youtubeUrl'] as String?,
      role: json['role'] as String?,
      planTier: json['planTier'] as String?,
      followersCount: json['followersCount'] as int? ?? 0,
      followingCount: json['followingCount'] as int? ?? 0,
      totalViews: json['totalViews'] as int? ?? 0,
      isPremium: json['isPremium'] as bool? ?? false,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'userId': userId,
      'displayName': displayName,
      'handle': handle,
      'bio': bio,
      'completedAtMillis': completedAtMillis,
      'avatarUrl': avatarUrl,
      'coverUrl': coverUrl,
      'location': location,
      'websiteUrl': websiteUrl,
      'instagramUrl': instagramUrl,
      'twitterUrl': twitterUrl,
      'linkedinUrl': linkedinUrl,
      'facebookUrl': facebookUrl,
      'tiktokUrl': tiktokUrl,
      'youtubeUrl': youtubeUrl,
      'role': role,
      'planTier': planTier,
      'followersCount': followersCount,
      'followingCount': followingCount,
      'totalViews': totalViews,
      'isPremium': isPremium,
    };
  }
}
