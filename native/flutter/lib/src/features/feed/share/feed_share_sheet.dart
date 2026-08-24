import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../immersive/feed_immersive_theme.dart';
import 'feed_share_actions.dart';

/// Web-parity share drawer for the immersive feed, mirroring
/// `src/components/feed/MobileShareSheet.tsx`:
///
///  * a quick-share row — Story · Friends · Groups · More;
///  * a divider, then Copy Link · Save Post · Download;
///  * Friends / Groups open searchable sub-views.
///
/// All behaviour is delegated to [FeedShareActions] so this widget stays
/// presentational and testable. Resolves to an optional status message the
/// caller can surface in the feed's status banner.
Future<String?> showFeedShareDrawer(
  BuildContext context, {
  required FeedShareActions actions,
}) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: FeedImmersiveTheme.surface,
    barrierColor: FeedImmersiveTheme.sheetBarrier,
    useSafeArea: true,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => _FeedShareSheet(actions: actions),
  );
}

enum _ShareView { main, friends, groups }

class _FeedShareSheet extends StatefulWidget {
  const _FeedShareSheet({required this.actions});

  final FeedShareActions actions;

  @override
  State<_FeedShareSheet> createState() => _FeedShareSheetState();
}

class _FeedShareSheetState extends State<_FeedShareSheet> {
  _ShareView _view = _ShareView.main;
  bool _busy = false;
  String? _error;
  late final bool _isSaved = widget.actions.isSaved;

  // Sub-view state.
  final TextEditingController _search = TextEditingController();
  List<ShareTarget> _results = const [];
  bool _loading = false;
  int _searchToken = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _close(String? message) {
    if (!mounted) return;
    Navigator.of(context).pop(message);
  }

