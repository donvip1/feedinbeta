import 'dart:async';

import 'package:flutter/material.dart';

import '../app_preferences.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// A single selectable language option.
class _Language {
  const _Language(this.code, this.label, this.nativeLabel);
  final String code;
  final String label;
  final String nativeLabel;
}

/// Appearance & language: theme, reduce-motion, display language.
/// Ports the Dark-Mode toggle (Settings.tsx) + LanguageSettings.tsx list.
///
/// These are device preferences stored in [AppPreferences]. The dark-mode
/// toggle is persisted but does NOT re-theme the app here — theming is owned by
/// app/, which this feature must not modify (flagged as an integration gap).
class AppearanceLanguageScreen extends StatefulWidget {
  const AppearanceLanguageScreen({
    super.key,
    required this.preferences,
    required this.onChanged,
  });

  final AppPreferences preferences;
  final Future<void> Function(AppPreferences) onChanged;

  @override
  State<AppearanceLanguageScreen> createState() =>
      _AppearanceLanguageScreenState();
}

class _AppearanceLanguageScreenState extends State<AppearanceLanguageScreen> {
  late AppPreferences _prefs = widget.preferences;

  static const _languages = <_Language>[
    _Language('en', 'English', 'English'),
    _Language('es', 'Spanish', 'Español'),
    _Language('fr', 'French', 'Français'),
    _Language('pt', 'Portuguese', 'Português'),
    _Language('ar', 'Arabic', 'العربية'),
    _Language('hi', 'Hindi', 'हिन्दी'),
    _Language('sw', 'Swahili', 'Kiswahili'),
    _Language('zh', 'Chinese', '中文'),
  ];

  Future<void> _update(AppPreferences next) async {
    setState(() => _prefs = next);
    await widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Appearance & language',
      icon: Icons.palette_outlined,
      accent: const Color(0xFF14B8A6),
      children: [
        SettingsCard(
          icon: Icons.dark_mode_outlined,
          title: 'Appearance',
          description: 'Theme and motion for this device.',
          children: [
            const SettingsDivider(),
            SettingsToggleRow(
              icon: _prefs.darkMode
                  ? Icons.dark_mode_outlined
                  : Icons.light_mode_outlined,
              title: 'Dark mode',
              description: 'Use the dark theme',
              value: _prefs.darkMode,
              onChanged: (v) => unawaited(_update(_prefs.copyWith(darkMode: v))),
            ),
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.animation,
              title: 'Reduce motion',
              description: 'Minimise animations and transitions',
              value: _prefs.reduceMotion,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(reduceMotion: v)),
              ),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.language,
          title: 'Language',
          description: 'Choose your display language.',
          children: [
            for (final lang in _languages) ...[
              const SettingsDivider(),
              _LanguageRow(
                language: lang,
                selected: _prefs.language == lang.code,
                onTap: () => unawaited(
                  _update(_prefs.copyWith(language: lang.code)),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        const SettingsStatusBanner(
          icon: Icons.info_outline,
          message:
              'Theme and language are saved on this device. Applying them app-'
              'wide requires wiring these preferences into app/ theming and '
              'localization (owned outside this feature).',
          tone: SettingsBannerTone.neutral,
        ),
      ],
    );
  }
}

class _LanguageRow extends StatelessWidget {
  const _LanguageRow({
    required this.language,
    required this.selected,
    required this.onTap,
  });

  final _Language language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: SettingsSpacing.lg,
            vertical: SettingsSpacing.md,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(language.label, style: SettingsTextStyles.rowTitle),
                    const SizedBox(height: SettingsSpacing.xs),
                    Text(
                      language.nativeLabel,
                      style: SettingsTextStyles.rowDescription,
                    ),
                  ],
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_circle,
                  size: 20,
                  color: SettingsColors.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
