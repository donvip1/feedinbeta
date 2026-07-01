import 'package:flutter/material.dart';

import '../settings_theme.dart';

/// Shared chrome for every pushed settings sub-screen: a dark background, a
/// slim back-button header (web sticky header parity) and a scrolling body.
///
/// Keeps the sub-screens visually consistent with the main Settings tab and
/// avoids each screen re-implementing the same Scaffold/AppBar.
class SettingsSubScaffold extends StatelessWidget {
  const SettingsSubScaffold({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
    this.accent = SettingsColors.primary,
    this.footer,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;
  final Color accent;

  /// Optional pinned footer (e.g. a Save button) shown above the safe area.
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final footer = this.footer;
    return Scaffold(
      backgroundColor: SettingsColors.background,
      appBar: AppBar(
        backgroundColor: SettingsColors.card,
        surfaceTintColor: SettingsColors.card,
        elevation: 0,
        iconTheme: const IconThemeData(color: SettingsColors.foreground),
        title: Row(
          children: [
            Icon(icon, size: 20, color: accent),
            const SizedBox(width: SettingsSpacing.sm),
            Text(
              title,
              style: SettingsTextStyles.cardTitle.copyWith(fontSize: 18),
            ),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SettingsSpacing.lg,
            SettingsSpacing.lg,
            SettingsSpacing.lg,
            SettingsSpacing.xl,
          ),
          children: children,
        ),
      ),
      bottomNavigationBar: footer == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(
                SettingsSpacing.lg,
                SettingsSpacing.sm,
                SettingsSpacing.lg,
                SettingsSpacing.md,
              ),
              child: footer,
            ),
    );
  }
}
