import 'dart:io';

import '../../features/profile/user_profile.dart';

enum ProfileImageSlot { avatar, cover }

abstract interface class ProfileRepositoryContract {
  Future<UserProfile?> loadCurrentProfile();
  Future<UserProfile?> loadProfileForUser(String userId);
  Future<void> saveCurrentProfile(UserProfile profile);
  Future<void> syncProfile(UserProfile profile);
  Future<UserProfile> uploadProfileImage({
    required UserProfile profile,
    required ProfileImageSlot slot,
    required File file,
  });
  Future<void> clearCurrentProfile();
}
