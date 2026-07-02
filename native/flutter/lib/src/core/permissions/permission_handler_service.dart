import 'dart:io' show Platform;

// device_info_plus reads the Android SDK level for the photos-vs-storage split.
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

import 'permission_service.dart';

/// The production [PermissionService], backed by the `permission_handler`
/// plugin. This is the only file in the onboarding stack that touches a
/// platform channel, which is what keeps [PermissionService], the flow
/// controller and their tests plugin-free.
///
/// Two platform subtleties are handled here:
///   * Android photos-vs-storage: [AppPermission.photosOrStorage] resolves to
///     [Permission.photos] (READ_MEDIA_IMAGES) on Android 33+ and
///     [Permission.storage] (READ_EXTERNAL_STORAGE) below, using the device's
///     SDK level (cached after first read).
///   * The plugin's six-value [PermissionStatus] is collapsed into the smaller
///     [PermissionResult] the rest of the app reasons about.
class PermissionHandlerService implements PermissionService {
  PermissionHandlerService({DeviceInfoPlugin? deviceInfo})
      : _deviceInfo = deviceInfo ?? DeviceInfoPlugin();

  final DeviceInfoPlugin _deviceInfo;

  /// Cached Android API level; resolved lazily and only once.
  int? _androidSdkInt;

  @override
  Future<PermissionResult> request(AppPermission permission) async {
    try {
      final resolved = await _resolve(permission);
      final status = await resolved.request();
      return _map(status);
    } catch (error, stack) {
      // A missing plugin registration, a platform exception, or an unsupported
      // platform should degrade gracefully rather than crash onboarding.
      debugPrint('PermissionHandlerService.request($permission) failed: $error');
      debugPrintStack(stackTrace: stack);
      return PermissionResult.denied;
    }
  }

  @override
  Future<PermissionResult> status(AppPermission permission) async {
    try {
      final resolved = await _resolve(permission);
      return _map(await resolved.status);
    } catch (error) {
      debugPrint('PermissionHandlerService.status($permission) failed: $error');
      return PermissionResult.denied;
    }
  }

  @override
  Future<bool> openSettings() async {
    try {
      return await openAppSettings();
    } catch (error) {
      debugPrint('PermissionHandlerService.openSettings failed: $error');
      return false;
    }
  }

  /// Maps an [AppPermission] to the concrete plugin [Permission], applying the
  /// Android photos/storage split.
  Future<Permission> _resolve(AppPermission permission) async {
    switch (permission) {
      case AppPermission.notifications:
        return Permission.notification;
      case AppPermission.microphone:
        return Permission.microphone;
      case AppPermission.camera:
        return Permission.camera;
      case AppPermission.contacts:
        return Permission.contacts;
      case AppPermission.photosOrStorage:
        if (Platform.isAndroid && await _sdkInt() < 33) {
          return Permission.storage;
        }
        return Permission.photos;
    }
  }

  Future<int> _sdkInt() async {
    final cached = _androidSdkInt;
    if (cached != null) return cached;
    final info = await _deviceInfo.androidInfo;
    return _androidSdkInt = info.version.sdkInt;
  }

  PermissionResult _map(PermissionStatus status) {
    if (status.isGranted) return PermissionResult.granted;
    if (status.isLimited) return PermissionResult.limited;
    if (status.isProvisional) return PermissionResult.provisional;
    if (status.isPermanentlyDenied) return PermissionResult.permanentlyDenied;
    if (status.isRestricted) return PermissionResult.restricted;
    return PermissionResult.denied;
  }
}
