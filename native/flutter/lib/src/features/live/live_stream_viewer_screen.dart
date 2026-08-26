import 'dart:async';

import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/live_models.dart';
import 'data/live_realtime.dart';
import 'data/live_remote_data_source.dart';
import 'live_theme.dart';
import 'widgets/floating_reactions.dart';
import 'widgets/gift_burst_overlay.dart';
import 'widgets/live_chat_panel.dart';
import 'widgets/live_common.dart';
import 'widgets/live_gift_sheet.dart';
import 'widgets/live_reaction_bar.dart';
import 'widgets/live_stream_video.dart';
import 'widgets/pulse_panel.dart';

/// Full-screen viewer for a live video stream. Joins the same LiveKit room as
/// the native host and falls back to HLS for legacy web-created streams,
/// overlays live chat (`live_stream_comments`), a reaction bar
/// (`live_stream_reactions`) with float-up emoji, a gift action
/// (`live_stream_gifts`) with a center burst, a mute toggle, and a live viewer
/// count.
///
/// Web mapping: this is the native counterpart of `LiveKitViewer.tsx` for the
/// consumption path (media + chat + reactions + gifts + viewer presence).
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
  late final LiveStreamRealtime _realtime = LiveStreamRealtime(
    streamId: widget.stream.id,
  );
  final _reactionsController = FloatingReactionsController();
  final _giftBurstController = GiftBurstController();
  final _chat = LiveChatBuffer();

  int _viewerCount = 0;
  bool _muted = false;
  bool _loadingChat = true;
  Timer? _viewerPoll;
  Room? _room;
  EventsListener<RoomEvent>? _roomListener;
  VideoTrack? _videoTrack;
  bool _mediaConnecting = true;
  bool _mediaConnected = false;

  /// Host-published PULSE spotlight cards, seeded from the summary and refreshed
  /// from `stream_features.host_cards` on bootstrap. The host mutates this list
  /// via the PULSE panel; viewers see it read-only.
  late List<HostCard> _hostCards = List.of(widget.stream.hostCards);

  StreamSubscription<LiveComment>? _commentSub;
  StreamSubscription<LiveReactionEvent>? _reactionSub;
  StreamSubscription<LiveGiftEvent>? _giftSub;
  StreamSubscription<void>? _viewerSub;

  String? get _selfId => _data.currentUserId;

  /// True when the signed-in user owns this stream — unlocks the PULSE panel's
  /// add / edit / remove controls. Viewers get a read-only panel.
  bool get _isHost {
    final self = _selfId;
    return self != null && self.isNotEmpty && self == widget.stream.hostId;
  }

  @override
  void initState() {
    super.initState();
    _viewerCount = widget.stream.viewerCount;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _data.joinStream(widget.stream.id);
    if (!mounted) return;
    unawaited(_connectLiveKit());

    _realtime.connect();
    _commentSub = _realtime.comments.listen((comment) {
      if (!mounted) return;
      setState(() => _chat.addRealtime(LiveChatLine.fromComment(comment)));
      _hydrateAuthors();
    });
    _reactionSub = _realtime.reactions.listen((reaction) {
      // Skip our own reaction — we already floated it optimistically.
      if (reaction.userId != null && reaction.userId == _selfId) return;
      _reactionsController.add(reaction.emoji);
    });
    _giftSub = _realtime.gifts.listen(_onGiftEvent);
    _viewerSub = _realtime.viewerChanges.listen((_) => _refreshViewerCount());

    final comments = await _data.fetchStreamComments(widget.stream.id);
    if (!mounted) return;
    setState(() {
      _chat.replaceAll(comments.map(LiveChatLine.fromComment));
      _loadingChat = false;
    });
    _hydrateAuthors();

    await _refreshViewerCount();
    _viewerPoll = Timer.periodic(
      const Duration(seconds: 12),
      (_) => _refreshViewerCount(),
    );

    // Refresh host PULSE cards from the DB (the summary may predate the latest
    // edits, or arrive without stream_features on the browse projection).
    final cards = await _data.fetchHostCards(widget.stream.id);
    if (!mounted || cards.isEmpty && _hostCards.isEmpty) return;
    setState(() => _hostCards = cards);
  }

  Future<void> _connectLiveKit() async {
    try {
      final response = await Supabase.instance.client.functions.invoke(
        'livekit-token',
        body: {
          'roomName': 'stream-${widget.stream.id}',
          'participantName': 'feedIn viewer',
        },
      );
      if (response.status != 200 || response.data is! Map) {
        throw StateError('LiveKit token unavailable.');
      }
      final payload = Map<String, dynamic>.from(response.data as Map);
      final token = payload['token']?.toString();
      final url = payload['url']?.toString();
      if (token == null || token.isEmpty || url == null || url.isEmpty) {
        throw StateError('LiveKit credentials are incomplete.');
      }
      if (!mounted) return;

      final room = Room(
        roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
      );
      _room = room;
      final listener = room.createListener();
      _roomListener = listener;
      listener
        ..on<TrackSubscribedEvent>((event) {
          final track = event.track;
          if (track is VideoTrack && mounted) {
            setState(() {
              _videoTrack = track;
              _mediaConnecting = false;
              _mediaConnected = true;
            });
          }
        })
        ..on<TrackUnsubscribedEvent>((event) {
          if (identical(event.track, _videoTrack) && mounted) {
            setState(() => _videoTrack = null);
          }
        })
        ..on<ParticipantConnectedEvent>((_) => _refreshRemoteTracks())
        ..on<ParticipantDisconnectedEvent>((_) => _refreshRemoteTracks())
        ..on<RoomDisconnectedEvent>((_) {
          if (mounted) setState(() => _videoTrack = null);
        });

      await room.connect(url, token);
      _refreshRemoteTracks();
      if (mounted) {
        setState(() {
          _mediaConnecting = false;
          _mediaConnected = true;
        });
      }
    } catch (_) {
      // Legacy web streams may still expose only HLS. Keep that path alive.
      if (mounted) setState(() => _mediaConnecting = false);
    }
  }

  void _refreshRemoteTracks() {
    final room = _room;
    if (room == null) return;
    for (final participant in room.remoteParticipants.values) {
      for (final publication in participant.videoTrackPublications) {
        final track = publication.track;
        if (track is VideoTrack) {
          if (mounted) {
            setState(() {
              _videoTrack = track;
              _mediaConnecting = false;
              _mediaConnected = true;
            });
          }
          return;
        }
      }
    }
  }

  Future<void> _openPulse() async {
    await showPulsePanel(
      context,
      streamId: widget.stream.id,
      isHost: _isHost,
      initialCards: _hostCards,
      dataSource: _data,
      onCardsChanged: (cards) {
        if (mounted) setState(() => _hostCards = cards);
      },
    );
  }

  Future<void> _onGiftEvent(LiveGiftEvent gift) async {
    // Skip our own gift — we already floated + burst it optimistically.
    if (gift.senderId.isNotEmpty && gift.senderId == _selfId) return;
    _reactionsController.add(gift.emoji);
    // Resolve the sender name for the burst caption (payload has no profile).
    String? senderName;
    if (gift.senderId.isNotEmpty && gift.senderId != _selfId) {
      final profiles = await _data.fetchProfiles([gift.senderId]);
      senderName = profiles[gift.senderId]?.label;
    }
    if (!mounted) return;
    _giftBurstController.add(
      gift.emoji,
      senderName: senderName,
      label: _giftLabel(gift.giftType),
    );
  }

  String _giftLabel(String type) {
    for (final option in LiveGiftOption.catalog) {
      if (option.type == type) return option.label;
    }
    return 'gift';
  }

  /// Batch-resolve missing chat authors (realtime rows carry no profile).
  Future<void> _hydrateAuthors() async {
    final missing = _chat.unresolvedAuthorIds;
    if (missing.isEmpty) return;
    final profiles = await _data.fetchProfiles(missing);
    if (!mounted || profiles.isEmpty) return;
    if (_chat.hydrateAuthors(profiles)) setState(() {});
  }

  Future<void> _refreshViewerCount() async {
    final count = await _data.countStreamViewers(widget.stream.id);
    if (!mounted) return;
    // Never show fewer than the host-reported starting count.
    setState(
      () => _viewerCount = count > 0 ? count : widget.stream.viewerCount,
    );
  }

  @override
  void dispose() {
    _viewerPoll?.cancel();
    _commentSub?.cancel();
    _reactionSub?.cancel();
    _giftSub?.cancel();
    _viewerSub?.cancel();
    // Fire-and-forget presence cleanup; realtime teardown is awaited internally.
    unawaited(_data.leaveStream(widget.stream.id));
    unawaited(_realtime.dispose());
    unawaited(_disposeLiveKit());
    _reactionsController.dispose();
    _giftBurstController.dispose();
    super.dispose();
  }

  Future<void> _sendComment(String body) async {
    final blocked = _interactionBlockedMessage('chat');
    if (blocked != null) {
      _showError(blocked);
      return;
    }
    // Optimistic append; the realtime echo upgrades/replaces this line by id.
    final selfId = _selfId;
    if (selfId != null) {
      setState(() {
        _chat.addOptimistic(
          LiveChatLine(
            id: 'optimistic-${DateTime.now().microsecondsSinceEpoch}',
            userId: selfId,
            body: body,
            pending: true,
          ),
        );
      });
      _hydrateAuthors();
    }
    try {
      await _data.sendStreamComment(widget.stream.id, body);
    } catch (error) {
      if (mounted) {
        _showError(
          _liveActionErrorMessage(error, 'Could not send your message'),
        );
      }
    }
  }

  Future<void> _sendReaction(String type) async {
    final blocked = _interactionBlockedMessage('react');
    if (blocked != null) {
      _showError(blocked);
      return;
    }
    _reactionsController.add(reactionEmojiFor(type));
    try {
      await _data.sendStreamReaction(widget.stream.id, type);
    } catch (error) {
      if (mounted) {
        _showError(_liveActionErrorMessage(error, 'Could not send reaction'));
      }
    }
  }

  Future<void> _toggleMute() async {
    final next = !_muted;
    final room = _room;
    if (room != null) {
      for (final participant in room.remoteParticipants.values) {
        for (final publication in participant.audioTrackPublications) {
          final track = publication.track;
          if (track != null) {
            if (next) {
              await track.disable();
            } else {
              await track.enable();
            }
          }
        }
      }
    }
    if (mounted) setState(() => _muted = next);
  }

  Future<void> _disposeLiveKit() async {
    final listener = _roomListener;
    _roomListener = null;
    if (listener != null) {
      try {
        await listener.dispose();
      } catch (_) {}
    }
    final room = _room;
    _room = null;
    if (room != null) {
      try {
        await room.disconnect();
      } catch (_) {}
      try {
        await room.dispose();
      } catch (_) {}
    }
  }

  Future<void> _openGiftSheet() async {
    final gift = await showLiveGiftSheet(
      context,
      recipientName: widget.stream.host?.label ?? 'the host',
    );
    if (gift == null) return;
    final blocked = _interactionBlockedMessage('send gifts');
    if (blocked != null) {
      _showError(blocked);
      return;
    }
    // Local burst + float so the sender sees instant feedback.
    _reactionsController.add(gift.emoji);
    _giftBurstController.add(gift.emoji, label: gift.label);
    try {
      await _data.sendStreamGift(
        streamId: widget.stream.id,
        giftType: gift.type,
        receiverId: widget.stream.hostId,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${gift.emoji} ${gift.label} sent!')),
      );
    } catch (error) {
      if (mounted) {
        _showError(_liveActionErrorMessage(error, 'Could not send your gift'));
      }
    }
  }

  String? _interactionBlockedMessage(String action) {
    if (!_data.isConfigured) return 'Live is unavailable right now.';
    if (_selfId == null) return 'Sign in to $action.';
    return null;
  }

  String _liveActionErrorMessage(Object error, String fallback) {
    if (error is LiveDataException) return error.message;
    return fallback;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final lines = _chat.lines;
    return Scaffold(
      backgroundColor: LiveTheme.background,
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_videoTrack != null)
            VideoTrackRenderer(_videoTrack!, fit: VideoViewFit.cover)
          else
            LiveStreamVideo(
              playbackUrl: widget.stream.playbackUrl,
              muted: _muted,
            ),
          if (_mediaConnecting && !_mediaConnected)
            const Center(child: CircularProgressIndicator(color: Colors.white)),
          const DecoratedBox(
            decoration: BoxDecoration(gradient: LiveTheme.bottomScrim),
          ),
          FloatingReactionsOverlay(controller: _reactionsController),
          GiftBurstOverlay(controller: _giftBurstController),
          SafeArea(
            child: Padding(
              padding: EdgeInsets.only(bottom: bottomInset),
              child: Column(
                children: [
                  _header(),
                  const Spacer(),
                  _ChatOverlay(lines: lines, loading: _loadingChat),
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
          const SizedBox(width: 2),
          // PULSE panel: the host can always curate cards; viewers see the entry
          // only once at least one card is published.
          if (_isHost || _hostCards.isNotEmpty) ...[
            _PulseButton(cardCount: _hostCards.length, onTap: _openPulse),
            const SizedBox(width: 2),
          ],
          if (_mediaConnected ||
              (widget.stream.playbackUrl?.isNotEmpty ?? false))
            IconButton(
              onPressed: () => unawaited(_toggleMute()),
              icon: Icon(
                _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                color: LiveTheme.onSurface,
              ),
              tooltip: _muted ? 'Unmute' : 'Mute',
            ),
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
  const _ChatOverlay({required this.lines, required this.loading});

  final List<LiveChatLine> lines;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.32,
      ),
      margin: const EdgeInsets.symmetric(horizontal: 12),
      child: LiveChatList(lines: lines, loading: loading),
    );
  }
}

/// Header entry to the PULSE panel: a spark glyph with a card-count badge,
/// mirroring the web `AICatchUpPanel` trigger (yellow spark + count pill).
class _PulseButton extends StatelessWidget {
  const _PulseButton({required this.cardCount, required this.onTap});

  final int cardCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'PULSE',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: LiveTheme.chip,
                  shape: BoxShape.circle,
                  border: Border.fromBorderSide(
                    BorderSide(color: LiveTheme.chipBorder),
                  ),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: Color(0xFFFACC15),
                  size: 15,
                ),
              ),
              if (cardCount > 0)
                Positioned(
                  top: 2,
                  right: 2,
                  child: Container(
                    width: 15,
                    height: 15,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFACC15),
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      cardCount > 9 ? '9+' : '$cardCount',
                      style: const TextStyle(
                        color: Colors.black,
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
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
