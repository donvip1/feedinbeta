import 'dart:async';

import 'package:flutter/material.dart';

import 'data/live_models.dart';
import 'data/live_realtime.dart';
import 'data/live_remote_data_source.dart';
import 'live_theme.dart';
import 'widgets/floating_reactions.dart';
import 'widgets/live_chat_panel.dart';
import 'widgets/live_common.dart';
import 'widgets/live_gift_sheet.dart';
import 'widgets/live_reaction_bar.dart';
import 'widgets/live_stream_video.dart';

/// Full-screen viewer for a live video stream. Plays the HLS `playback_url`
/// (via [LiveStreamVideo] on the existing `video_player` package), overlays live
/// chat (`live_stream_comments`), a reaction bar (`live_stream_reactions`) with
/// float-up emoji, a gift action (`live_stream_gifts`), and a live viewer count.
///
/// Web mapping: this is the native counterpart of `LiveKitViewer.tsx` for the
/// consumption path (chat + reactions + gifts + viewer presence). The actual
/// WebRTC/LiveKit media transport is replaced by direct HLS playback of
/// `playback_url`.
class LiveStreamViewerScreen extends StatefulWidget {
  const LiveStreamViewerScreen({
    super.key,
    required this.stream,
    this.dataSource,
  });

  final LiveStreamSummary stream;

  /// Injectable for tests; defaults to an auto-detecting live source.
  final LiveRemoteDataSource? dataSource;

  @override
  State<LiveStreamViewerScreen> createState() => _LiveStreamViewerScreenState();
}

class _LiveStreamViewerScreenState extends State<LiveStreamViewerScreen> {
  late final LiveRemoteDataSource _data =
      widget.dataSource ?? LiveRemoteDataSource.autoDetect();
  late final LiveStreamRealtime _realtime =
      LiveStreamRealtime(streamId: widget.stream.id);
  final _reactionsController = FloatingReactionsController();

  final List<LiveChatLine> _chat = [];
  int _viewerCount = 0;
  Timer? _viewerPoll;

  StreamSubscription<LiveComment>? _commentSub;
  StreamSubscription<LiveReactionEvent>? _reactionSub;
  StreamSubscription<LiveGiftEvent>? _giftSub;

  @override
  void initState() {
    super.initState();
    _viewerCount = widget.stream.viewerCount;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _data.joinStream(widget.stream.id);

    _realtime.connect();
    _commentSub = _realtime.comments.listen((comment) {
      if (!mounted) return;
      setState(() => _chat.add(LiveChatLine.fromComment(comment)));
    });
    _reactionSub = _realtime.reactions.listen((reaction) {
      _reactionsController.add(reaction.emoji);
    });
    _giftSub = _realtime.gifts.listen((gift) {
      _reactionsController.add(gift.emoji);
    });

    final comments = await _data.fetchStreamComments(widget.stream.id);
    if (!mounted) return;
    setState(() {
      _chat
        ..clear()
        ..addAll(comments.map(LiveChatLine.fromComment));
    });

    await _refreshViewerCount();
    _viewerPoll = Timer.periodic(
      const Duration(seconds: 12),
      (_) => _refreshViewerCount(),
    );
  }

  Future<void> _refreshViewerCount() async {
    final count = await _data.countStreamViewers(widget.stream.id);
    if (!mounted) return;
    // Never show fewer than the host-reported starting count.
    setState(() => _viewerCount = count > 0 ? count : widget.stream.viewerCount);
  }

  @override
  void dispose() {
    _viewerPoll?.cancel();
    _commentSub?.cancel();
    _reactionSub?.cancel();
    _giftSub?.cancel();
    // Fire-and-forget presence cleanup; realtime teardown is awaited internally.
    unawaited(_data.leaveStream(widget.stream.id));
    unawaited(_realtime.dispose());
    _reactionsController.dispose();
    super.dispose();
  }

  Future<void> _sendComment(String body) async {
    // Optimistic append; the realtime echo is de-duplicated by id on refresh.
    await _data.sendStreamComment(widget.stream.id, body);
  }

  Future<void> _sendReaction(String type) async {
    _reactionsController.add(reactionEmojiFor(type));
    await _data.sendStreamReaction(widget.stream.id, type);
  }

  Future<void> _openGiftSheet() async {
    final gift = await showLiveGiftSheet(
      context,
      recipientName: widget.stream.host?.label ?? 'the host',
    );
    if (gift == null) return;
    _reactionsController.add(gift.emoji);
    await _data.sendStreamGift(
      streamId: widget.stream.id,
      giftType: gift.type,
      creditValue: gift.creditValue,
      receiverId: widget.stream.hostId,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${gift.emoji} ${gift.label} sent!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Scaffold(
      backgroundColor: LiveTheme.background,
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          LiveStreamVideo(playbackUrl: widget.stream.playbackUrl),
          const DecoratedBox(
            decoration: BoxDecoration(gradient: LiveTheme.bottomScrim),
          ),
          FloatingReactionsOverlay(controller: _reactionsController),
          SafeArea(
            child: Padding(
              padding: EdgeInsets.only(bottom: bottomInset),
              child: Column(
                children: [
                  _header(),
                  const Spacer(),
                  _ChatOverlay(lines: _chat),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: LiveReactionBar(onReaction: _sendReaction),
                            ),
                            const SizedBox(width: 8),
                            _GiftButton(onTap: _openGiftSheet),
                          ],
                        ),
                        const SizedBox(height: 10),
                        LiveChatComposer(
                          onSend: _sendComment,
                          hintText: 'Say something...',
                          accent: LiveTheme.liveRed,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      child: Row(
        children: [
          LiveAvatar(profile: widget.stream.host, size: 40),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.stream.host?.label ?? 'feedIn user',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: LiveTheme.cardTitle.copyWith(fontSize: 15),
                ),
                Text(
                  widget.stream.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: LiveTheme.cardHost,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const LivePill(),
          const SizedBox(width: 6),
          ViewerCountChip(count: _viewerCount),
          const SizedBox(width: 4),
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.close_rounded, color: LiveTheme.onSurface),
            tooltip: 'Leave',
          ),
        ],
      ),
    );
  }
}

/// Height-capped, bottom-anchored chat overlay so the video stays visible.
class _ChatOverlay extends StatelessWidget {
  const _ChatOverlay({required this.lines});

  final List<LiveChatLine> lines;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.32,
      ),
      margin: const EdgeInsets.symmetric(horizontal: 12),
      child: LiveChatList(lines: lines),
    );
  }
}

class _GiftButton extends StatelessWidget {
  const _GiftButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFFFC24A), Color(0xFFFF7A45)],
          ),
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.card_giftcard_rounded,
          color: Colors.white,
          size: 22,
        ),
      ),
    );
  }
}
