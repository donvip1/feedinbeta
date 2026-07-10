/// Modern profile header: cover banner, overlapping avatar with an online
/// status ring, identity block (name + verified/role/plan badges, @handle, bio,
/// meta row with location + website) and the primary action row (Edit Profile +
/// settings gear).
///
/// Pure presentational: it reads a [UserProfile] and forwards taps via
/// callbacks. It reuses the parity primitives ([ProfileAvatar],
/// [RolePlanBadges], the presenter's badge resolution) and the shared design
/// tokens so it matches the rest of the profile surface and the brand pink.
///
/// The cover falls back to [ProfileGradients.coverPlaceholder] when the profile
/// has no `coverUrl`; the avatar falls back to gradient initials via
/// [ProfileAvatar]. Tapping the cover or avatar (when an image exists) opens the
/// full-screen [ProfileImageViewer].
library;

import 'package:flutter/material.dart';

import '../parity/profile_presenter.dart';
import '../parity/profile_tokens.dart';
import '../parity/widgets/image_viewer.dart';
import '../parity/widgets/profile_avatar.dart';
import '../parity/widgets/role_plan_badges.dart';
import '../user_profile.dart';
import 'profile_badge.dart';

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({
    super.key,
    required this.profile,
    required this.onEditProfile,
    required this.onOpenSettings,
    required this.onOpenLink,
    this.onChangeAvatar,
    this.onChangeCover,
    this.isOnline = true,
  });

  final UserProfile profile;

  /// Opens the existing profile editor.
  final VoidCallback onEditProfile;

  /// Opens app settings (wired by the coordinator).
  final VoidCallback onOpenSettings;

  /// Opens (or copies) an external URL — used by the website meta pill.
  final ValueChanged<String> onOpenLink;

  /// Upload/change actions for the viewer's own profile images.
  final VoidCallback? onChangeAvatar;
  final VoidCallback? onChangeCover;

  /// Drives the avatar online-status dot.
  final bool isOnline;

  String get _initial {
    final name = profile.displayName.trim();
    if (name.isEmpty) return 'U';
    return name.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    const avatarRing =
        ProfileSpacing.avatarDiameter + ProfileSpacing.avatarBorderWidth * 2;
    const avatarTop = ProfileSpacing.coverHeight - ProfileSpacing.avatarOverlap;
    const bandHeight = avatarTop + avatarRing;

    final coverUrl = profile.coverUrl?.trim() ?? '';
    final hasCover = coverUrl.isNotEmpty;
    final badges = ProfilePresenter.badges(profile);
    final location = profile.location?.trim() ?? '';
    final website = profile.websiteUrl?.trim() ?? '';
    final bio = profile.bio.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // --- Cover band with the avatar overlapping its lower edge. ---
        SizedBox(
          height: bandHeight,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              _Cover(
                coverUrl: hasCover ? coverUrl : null,
                onTap: hasCover
                    ? () => ProfileImageViewer.show(
                          context,
                          imageUrl: coverUrl,
                          initial: _initial,
                          isCircle: false,
                        )
                    : null,
              ),
              Positioned(
                right: ProfileSpacing.sm,
                bottom: ProfileSpacing.avatarOverlap + ProfileSpacing.sm,
                child: _CircleIconButton(
                  icon: Icons.photo_camera_outlined,
                  tooltip: 'Change cover photo',
                  onTap: onChangeCover,
                ),
              ),
              // Settings gear floated top-right over the cover.
              Positioned(
                top: ProfileSpacing.sm,
                right: ProfileSpacing.sm,
                child: _CircleIconButton(
                  icon: Icons.settings_outlined,
                  tooltip: 'Settings',
                  onTap: onOpenSettings,
                ),
              ),
              Positioned(
                top: avatarTop,
                child: _AvatarWithStatus(
                  imageUrl: profile.avatarUrl,
                  initial: _initial,
                  isOnline: isOnline,
                  onChangeImage: onChangeAvatar,
                  onTap: () => ProfileImageViewer.show(
                    context,
                    imageUrl: profile.avatarUrl,
                    initial: _initial,
                    isCircle: true,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: ProfileSpacing.md),
        // --- Identity block. ---
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: ProfileSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      profile.displayName.trim().isEmpty
                          ? 'Unknown'
                          : profile.displayName,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ProfileTextStyles.displayName,
                    ),
                  ),
                  const SizedBox(width: ProfileSpacing.sm),
                  ProfileVerifiedInline(profile: profile),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '@${profile.handle.trim().isEmpty ? 'user' : profile.handle}',
                textAlign: TextAlign.center,
                style: ProfileTextStyles.handle,
              ),
              if (badges.hasRowBadges) ...[
                const SizedBox(height: ProfileSpacing.sm),
                RolePlanBadges(badges: badges),
              ],
              if (bio.isNotEmpty) ...[
                const SizedBox(height: ProfileSpacing.md),
                Text(
                  bio,
                  textAlign: TextAlign.center,
                  style: ProfileTextStyles.bio,
                ),
              ],
              if (location.isNotEmpty || website.isNotEmpty) ...[
                const SizedBox(height: ProfileSpacing.md),
                _MetaRow(
                  location: location,
                  website: website,
                  onOpenLink: onOpenLink,
                ),
              ],
              const SizedBox(height: ProfileSpacing.lg),
              _ActionRow(
                onEditProfile: onEditProfile,
                onOpenSettings: onOpenSettings,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.coverUrl, required this.onTap});

  final String? coverUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        height: ProfileSpacing.coverHeight,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (coverUrl != null)
              Image.network(
                coverUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const _CoverFallback(),
                loadingBuilder: (context, child, progress) =>
                    progress == null ? child : const _CoverFallback(),
              )
            else
              const _CoverFallback(),
            // Bottom fade into the page background so the identity block reads.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00080C16), Color(0xCC080C16)],
                  stops: [0.55, 1.0],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CoverFallback extends StatelessWidget {
  const _CoverFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(gradient: ProfileGradients.coverPlaceholder),
    );
  }
}

