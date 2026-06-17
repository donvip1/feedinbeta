import '../../features/profile/user_profile.dart';

abstract interface class ProfileRepositoryContract {
  Future<UserProfile?> loadCurrentProfile();
  Future<UserProfile?> loadProfileForUser(String userId);
  Future<void> saveCurrentProfile(UserProfile profile);
  Future<void> syncProfile(UserProfile profile);
  Future<void> clearCurrentProfile();
}
