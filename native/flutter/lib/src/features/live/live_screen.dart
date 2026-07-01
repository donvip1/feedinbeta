import 'package:flutter/material.dart';

import 'data/live_models.dart';
import 'data/live_remote_data_source.dart';
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
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key, this.dataSource});

  /// Injectable for tests; defaults to an auto-detecting live source.
  final LiveRemoteDataSource? dataSource;

  @override
  State<LiveScreen> createState() => _LiveScreenState();
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
    final data = await _load();
    if (!mounted) return;
    setState(() => _future = Future.value(data));
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
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: LiveTheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: LiveTheme.sheetRadius),
      builder: (_) => const _GoLiveSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: LiveTheme.background,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: LiveTheme.liveRed,
          backgroundColor: LiveTheme.surface,
          child: FutureBuilder<_LiveBrowseData>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const _LiveLoadingState();
              }
              final data = snapshot.data ?? const _LiveBrowseData();
              return _LiveBrowseGrid(
                data: data,
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
  });

  final _LiveBrowseData data;
  final ValueChanged<LiveStreamSummary> onOpenStream;
  final ValueChanged<LiveSpaceSummary> onOpenSpace;
  final VoidCallback onGoLive;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
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
  const _LiveLoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      children: [
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

/// The "Go live" sheet. Broadcasting is intentionally NOT implemented: it needs
/// a camera + RTMP/WebRTC dependency and server-owned ingest configuration
/// (stream key / playback URL). This sheet clearly flags that so the entry point
/// exists for parity without shipping a broken broadcast flow.
class _GoLiveSheet extends StatelessWidget {
  const _GoLiveSheet();

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
                const Expanded(
                  child: Text('Go live', style: LiveTheme.screenTitle),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: LiveTheme.surfaceRaised,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: LiveTheme.chipBorder),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.construction_rounded,
                    color: LiveTheme.brandOrange,
                    size: 20,
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Broadcasting from the app is coming soon. Going live '
                      'needs camera capture and an RTMP/WebRTC broadcast '
                      'dependency plus server-owned ingest config (stream key + '
                      'playback URL), which is not part of this build.',
                      style: TextStyle(
                        color: LiveTheme.onSurfaceMuted,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: FilledButton.styleFrom(
                  backgroundColor: LiveTheme.surfaceRaised,
                  foregroundColor: LiveTheme.onSurface,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Got it'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
