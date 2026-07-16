import 'package:flutter/material.dart';

import 'data/live_models.dart';
import 'data/live_remote_data_source.dart';
import 'live_stream_host_screen.dart';
import 'live_space_room_screen.dart';
import 'live_stream_viewer_screen.dart';
import 'live_theme.dart';
import 'widgets/live_discover_card.dart';

/// Public entry screen for the live streaming experience: a discovery browse
/// surface listing active video streams (`live_streams`) and audio spaces
/// (`live_spaces`) as portrait cards. Tapping a stream opens
/// [LiveStreamViewerScreen]; tapping a space opens [LiveSpaceRoomScreen].
///
/// Web mapping: this is the native counterpart of the web live discovery grid
/// (`LiveDiscoverCard` list). It covers the consumption entry point; a
/// clearly-flagged "Go live" action scaffolds broadcasting, which is not built
/// (native broadcasting needs a camera+RTMP/WebRTC dependency and server-owned
/// ingest config — see the module report).
///
/// Integration: construct with `const LiveScreen()` (it auto-detects the
/// Supabase singleton) or inject a [LiveRemoteDataSource] for tests. Intended to
/// hang off the feed's "Live" tab or a dedicated nav destination.
///
/// Group-scoped "Go Live" (plan.md §E / §B): pass an optional [groupId] (and
/// optionally [groupName]) so the Groups feature can open this screen already
/// scoped to a group — the "Go live" sheet then presents the stream as being
/// started *in* that group. For a direct entry point that skips the browse
/// surface and opens the sheet immediately, use [showGoLiveSheet].
class LiveScreen extends StatefulWidget {
  const LiveScreen({
    super.key,
    this.dataSource,
    this.groupId,
    this.groupName,
    this.topPadding = 0,
  });

  /// Injectable for tests; defaults to an auto-detecting live source.
  final LiveRemoteDataSource? dataSource;

  /// Extra top padding applied to the scroll content, used when this screen is
  /// embedded beneath an overlaid header (e.g. the feed's immersive tab bar) so
  /// its own "Live" title + Go live button clear the overlay. When > 0 the
  /// internal top [SafeArea] inset is skipped (the caller already accounts for
  /// the status bar in [topPadding]). Defaults to 0 for standalone use.
  final double topPadding;

  /// Optional group this live surface is scoped to. When set, the "Go live"
  /// entry frames the stream as belonging to the group. Additive: omit for the
  /// global live browse experience.
  final String? groupId;

  /// Optional human-readable group label shown in the group-scoped go-live
  /// sheet. Ignored when [groupId] is null.
  final String? groupName;

  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

/// Open the "Go live" sheet directly, scoped to an optional group, without
/// navigating to the full live browse screen. This is the integration point the
/// Groups feature calls from a group's "Go Live" action (plan.md §E).
///
Future<void> showGoLiveSheet(
  BuildContext context, {
  String? groupId,
  String? groupName,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: LiveTheme.surface,
    shape: const RoundedRectangleBorder(borderRadius: LiveTheme.sheetRadius),
    builder: (_) => _GoLiveSheet(
      groupId: groupId,
      groupName: groupName,
      dataSource: LiveRemoteDataSource.autoDetect(),
    ),
  );
}

class _LiveScreenState extends State<LiveScreen> {
  late final LiveRemoteDataSource _data =
      widget.dataSource ?? LiveRemoteDataSource.autoDetect();

  late Future<_LiveBrowseData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_LiveBrowseData> _load() async {
    // Fetch streams + spaces concurrently so browse loads in one round-trip.
    final results = await Future.wait([
      _data.fetchLiveStreams(),
      _data.fetchLiveSpaces(),
    ]);
    return _LiveBrowseData(
      streams: results[0] as List<LiveStreamSummary>,
      spaces: results[1] as List<LiveSpaceSummary>,
    );
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    final next = _load();
    setState(() => _future = next);
    try {
      await next;
    } catch (_) {
      // The FutureBuilder renders the error state; keep pull-to-refresh from
      // surfacing an unhandled exception.
    }
  }

