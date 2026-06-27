/// Grouped notification-preferences toggle list for the Notifications parity
/// rebuild.
///
/// Merges the two web references:
///   - src/components/notifications/NotificationPreferences.tsx
///       (compact toggle list + gradient 'Save Preferences' button)
///   - src/components/notifications/NotificationSettings.tsx
///       (grouped-category layout)
///
/// Live / gifts groups are already excluded by the view-model defaults
/// (`NotificationPreferencesViewModel.defaults()`), so this widget renders
/// whatever groups it is handed without any monetization/live surface.
///
/// Pure presentational: it takes a [NotificationPreferencesViewModel] plus
/// callbacks and never mutates state, persists, or shows toasts — the host owns
/// all of that. Styling comes ONLY from the screen-local token classes; imports
/// are limited to the Flutter SDK and the two foundation files.
library;

import 'package:flutter/material.dart';

import '../notifications_tokens.dart';
import '../notifications_view_models.dart';

/// A scrollable, grouped list of notification preference toggles.
///
/// States covered:
///   - loading  -> centered primary spinner
///   - normal   -> quick actions (optional) + grouped cards + Save (optional)
///   - saving   -> Save button shows 'Saving...' + spinner, disabled
///   - locked   -> individual rows dimmed (Opacity 0.5) with a disabled Switch
class NotificationPreferencesList extends StatelessWidget {
  const NotificationPreferencesList({
    super.key,
    required this.viewModel,
    required this.onToggle,
    this.onEnableAll,
    this.onDisableAll,
    this.onSave,
  });

  /// The full preferences state (groups + loading/saving flags).
  final NotificationPreferencesViewModel viewModel;

  /// Fired when a row's switch flips. Host owns the state mutation.
  final void Function(String key, bool value) onToggle;

  /// Optional 'Enable All' quick action. Quick-actions row is hidden when both
  /// [onEnableAll] and [onDisableAll] are null.
  final VoidCallback? onEnableAll;

  /// Optional 'Disable All' quick action.
  final VoidCallback? onDisableAll;

  /// Optional Save handler. The gradient Save button is hidden when null.
  final VoidCallback? onSave;

  bool get _showQuickActions => onEnableAll != null || onDisableAll != null;

  @override
  Widget build(BuildContext context) {
    if (viewModel.isLoading) {
      return const Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            valueColor: AlwaysStoppedAnimation<Color>(
              NotificationColors.primary,
            ),
          ),
        ),
      );
    }

    final children = <Widget>[];

    if (_showQuickActions) {
      children.add(
        _QuickActionsRow(onEnableAll: onEnableAll, onDisableAll: onDisableAll),
      );
      children.add(const SizedBox(height: NotificationSpacing.lg));
    }

    for (var i = 0; i < viewModel.groups.length; i++) {
      if (i > 0) {
        children.add(const SizedBox(height: NotificationSpacing.lg));
      }
      children.add(
        _PreferenceGroupCard(group: viewModel.groups[i], onToggle: onToggle),
      );
    }

    if (onSave != null) {
      children.add(const SizedBox(height: NotificationSpacing.xl));
      children.add(_SaveButton(isSaving: viewModel.isSaving, onSave: onSave));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(NotificationSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }
}

/// The optional 'Enable All' / 'Disable All' outlined-button row.
class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({this.onEnableAll, this.onDisableAll});

  final VoidCallback? onEnableAll;
  final VoidCallback? onDisableAll;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _OutlinedAction(label: 'Enable All', onPressed: onEnableAll),
        ),
        const SizedBox(width: NotificationSpacing.md),
        Expanded(
          child: _OutlinedAction(label: 'Disable All', onPressed: onDisableAll),
        ),
      ],
    );
  }
}

/// A single bordered text action used by the quick-actions row.
class _OutlinedAction extends StatelessWidget {
  const _OutlinedAction({required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: NotificationColors.foreground,
        disabledForegroundColor: NotificationColors.mutedForeground.withValues(
          alpha: 0.5,
        ),
        side: const BorderSide(color: NotificationColors.border),
        padding: const EdgeInsets.symmetric(
          vertical: NotificationSpacing.md,
          horizontal: NotificationSpacing.lg,
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: NotificationRadii.tile,
        ),
        textStyle: NotificationTextStyles.filterTab,
      ),
      child: Text(label),
    );
  }
}

/// One grouped preference card: a titled card holding divider-separated rows.
class _PreferenceGroupCard extends StatelessWidget {
  const _PreferenceGroupCard({required this.group, required this.onToggle});

