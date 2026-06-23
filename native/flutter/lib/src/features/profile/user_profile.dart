class UserProfile {
  const UserProfile({
    required this.userId,
    required this.displayName,
    required this.handle,
    required this.bio,
    required this.completedAtMillis,
  });

  final String userId;
  final String displayName;
  final String handle;
  final String bio;
  final int completedAtMillis;

  UserProfile copyWith({
    String? displayName,
    String? handle,
    String? bio,
  }) {
    return UserProfile(
      userId: userId,
      displayName: displayName ?? this.displayName,
      handle: handle ?? this.handle,
      bio: bio ?? this.bio,
      completedAtMillis: completedAtMillis,
    );
  }

  factory UserProfile.fromJson(Map<String, Object?> json) {
    return UserProfile(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      handle: json['handle'] as String,
      bio: json['bio'] as String,
      completedAtMillis: json['completedAtMillis'] as int,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'userId': userId,
      'displayName': displayName,
      'handle': handle,
      'bio': bio,
      'completedAtMillis': completedAtMillis,
    };
  }
}