  void _openStream(LiveStreamSummary stream) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => LiveStreamViewerScreen(stream: stream),
      ),
    );
  }

  void _openSpace(LiveSpaceSummary space) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => LiveSpaceRoomScreen(space: space),
      ),
    );
  }

  void _onGoLive() {
    showGoLiveSheet(
      context,
      groupId: widget.groupId,
      groupName: widget.groupName,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: LiveTheme.background,
      child: SafeArea(
        top: widget.topPadding <= 0,
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: LiveTheme.liveRed,
          backgroundColor: LiveTheme.surface,
          child: FutureBuilder<_LiveBrowseData>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return _LiveLoadingState(topPadding: widget.topPadding);
              }
              if (snapshot.hasError) {
                return _LiveErrorState(
                  topPadding: widget.topPadding,
                  onRetry: _refresh,
                  onGoLive: _onGoLive,
                  message: _liveBrowseErrorMessage(snapshot.error),
                );
              }
              final data = snapshot.data ?? const _LiveBrowseData();
              return _LiveBrowseGrid(
                data: data,
                topPadding: widget.topPadding,
                onOpenStream: _openStream,
                onOpenSpace: _openSpace,
                onGoLive: _onGoLive,
              );
            },
          ),
        ),
      ),
    );
  }
}

String _liveBrowseErrorMessage(Object? error) {
  if (error is LiveDataException) return error.message;
  return 'Could not load Live. Pull to retry.';
}

class _LiveBrowseData {
  const _LiveBrowseData({this.streams = const [], this.spaces = const []});

  final List<LiveStreamSummary> streams;
  final List<LiveSpaceSummary> spaces;

  bool get isEmpty => streams.isEmpty && spaces.isEmpty;
}

class _LiveBrowseGrid extends StatelessWidget {
  const _LiveBrowseGrid({
    required this.data,
    required this.onOpenStream,
    required this.onOpenSpace,
    required this.onGoLive,
    this.topPadding = 0,
  });

  final _LiveBrowseData data;
  final ValueChanged<LiveStreamSummary> onOpenStream;
  final ValueChanged<LiveSpaceSummary> onOpenSpace;
  final VoidCallback onGoLive;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        if (topPadding > 0)
          SliverToBoxAdapter(child: SizedBox(height: topPadding)),
        SliverToBoxAdapter(child: _Header(onGoLive: onGoLive)),
        if (data.isEmpty)
          const SliverFillRemaining(
            hasScrollBody: false,
            child: _LiveEmptyState(),
          )
        else ...[
          if (data.streams.isNotEmpty) ...[
            const _SectionHeaderSliver(label: 'LIVE STREAMS'),
            _CardGridSliver(
              children: [
                for (final stream in data.streams)
                  LiveDiscoverCard.stream(
                    stream,
                    onTap: () => onOpenStream(stream),
                  ),
              ],
            ),
          ],
          if (data.spaces.isNotEmpty) ...[
            const _SectionHeaderSliver(label: 'AUDIO SPACES'),
            _CardGridSliver(
              children: [
                for (final space in data.spaces)
                  LiveDiscoverCard.space(
                    space,
                    onTap: () => onOpenSpace(space),
                  ),
              ],
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onGoLive});

  final VoidCallback onGoLive;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          const Expanded(child: Text('Live', style: LiveTheme.screenTitle)),
          _GoLiveButton(onTap: onGoLive),
        ],
      ),
    );
  }
}

class _GoLiveButton extends StatelessWidget {
  const _GoLiveButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: const BoxDecoration(
          gradient: LiveTheme.brandGradient,
          borderRadius: LiveTheme.pillRadius,
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.videocam_rounded, color: Colors.white, size: 18),
            SizedBox(width: 6),
            Text(
              'Go live',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeaderSliver extends StatelessWidget {
  const _SectionHeaderSliver({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
        child: Text(label, style: LiveTheme.sectionLabel),
      ),
    );
  }
}

class _CardGridSliver extends StatelessWidget {
  const _CardGridSliver({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 3 / 4,
        ),
        delegate: SliverChildListDelegate(children),
      ),
    );
  }
}

/// Skeleton browse grid shown while the first fetch is in flight, mirroring the
/// card layout so the transition to real content is not a jarring pop.
class _LiveLoadingState extends StatelessWidget {
  const _LiveLoadingState({this.topPadding = 0});

  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      children: [
        if (topPadding > 0) SizedBox(height: topPadding),
        _Header(onGoLive: () {}),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Text('LIVE STREAMS', style: LiveTheme.sectionLabel),
        ),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 3 / 4,
          children: const [
            _SkeletonCard(),
            _SkeletonCard(),
            _SkeletonCard(),
            _SkeletonCard(),
          ],
        ),
      ],
    );
  }
}

/// A single shimmering placeholder card.
class _SkeletonCard extends StatefulWidget {
  const _SkeletonCard();

  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.4, end: 0.8).animate(_controller),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: LiveTheme.surfaceRaised,
          borderRadius: LiveTheme.cardRadius,
        ),
      ),
    );
  }
}