  final PreferenceGroupViewModel group;
  final void Function(String key, bool value) onToggle;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < group.items.length; i++) {
      if (i > 0) {
        rows.add(
          const Divider(
            height: 1,
            thickness: 1,
            color: NotificationColors.border,
          ),
        );
      }
      rows.add(_PreferenceRow(item: group.items[i], onToggle: onToggle));
    }

    return Container(
      decoration: BoxDecoration(
        color: NotificationColors.card,
        borderRadius: NotificationRadii.card,
        border: Border.all(color: NotificationColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(NotificationSpacing.lg),
            child: Text(
              group.title.toUpperCase(),
              style: NotificationTextStyles.sectionLabel,
            ),
          ),
          const Divider(
            height: 1,
            thickness: 1,
            color: NotificationColors.border,
          ),
          ...rows,
        ],
      ),
    );
  }
}

/// A single preference toggle row: tinted type icon + title/description + Switch.
///
/// When [PreferenceItemViewModel.locked] is true the whole row is dimmed to
/// 50% opacity and the switch's onChanged is null (disabled).
class _PreferenceRow extends StatelessWidget {
  const _PreferenceRow({required this.item, required this.onToggle});

  final PreferenceItemViewModel item;
  final void Function(String key, bool value) onToggle;

  @override
  Widget build(BuildContext context) {
    final token = _tokenForKind(item.kind);
    final accent = NotificationTypePalette.accentFor(token);

    final row = Padding(
      padding: const EdgeInsets.all(NotificationSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: NotificationTypePalette.iconBubbleFor(token),
              borderRadius: NotificationRadii.tile,
            ),
            alignment: Alignment.center,
            child: Icon(
              NotificationTypePalette.iconFor(token),
              size: 20,
              color: accent,
            ),
          ),
          const SizedBox(width: NotificationSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(item.title, style: NotificationTextStyles.prefTitle),
                const SizedBox(height: NotificationSpacing.xs),
                Text(
                  item.description,
                  style: NotificationTextStyles.prefDescription,
                ),
              ],
            ),
          ),
          const SizedBox(width: NotificationSpacing.md),
          Switch(
            value: item.enabled,
            // `activeColor` is deprecated post-3.31; `activeThumbColor` is the
            // current spelling for the same web `--primary` accent.
            activeThumbColor: NotificationColors.primary,
            activeTrackColor: NotificationColors.primary.withValues(
              alpha: 0.45,
            ),
            inactiveThumbColor: NotificationColors.mutedForeground,
            inactiveTrackColor: NotificationColors.muted,
            onChanged: item.locked
                ? null
                : (value) => onToggle(item.key, value),
          ),
        ],
      ),
    );

    if (item.locked) {
      return Opacity(opacity: 0.5, child: row);
    }
    return row;
  }
}

/// Full-width gradient 'Save Preferences' button with a disabled saving state.
class _SaveButton extends StatelessWidget {
  const _SaveButton({required this.isSaving, this.onSave});

  final bool isSaving;
  final VoidCallback? onSave;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: isSaving ? 0.7 : 1,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: NotificationGradients.saveAction,
          borderRadius: NotificationRadii.tile,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: NotificationRadii.tile,
            onTap: isSaving ? null : onSave,
            child: Container(
              height: NotificationSpacing.tapTarget + NotificationSpacing.sm,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(
                horizontal: NotificationSpacing.lg,
              ),
              child: isSaving
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              NotificationColors.primaryForeground,
                            ),
                          ),
                        ),
                        const SizedBox(width: NotificationSpacing.sm),
                        Text(
                          'Saving...',
                          style: NotificationTextStyles.saveButton,
                        ),
                      ],
                    )
                  : Text(
                      'Save Preferences',
                      style: NotificationTextStyles.saveButton,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Maps a presentational [NotificationKind] (view-model layer) to the
/// token-layer [NotificationKindToken] used by the per-type icon/color palette.
///
/// The two enums intentionally share names and order; matching by `name` keeps
/// the mapping resilient if either enum is reordered and avoids importing one
/// file into the other.
NotificationKindToken _tokenForKind(NotificationKind kind) {
  switch (kind) {
    case NotificationKind.like:
      return NotificationKindToken.like;
    case NotificationKind.comment:
      return NotificationKindToken.comment;
    case NotificationKind.reply:
      return NotificationKindToken.reply;
    case NotificationKind.mention:
      return NotificationKindToken.mention;
    case NotificationKind.follow:
      return NotificationKindToken.follow;
    case NotificationKind.message:
      return NotificationKindToken.message;
    case NotificationKind.friendRequest:
      return NotificationKindToken.friendRequest;
    case NotificationKind.friendRequestAccepted:
      return NotificationKindToken.friendRequestAccepted;
    case NotificationKind.story:
      return NotificationKindToken.story;
    case NotificationKind.badge:
      return NotificationKindToken.badge;
    case NotificationKind.system:
      return NotificationKindToken.system;
  }
}