  /// Runs a main-view action; closes with [success] or shows an inline error.
  Future<void> _run(Future<void> Function() action, String success) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      _close(success);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _humanize(error);
      });
    }
  }

  Future<void> _toggleSave() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final saved = await widget.actions.toggleSave();
      _close(saved ? 'Saved to your collection.' : 'Removed from saved.');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _humanize(error);
      });
    }
  }

  void _openFriends() {
    setState(() {
      _view = _ShareView.friends;
      _results = const [];
      _error = null;
      _search.clear();
    });
  }

  Future<void> _openGroups() async {
    setState(() {
      _view = _ShareView.groups;
      _error = null;
      _loading = true;
      _results = const [];
      _search.clear();
    });
    try {
      final groups = await widget.actions.loadGroups();
      if (!mounted) return;
      setState(() {
        _results = groups;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _humanize(error);
      });
    }
  }

  Future<void> _onSearchChanged(String query) async {
    if (_view != _ShareView.friends) return; // Groups filter locally.
    final token = ++_searchToken;
    final trimmed = query.trim();
    if (trimmed.length < 2) {
      setState(() {
        _results = const [];
        _loading = false;
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final found = await widget.actions.searchFriends(trimmed);
      if (!mounted || token != _searchToken) return;
      setState(() {
        _results = found;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || token != _searchToken) return;
      setState(() {
        _loading = false;
        _error = _humanize(error);
      });
    }
  }

  List<ShareTarget> get _visibleTargets {
    if (_view == _ShareView.groups) {
      final q = _search.text.trim().toLowerCase();
      if (q.isEmpty) return _results;
      return _results
          .where((t) => t.title.toLowerCase().contains(q))
          .toList(growable: false);
    }
    return _results;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedPadding(
      duration: FeedImmersiveTheme.motionFast,
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: switch (_view) {
        _ShareView.main => _buildMain(),
        _ShareView.friends => _buildTargetList(
          title: 'Send to',
          searchHint: 'Search people…',
          emptyLabel: 'Search for someone to send to',
          onTap: (t) => _run(
            () => widget.actions.sendToFriend(t),
            'Sent to ${t.title}.',
          ),
        ),
        _ShareView.groups => _buildTargetList(
          title: 'Share to group',
          searchHint: 'Search groups…',
          emptyLabel: 'No groups yet',
          onTap: (t) => _run(
            () => widget.actions.sendToGroup(t),
            'Shared to ${t.title}.',
          ),
        ),
      },
    );
  }

  Widget _buildMain() {
    final actions = widget.actions;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 10, 0, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _Grabber(),
          const SizedBox(height: 14),
          // Quick-share destinations.
          SizedBox(
            height: 92,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                if (actions.hasMedia)
                  _QuickAction(
                    key: const Key('share-quick-story'),
                    icon: Icons.add_circle_outline_rounded,
                    label: 'Story',
                    gradient: FeedImmersiveTheme.brandGradient,
                    onTap: () => _run(
                      actions.shareToStory,
                      'Added to your story.',
                    ),
                  ),
                _QuickAction(
                  key: const Key('share-quick-friends'),
                  icon: Icons.send_rounded,
                  label: 'Friends',
                  gradient: const LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF22D3EE)],
                  ),
                  onTap: _openFriends,
                ),
                _QuickAction(
                  key: const Key('share-quick-groups'),
                  icon: Icons.groups_rounded,
                  label: 'Groups',
                  gradient: const LinearGradient(
                    colors: [Color(0xFF22C55E), Color(0xFF10B981)],
                  ),
                  onTap: _openGroups,
                ),
                _QuickAction(
                  key: const Key('share-quick-more'),
                  icon: Icons.ios_share_rounded,
                  label: 'More',
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
                  ),
                  onTap: () =>
                      _run(actions.shareExternal, 'Shared.'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          const Divider(color: FeedImmersiveTheme.divider, height: 1),
          const SizedBox(height: 6),
          if (_error != null) _InlineError(message: _error!),
          _ActionRow(
            key: const Key('share-row-copy'),
            icon: Icons.link_rounded,
            label: 'Copy Link',
            onTap: () => _run(actions.copyLink, 'Post link copied.'),
          ),
          _ActionRow(
            key: const Key('share-row-save'),
            icon: _isSaved ? Icons.bookmark_rounded : Icons.bookmark_border,
            label: _isSaved ? 'Remove from Saved' : 'Save Post',
            onTap: _toggleSave,
          ),
          if (actions.hasMedia)
            _ActionRow(
              key: const Key('share-row-download'),
              icon: Icons.download_rounded,
              label: 'Download',
              onTap: () => _run(actions.download, 'Saved to your gallery.'),
            ),
        ],
      ),
    );
  }

  Widget _buildTargetList({
    required String title,
    required String searchHint,
    required String emptyLabel,
    required ValueChanged<ShareTarget> onTap,
  }) {
    final targets = _visibleTargets;
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.7,
      child: Column(
        children: [
          const SizedBox(height: 10),
          const _Grabber(),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 12, 8),
            child: Row(
              children: [
                IconButton(
                  key: const Key('share-back'),
                  icon: const Icon(
                    Icons.arrow_back_rounded,
                    color: FeedImmersiveTheme.ink,
                  ),
                  onPressed: () => setState(() {
                    _view = _ShareView.main;
                    _error = null;
                  }),
                ),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: FeedImmersiveTheme.ink,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _search,
              onChanged: (q) {
                _onSearchChanged(q);
                if (_view == _ShareView.groups) setState(() {});
              },
              style: const TextStyle(color: FeedImmersiveTheme.ink),
              decoration: InputDecoration(
                hintText: searchHint,
                hintStyle: const TextStyle(color: FeedImmersiveTheme.inkSubtle),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: FeedImmersiveTheme.inkSubtle,
                ),
                filled: true,
                fillColor: FeedImmersiveTheme.canvas,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),
          if (_error != null) _InlineError(message: _error!),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: FeedImmersiveTheme.brandPink,
                    ),
                  )
                : targets.isEmpty
                ? Center(
                    child: Text(
                      emptyLabel,
                      style: const TextStyle(
                        color: FeedImmersiveTheme.inkMuted,
                      ),
                    ),
                  )
                : ListView.builder(
                    itemCount: targets.length,
                    itemBuilder: (context, index) {
                      final t = targets[index];
                      return ListTile(
                        onTap: _busy ? null : () => onTap(t),
                        leading: CircleAvatar(
                          backgroundColor:
                              FeedImmersiveTheme.glassSurfaceStrong,
                          foregroundImage:
                              (t.avatarUrl != null && t.avatarUrl!.isNotEmpty)
                              ? NetworkImage(t.avatarUrl!)
                              : null,
                          child: Text(
                            t.title.isEmpty
                                ? '?'
                                : t.title.characters.first.toUpperCase(),
                            style: const TextStyle(
                              color: FeedImmersiveTheme.ink,
                            ),
                          ),
                        ),
                        title: Text(
                          t.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: FeedImmersiveTheme.ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: t.subtitle == null
                            ? null
                            : Text(
                                t.subtitle!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: FeedImmersiveTheme.inkMuted,
                                ),
                              ),
                        trailing: const Icon(
                          Icons.send_rounded,
                          color: FeedImmersiveTheme.brandPink,
                          size: 20,
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  String _humanize(Object error) =>
      error.toString().replaceFirst('Exception: ', '');
}

class _Grabber extends StatelessWidget {
  const _Grabber();

  @override
  Widget build(BuildContext context) => Center(
    child: Container(
      width: 42,
      height: 4,
      decoration: BoxDecoration(
        color: FeedImmersiveTheme.inkSubtle,
        borderRadius: BorderRadius.circular(999),
      ),
    ),
  );
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.gradient,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Gradient gradient;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 18),
      child: Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: gradient,
                  shape: BoxShape.circle,
                  boxShadow: FeedImmersiveTheme.controlShadow,
                ),
                child: Icon(icon, color: Colors.white, size: 26),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(
                  color: FeedImmersiveTheme.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 40,
        height: 40,
        decoration: const BoxDecoration(
          color: FeedImmersiveTheme.canvas,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: FeedImmersiveTheme.ink, size: 20),
      ),
      title: Text(
        label,
        style: const TextStyle(
          color: FeedImmersiveTheme.ink,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
    child: Text(
      message,
      style: const TextStyle(color: FeedImmersiveTheme.error, fontSize: 13),
    ),
  );
}
