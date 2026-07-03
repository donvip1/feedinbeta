import 'package:flutter/material.dart';

import '../../contacts/data/privacy_settings_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Static metadata for one privacy row (which column + copy + icon).
class _PrivacyRow {
  const _PrivacyRow(this.column, this.icon, this.title, this.description);
  final String column;
  final IconData icon;
  final String title;
  final String description;
}

/// WhatsApp-style contact privacy: four rows (Last seen, Profile photo, Status,
/// About), each choosing Everyone / My friends / Nobody. Reads the four
/// `privacy_*` columns off the current user's profile and saves each change
/// immediately via [PrivacySettingsDataSource].
///
/// Mirrors the other settings sub-screens (loading + error states, saved via a
/// live data source that degrades gracefully offline).
class ContactPrivacyScreen extends StatefulWidget {
  const ContactPrivacyScreen({super.key, this.dataSource});

  final PrivacySettingsDataSource? dataSource;

  @override
  State<ContactPrivacyScreen> createState() => _ContactPrivacyScreenState();
}

class _ContactPrivacyScreenState extends State<ContactPrivacyScreen> {
  late final PrivacySettingsDataSource _source;

  ContactPrivacySettings _settings = ContactPrivacySettings.defaults;
  bool _loading = true;
  bool _failed = false;

  static const _rows = <_PrivacyRow>[
    _PrivacyRow(
      ContactPrivacySettings.colLastSeen,
      Icons.schedule_outlined,
      'Last seen',
      'Who can see when you were last online',
    ),
    _PrivacyRow(
      ContactPrivacySettings.colPhoto,
      Icons.account_circle_outlined,
      'Profile photo',
      'Who can see your profile picture',
    ),
    _PrivacyRow(
      ContactPrivacySettings.colStatus,
      Icons.bolt_outlined,
      'Status',
      'Who can see your online status',
    ),
    _PrivacyRow(
      ContactPrivacySettings.colAbout,
      Icons.info_outline,
      'About',
      'Who can see your about / bio info',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _source = widget.dataSource ?? PrivacySettingsDataSource.autoDetect();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final settings = await _source.load();
      if (!mounted) return;
      setState(() {
        _settings = settings;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  ContactPrivacyVisibility _valueOf(String column) {
    return switch (column) {
      ContactPrivacySettings.colLastSeen => _settings.lastSeen,
      ContactPrivacySettings.colPhoto => _settings.photo,
      ContactPrivacySettings.colStatus => _settings.status,
      ContactPrivacySettings.colAbout => _settings.about,
      _ => ContactPrivacyVisibility.friends,
    };
  }

  Future<void> _setColumn(
    String column,
    ContactPrivacyVisibility next,
  ) async {
    final previous = _valueOf(column);
    if (previous == next) return;

    // Optimistic update.
    setState(() => _settings = _apply(column, next));

    try {
      await _source.updateColumn(column, next);
    } catch (error) {
      if (!mounted) return;
      setState(() => _settings = _apply(column, previous));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save. Try again.')),
      );
    }
  }

  ContactPrivacySettings _apply(String column, ContactPrivacyVisibility v) {
    return switch (column) {
      ContactPrivacySettings.colLastSeen => _settings.copyWith(lastSeen: v),
      ContactPrivacySettings.colPhoto => _settings.copyWith(photo: v),
      ContactPrivacySettings.colStatus => _settings.copyWith(status: v),
      ContactPrivacySettings.colAbout => _settings.copyWith(about: v),
      _ => _settings,
    };
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Contact privacy',
      icon: Icons.lock_outline,
      accent: SettingsColors.primary,
      children: [
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: SettingsSpacing.xl),
            child: LinearProgressIndicator(
              color: SettingsColors.primary,
              backgroundColor: SettingsColors.muted,
            ),
          )
        else if (_failed)
          SettingsCard(
            icon: Icons.error_outline,
            title: 'Couldn\'t load privacy settings',
            description: 'Check your connection and try again.',
            accent: SettingsColors.destructive,
            children: [
              const SettingsDivider(),
              Padding(
                padding: const EdgeInsets.all(SettingsSpacing.lg),
                child: SettingsActionButton(
                  label: 'Retry',
                  icon: Icons.refresh,
                  expanded: true,
                  onPressed: _load,
                ),
              ),
            ],
          )
        else ...[
          SettingsCard(
            icon: Icons.visibility_outlined,
            title: 'Who can see',
            description: 'Control who can see your activity and profile info. '
                'Applies to everyone unless limited to your friends.',
            children: [
              for (final row in _rows) ...[
                const SettingsDivider(),
                _PrivacyChoiceRow(
                  icon: row.icon,
                  title: row.title,
                  description: row.description,
                  value: _valueOf(row.column),
                  onChanged: (v) => _setColumn(row.column, v),
                ),
              ],
            ],
          ),
          const SizedBox(height: SettingsSpacing.lg),
          SettingsStatusBanner(
            icon: _source.isLive ? Icons.cloud_done_outlined : Icons.cloud_off,
            message: _source.isLive
                ? 'Saved to your account and synced across devices.'
                : 'Sign in to sync your privacy settings to your account.',
            tone: _source.isLive
                ? SettingsBannerTone.online
                : SettingsBannerTone.offline,
          ),
        ],
      ],
    );
  }
}

/// A single privacy row: tinted icon bubble + title/description + a three-way
/// segmented control (Everyone / My friends / Nobody).
class _PrivacyChoiceRow extends StatelessWidget {
  const _PrivacyChoiceRow({
    required this.icon,
    required this.title,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final String description;
  final ContactPrivacyVisibility value;
  final ValueChanged<ContactPrivacyVisibility> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.lg,
        vertical: SettingsSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: SettingsSpacing.iconBubble,
                height: SettingsSpacing.iconBubble,
                decoration: const BoxDecoration(
                  color: SettingsColors.iconBubble,
                  borderRadius: SettingsRadii.tile,
                ),
                alignment: Alignment.center,
                child: Icon(
                  icon,
                  size: 18,
                  color: SettingsColors.mutedForeground,
                ),
              ),
              const SizedBox(width: SettingsSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: SettingsTextStyles.rowTitle),
                    const SizedBox(height: SettingsSpacing.xs),
                    Text(description, style: SettingsTextStyles.rowDescription),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SettingsSpacing.md),
          _Segmented(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

/// A three-way segmented control over [ContactPrivacyVisibility].
class _Segmented extends StatelessWidget {
  const _Segmented({required this.value, required this.onChanged});

  final ContactPrivacyVisibility value;
  final ValueChanged<ContactPrivacyVisibility> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SettingsColors.mutedSoft,
        borderRadius: SettingsRadii.tile,
        border: Border.all(color: SettingsColors.border),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        children: [
          for (final option in ContactPrivacyVisibility.values)
            Expanded(
              child: _SegmentButton(
                label: option.label,
                selected: option == value,
                onTap: () => onChanged(option),
              ),
            ),
        ],
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: SettingsRadii.tile,
      child: InkWell(
        onTap: onTap,
        borderRadius: SettingsRadii.tile,
        child: Container(
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: selected ? SettingsGradients.primary : null,
            borderRadius: SettingsRadii.tile,
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected
                  ? SettingsColors.primaryForeground
                  : SettingsColors.mutedForeground,
            ),
          ),
        ),
      ),
    );
  }
}
