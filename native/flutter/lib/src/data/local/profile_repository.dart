import 'dart:io';

import 'package:hive_ce/hive.dart';

import '../remote/profile_remote_data_source.dart';
import '../../features/profile/user_profile.dart';
import 'profile_repository_contract.dart';

class ProfileRepository implements ProfileRepositoryContract {
  ProfileRepository({
    required Box<Map> box,
    required ProfileRemoteDataSource remoteDataSource,
  }) : _box = box,
       _remoteDataSource = remoteDataSource;

  static const _currentProfileKey = 'current';

  final Box<Map> _box;
  final ProfileRemoteDataSource _remoteDataSource;

  @override
  Future<UserProfile?> loadCurrentProfile() async {
    final raw = _box.get(_currentProfileKey);
    if (raw == null) return null;
    return UserProfile.fromJson(Map<String, Object?>.from(raw));
  }

  @override
  Future<UserProfile?> loadProfileForUser(String userId) async {
    final local = await loadCurrentProfile();
    if (local?.userId == userId) return local;

    final remote = await _remoteDataSource.fetchProfile(userId);
    if (remote != null) {
      await saveCurrentProfile(remote);
    }
    return remote;
  }

  @override
  Future<void> saveCurrentProfile(UserProfile profile) async {
    await _box.put(_currentProfileKey, profile.toJson());
  }

  @override
  Future<void> syncProfile(UserProfile profile) async {
    await saveCurrentProfile(profile);
    await _remoteDataSource.upsertProfile(profile);
  }

  @override
  Future<UserProfile> uploadProfileImage({
    required UserProfile profile,
    required ProfileImageSlot slot,
    required File file,
  }) async {
    final updated = await _remoteDataSource.uploadProfileImage(
      profile: profile,
      slot: slot,
      file: file,
    );
    await saveCurrentProfile(updated);
    return updated;
  }

  @override
  Future<void> clearCurrentProfile() async {
    await _box.delete(_currentProfileKey);
  }
}
