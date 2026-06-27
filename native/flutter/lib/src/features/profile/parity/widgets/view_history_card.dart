/// "View History" card — recently viewed posts (last 48h).
///
/// Ports the web `ViewHistory.tsx` card: a titled card with a "Last 48h" pill,
/// an optional clear-all trash button, a list of viewed-post rows (avatar,
/// author name + @username, truncated caption, relative time, chevron), and a
/// "Show All / Show Less" expander when there are more than five rows. Shows a
/// loading skeleton and an empty state matching the web copy.
///
/// Pure presentational: it renders a [ViewHistoryView] and forwards taps via
/// [onOpenPost] / [onClear]. All data loading and clearing is the host's job —
/// no Supabase / repo access here.
///
/// Web parity references:
///   - src/components/profile/ViewHistory.tsx (header, pill, rows, expander,
///     empty + skeleton, truncate-to-80, formatDistanceToNow)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';
import 'profile_avatar.dart';

/// Web `truncateText` cap before the caption is ellipsised.
const int _captionMaxLength = 80;

/// The View History card. Stateful only for the expand/collapse toggle.
class ViewHistoryCard extends StatefulWidget {
  const ViewHistoryCard({
    super.key,
    required this.view,
    required this.onOpenPost,
    this.onClear,
  });

  final ViewHistoryView view;

  /// Called with the tapped row's post id.
  final ValueChanged<String> onOpenPost;

  /// Clear-all handler; the trash button is hidden when null or when
  /// [ViewHistoryView.canClear] is false.
  final VoidCallback? onClear;

  @override
  State<ViewHistoryCard> createState() => _ViewHistoryCardState();
}

class _ViewHistoryCardState extends State<ViewHistoryCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: ProfileColors.card,
        borderRadius: ProfileRadii.card,
        border: Border.all(color: ProfileColors.border),
      ),
      child: ClipRRect(
        borderRadius: ProfileRadii.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              showClear:
                  view.canClear && !view.isEmpty && widget.onClear != null,
              onClear: widget.onClear,
            ),
            if (view.isLoading)
              const _HistorySkeleton()
            else if (view.isEmpty)
              const _HistoryEmpty()
            else
              _HistoryBody(
                items: view.items,
                expanded: _expanded,
                onOpenPost: widget.onOpenPost,
                onToggleExpanded: () => setState(() => _expanded = !_expanded),
              ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.showClear, this.onClear});

  final bool showClear;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: ProfileColors.border)),
      ),
      padding: const EdgeInsets.all(ProfileSpacing.lg),
      child: Row(
        children: [
          const Icon(Icons.history, size: 20, color: ProfileColors.primary),
          const SizedBox(width: ProfileSpacing.sm),
          const Text('View History', style: ProfileTextStyles.sectionTitle),
          const SizedBox(width: ProfileSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: ProfileColors.muted,
              borderRadius: ProfileRadii.chip,
            ),
            child: const Text('Last 48h', style: ProfileTextStyles.tinyPill),
          ),
          const Spacer(),
          if (showClear)
            IconButton(
              onPressed: onClear,
              iconSize: 18,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(
                minWidth: ProfileSpacing.tapTarget,
                minHeight: ProfileSpacing.tapTarget,
              ),
              tooltip: 'Clear history',
              icon: const Icon(
                Icons.delete_outline,
                color: ProfileColors.destructive,
              ),
            ),
        ],
      ),
    );
  }
}

class _HistoryBody extends StatelessWidget {
  const _HistoryBody({
    required this.items,
    required this.expanded,
    required this.onOpenPost,
    required this.onToggleExpanded,
  });

  final List<ViewHistoryItemView> items;
  final bool expanded;
  final ValueChanged<String> onOpenPost;
  final VoidCallback onToggleExpanded;

  @override
  Widget build(BuildContext context) {
    // web: collapsed shows first 5; expanded shows all.
    final displayed = expanded ? items : items.take(5).toList();
    final height = expanded
        ? ProfileSpacing.historyExpandedHeight
        : ProfileSpacing.historyCollapsedMaxHeight;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: height),
          child: ListView.separated(
            padding: EdgeInsets.zero,
            shrinkWrap: true,
            itemCount: displayed.length,
            separatorBuilder: (_, _) =>
                const Divider(height: 1, color: ProfileColors.border),
            itemBuilder: (context, index) =>
                _HistoryRow(item: displayed[index], onOpenPost: onOpenPost),
          ),
        ),
        if (items.length > 5)
          DecoratedBox(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: ProfileColors.border)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(ProfileSpacing.md),
              child: TextButton(
                onPressed: onToggleExpanded,
                style: TextButton.styleFrom(
                  foregroundColor: ProfileColors.foreground,
                  minimumSize: const Size.fromHeight(ProfileSpacing.tapTarget),
                ),
                child: Text(
                  expanded ? 'Show Less' : 'Show All (${items.length})',
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.item, required this.onOpenPost});

  final ViewHistoryItemView item;
  final ValueChanged<String> onOpenPost;

  String get _caption {
    final text = item.contentOrFallback;
    if (text.length <= _captionMaxLength) return text;
    return '${text.substring(0, _captionMaxLength)}...';
  }

  @override
  Widget build(BuildContext context) {
    final author = item.author;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onOpenPost(item.postId),
        child: Padding(
          padding: const EdgeInsets.all(ProfileSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileAvatar(
                diameter: 40,
                initial: author?.initial ?? 'U',
                imageUrl: author?.avatarUrl,
              ),
              const SizedBox(width: ProfileSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            author?.nameOrFallback ?? 'Unknown',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ProfileTextStyles.rowName,
                          ),
                        ),
                        const SizedBox(width: ProfileSpacing.sm),
                        Text(
                          '@${author?.usernameOrFallback ?? 'user'}',
                          style: ProfileTextStyles.rowMuted,
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _caption,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: ProfileTextStyles.rowMuted,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.schedule,
                          size: 12,
                          color: ProfileColors.mutedForeground,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          relativeTimeShort(item.viewedAtMillis),
                          style: ProfileTextStyles.tinyPill,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(top: ProfileSpacing.md),
                child: Icon(
                  Icons.chevron_right,
                  size: 16,
                  color: ProfileColors.mutedForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryEmpty extends StatelessWidget {
  const _HistoryEmpty();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(ProfileSpacing.xl + ProfileSpacing.sm),
      child: Column(
        children: [
          Icon(Icons.history, size: 48, color: ProfileColors.mutedForeground),
          SizedBox(height: ProfileSpacing.sm),
          Text(
            'No viewed posts in the last 48 hours',
            textAlign: TextAlign.center,
            style: ProfileTextStyles.emptyTitle,
          ),
        ],
      ),
    );
  }
}

class _HistorySkeleton extends StatelessWidget {
  const _HistorySkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(ProfileSpacing.lg),
      child: Column(
        children: [
          for (var i = 0; i < 3; i++) ...[
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: ProfileColors.muted,
                borderRadius: ProfileRadii.tile,
              ),
            ),
            if (i < 2) const SizedBox(height: ProfileSpacing.md),
          ],
        ],
      ),
    );
  }
}