class _LiveEmptyState extends StatelessWidget {
  const _LiveEmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.sensors_off_rounded,
            color: LiveTheme.onSurfaceFaint,
            size: 48,
          ),
          SizedBox(height: 12),
          Text(
            'No one is live right now',
            style: TextStyle(
              color: LiveTheme.onSurface,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Check back soon or start your own stream',
            style: TextStyle(color: LiveTheme.onSurfaceMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _LiveErrorState extends StatelessWidget {
  const _LiveErrorState({
    required this.onRetry,
    required this.onGoLive,
    required this.message,
    this.topPadding = 0,
  });

  final Future<void> Function() onRetry;
  final VoidCallback onGoLive;
  final String message;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        if (topPadding > 0)
          SliverToBoxAdapter(child: SizedBox(height: topPadding)),
        SliverToBoxAdapter(child: _Header(onGoLive: onGoLive)),
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: LiveTheme.brandOrange,
                    size: 48,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Live could not load',
                    style: TextStyle(
                      color: LiveTheme.onSurface,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: LiveTheme.onSurfaceMuted,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: onRetry,
                    style: FilledButton.styleFrom(
                      backgroundColor: LiveTheme.surfaceRaised,
                      foregroundColor: LiveTheme.onSurface,
                    ),
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GoLiveSheet extends StatefulWidget {
  const _GoLiveSheet({this.groupId, this.groupName, required this.dataSource});

  final String? groupId;
  final String? groupName;
  final LiveRemoteDataSource dataSource;

  @override
  State<_GoLiveSheet> createState() => _GoLiveSheetState();
}

class _GoLiveSheetState extends State<_GoLiveSheet> {
  late final TextEditingController _title = TextEditingController(
    text: (widget.groupName?.trim().isNotEmpty ?? false)
        ? '${widget.groupName!.trim()} Live'
        : 'Live stream',
  );
  bool _starting = false;

  bool get _scopedToGroup =>
      widget.groupId != null && widget.groupId!.isNotEmpty;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final groupId = widget.groupId;
    final title = _title.text.trim();
    if (title.isEmpty) return;

    setState(() => _starting = true);
    try {
      final stream = groupId != null && groupId.isNotEmpty
          ? await widget.dataSource.startGroupLiveStream(
              conversationId: groupId,
              title: title,
            )
          : await widget.dataSource.startLiveStream(title: title);
      if (!mounted) return;
      final navigator = Navigator.of(context);
      navigator.pop();
      await navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => LiveStreamHostScreen(
            stream: stream,
            dataSource: widget.dataSource,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: LiveTheme.onSurfaceFaint,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    gradient: LiveTheme.brandGradient,
                    borderRadius: BorderRadius.all(Radius.circular(12)),
                  ),
                  child: const Icon(
                    Icons.videocam_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _scopedToGroup ? 'Go live in group' : 'Go live',
                    style: LiveTheme.screenTitle,
                  ),
                ),
              ],
            ),
            if (_scopedToGroup) ...[
              const SizedBox(height: 12),
              _GroupScopeChip(groupName: widget.groupName),
            ],
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: LiveTheme.surfaceRaised,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: LiveTheme.chipBorder),
              ),
              child: TextField(
                controller: _title,
                maxLength: 120,
                textInputAction: TextInputAction.go,
                onSubmitted: (_) => _start(),
                style: const TextStyle(color: LiveTheme.onSurface),
                decoration: InputDecoration(
                  labelText: _scopedToGroup
                      ? 'Group livestream title'
                      : 'Livestream title',
                  labelStyle: const TextStyle(
                    color: LiveTheme.onSurfaceMuted,
                  ),
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _starting ? null : _start,
                style: FilledButton.styleFrom(
                  backgroundColor: LiveTheme.surfaceRaised,
                  foregroundColor: LiveTheme.onSurface,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(
                  _starting
                      ? 'Starting...'
                      : 'Go Live',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small labelled chip confirming which group a go-live flow is scoped to.
class _GroupScopeChip extends StatelessWidget {
  const _GroupScopeChip({this.groupName});

  final String? groupName;

  @override
  Widget build(BuildContext context) {
    final label = (groupName != null && groupName!.trim().isNotEmpty)
        ? groupName!.trim()
        : 'this group';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: LiveTheme.surfaceRaised,
        borderRadius: LiveTheme.pillRadius,
        border: Border.all(color: LiveTheme.chipBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.groups_rounded,
            color: LiveTheme.brandPink,
            size: 16,
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              'Streaming to $label',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: LiveTheme.onSurface,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
