import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Help, About and legal links. Ports the "Help & Legal" group + About card
/// from src/pages/Settings.tsx.
///
/// The web routes these to in-app policy pages; the native app has no legal
/// content screens yet, so each link copies the corresponding web URL to the
/// clipboard and flags that the destination pages aren't wired natively.
class HelpAboutScreen extends StatelessWidget {
  const HelpAboutScreen({super.key, this.appVersion = '1.0.0'});

  final String appVersion;

  void _copyLink(BuildContext context, String label, String url) {
    unawaited(Clipboard.setData(ClipboardData(text: url)));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label link copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Help & about',
      icon: Icons.help_outline,
      accent: const Color(0xFF06B6D4),
      children: [
        SettingsCard(
          icon: Icons.support_agent_outlined,
          title: 'Support',
          description: 'Get help and answers.',
          children: [
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.help_outline,
              title: 'Help & support',
              description: 'FAQ and contact',
              onTap: () => _copyLink(
                context,
                'Help',
                'https://feedin.app/settings/help',
              ),
            ),
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.report_outlined,
              title: 'Report a problem',
              description: 'Tell us what went wrong',
              onTap: () => _copyLink(
                context,
                'Support',
                'https://feedin.app/settings/help',
              ),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.gavel_outlined,
          title: 'Legal',
          description: 'Policies and guidelines.',
          children: [
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.description_outlined,
              title: 'Terms of Service',
              onTap: () => _copyLink(
                context,
                'Terms',
                'https://feedin.app/settings/about?section=terms',
              ),
            ),
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy Policy',
              onTap: () => _copyLink(
                context,
                'Privacy Policy',
                'https://feedin.app/settings/about?section=privacy',
              ),
            ),
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.groups_outlined,
              title: 'Community Guidelines',
              onTap: () => _copyLink(
                context,
                'Community Guidelines',
                'https://feedin.app/settings/about?section=community',
              ),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.info_outline,
          title: 'About FeedIn',
          children: [
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.tag,
              title: 'Version',
              onTap: () {},
              trailing: SettingsCountPill(label: appVersion),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        const SettingsStatusBanner(
          icon: Icons.info_outline,
          message:
              'Legal and help pages open on the web. Native in-app policy '
              'screens aren\'t implemented yet.',
          tone: SettingsBannerTone.neutral,
        ),
      ],
    );
  }
}