class _AvatarWithStatus extends StatelessWidget {
  const _AvatarWithStatus({
    required this.imageUrl,
    required this.initial,
    required this.isOnline,
    required this.onTap,
    required this.onChangeImage,
  });

  final String? imageUrl;
  final String initial;
  final bool isOnline;
  final VoidCallback? onTap;
  final VoidCallback? onChangeImage;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(ProfileSpacing.avatarBorderWidth),
        decoration: const BoxDecoration(
          color: ProfileColors.background,
          shape: BoxShape.circle,
          boxShadow: ProfileShadows.avatar,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            ProfileAvatar(
              diameter: ProfileSpacing.avatarDiameter,
              initial: initial,
              imageUrl: imageUrl,
            ),
            Positioned(
              right: 6,
              bottom: 6,
              child: ProfileStatusDot(online: isOnline),
            ),
            Positioned(
              left: -2,
              bottom: -2,
              child: _MiniCameraButton(onTap: onChangeImage),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniCameraButton extends StatelessWidget {
  const _MiniCameraButton({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Ink(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ProfileColors.card,
            border: Border.all(color: ProfileColors.background, width: 2),
            boxShadow: ProfileShadows.avatar,
          ),
          child: Icon(
            Icons.photo_camera_outlined,
            size: 17,
            color: onTap == null
                ? ProfileColors.mutedForeground
                : ProfileColors.foreground,
          ),
        ),
      ),
    );
  }
}

/// Location + website meta pills below the bio.
class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.location,
    required this.website,
    required this.onOpenLink,
  });

  final String location;
  final String website;
  final ValueChanged<String> onOpenLink;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: ProfileSpacing.lg,
      runSpacing: ProfileSpacing.xs,
      children: [
        if (location.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.location_on_outlined,
                size: 15,
                color: ProfileColors.mutedForeground,
              ),
              const SizedBox(width: 4),
              Text(location, style: ProfileTextStyles.meta),
            ],
          ),
        if (website.isNotEmpty)
          Material(
            color: Colors.transparent,
            borderRadius: ProfileRadii.chip,
            child: InkWell(
              onTap: () => onOpenLink(website),
              borderRadius: ProfileRadii.chip,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.link,
                    size: 15,
                    color: ProfileColors.primary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _displayHost(website),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: ProfileColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  static String _displayHost(String url) {
    var value = url.trim();
    value = value.replaceFirst(RegExp(r'^https?://'), '');
    value = value.replaceFirst(RegExp(r'^www\.'), '');
    if (value.endsWith('/')) value = value.substring(0, value.length - 1);
    return value;
  }
}

/// Primary actions: a wide gradient "Edit Profile" button plus a settings gear.
class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.onEditProfile, required this.onOpenSettings});

  final VoidCallback onEditProfile;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Material(
            color: Colors.transparent,
            borderRadius: ProfileRadii.tile,
            child: InkWell(
              onTap: onEditProfile,
              borderRadius: ProfileRadii.tile,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: ProfileGradients.action,
                  borderRadius: ProfileRadii.tile,
                ),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.edit_outlined,
                        size: 18,
                        color: ProfileColors.primaryForeground,
                      ),
                      SizedBox(width: ProfileSpacing.sm),
                      Text(
                        'Edit Profile',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: ProfileColors.primaryForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: ProfileSpacing.md),
        _CircleIconButton(
          icon: Icons.settings_outlined,
          tooltip: 'Settings',
          onTap: onOpenSettings,
          filled: true,
        ),
      ],
    );
  }
}

/// A round translucent icon button used over the cover and in the action row.
class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  /// When true the button uses the solid card surface (action row); otherwise a
  /// dark translucent scrim (floating over the cover).
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? ProfileColors.secondary : ProfileColors.tileBadgeScrim,
      shape: const CircleBorder(
        side: BorderSide(color: ProfileColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(
              icon,
              size: 22,
              color: onTap == null
                  ? ProfileColors.mutedForeground
                  : ProfileColors.foreground,
            ),
          ),
        ),
      ),
    );
  }
}
