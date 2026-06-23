class MessageRecipient {
  const MessageRecipient({
    required this.userId,
    required this.displayName,
    required this.username,
    this.avatarUrl,
  });

  final String userId;
  final String displayName;
  final String username;
  final String? avatarUrl;

  factory MessageRecipient.fromJson(Map<String, Object?> json) {
    final username = json['username']?.toString() ?? '';
    final displayName = json['display_name']?.toString();
    return MessageRecipient(
      userId: json['id'].toString(),
      displayName: displayName == null || displayName.isEmpty
          ? (username.isEmpty ? 'FEEDIN user' : username)
          : displayName,
      username: username,
      avatarUrl: json['avatar_url']?.toString(),
    );
  }
}
