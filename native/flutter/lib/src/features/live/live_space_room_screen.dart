import 'dart:async';

import 'package:flutter/material.dart';

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

/// Full-screen room for a live audio space. Renders the speaker grid
/// (`live_space_speakers`), live chat (`live_space_messages`), a reaction bar
/// (`live_space_reactions`) with float-up emoji, a gift action
/// (`live_space_gifts`) with a center burst, and a live listener count.
///
/// Web mapping: the native counterpart of `LiveSpaceRoom.tsx` / `SpaceChat.tsx`
/// for the consumption path (speakers + chat + reactions + gifts + presence).
/// Audio transport (WebRTC / LiveKit) is not built natively — this is the
/// listen-and-participate surface; the audio itself needs a broadcast/RTC
/// dependency (see the module report).
class LiveSpaceRoomScreen extends StatefulWidget {
  const LiveSpaceRoomScreen({super.key, required this.space, this.dataSource});

  final LiveSpaceSummary space;

  /// Injectable for tests; defaults to an auto-detecting live source.
  final LiveRemoteDataSource? dataSource;

  @override
  State<LiveSpaceRoomScreen> createState() => _LiveSpaceRoomScreenState();
}

class _LiveSpaceRoomScreenState extends State<LiveSpaceRoomScreen> {
  late final LiveRemoteDataSource _data =
      widget.dataSource ?? LiveRemoteDataSource.autoDetect();
  late final LiveSpaceRealtime _realtime = LiveSpaceRealtime(
    spaceId: widget.space.id,
  );
  final _reactionsController = FloatingReactionsController();
  final _giftBurstController = GiftBurstController();
  final _chat = LiveChatBuffer();

  List<SpaceSpeaker> _speakers = const [];
  int _listenerCount = 0;
  bool _loadingChat = true;
  bool _presenceUnavailable = false;
  bool _realtimeUnavailable = false;
  bool _chatUnavailable = false;
  bool _reactionsUnavailable = false;
  bool _giftsUnavailable = false;
  Timer? _listenerPoll;

  StreamSubscription<SpaceMessage>? _messageSub;
  StreamSubscription<LiveReactionEvent>? _reactionSub;
  StreamSubscription<LiveGiftEvent>? _giftSub;
  StreamSubscription<void>? _speakerSub;

  String? get _selfId => _data.currentUserId;

  @override
  void initState() {
    super.initState();
    _listenerCount = widget.space.viewerCount;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final isHost = _selfId == widget.space.hostId;
    final joined = await _data.joinSpace(
      widget.space.id,
      role: isHost ? 'host' : 'listener',
    );
    if (!mounted) return;
    setState(() => _presenceUnavailable = !joined);

    final realtimeConnected = _realtime.connect();
    if (!realtimeConnected && mounted) {
      setState(() => _realtimeUnavailable = true);
    }
    _messageSub = _realtime.messages.listen((message) {
      if (!mounted) return;
      setState(() => _chat.addRealtime(LiveChatLine.fromSpaceMessage(message)));
      _hydrateAuthors();
    });
    _reactionSub = _realtime.reactions.listen((reaction) {
      if (reaction.userId != null && reaction.userId == _selfId) return;
      _reactionsController.add(reaction.emoji);
    });
    _giftSub = _realtime.gifts.listen(_onGiftEvent);
    _speakerSub = _realtime.speakerChanges.listen((_) {
      _refreshSpeakers();
      _refreshListenerCount();
    });

    final messages = await _data.fetchSpaceMessages(widget.space.id);
    if (!mounted) return;
    setState(() {
      _chat.replaceAll(messages.map(LiveChatLine.fromSpaceMessage));
      _loadingChat = false;
    });
    _hydrateAuthors();

    await _refreshSpeakers();
    await _refreshListenerCount();
    _listenerPoll = Timer.periodic(
      const Duration(seconds: 12),
      (_) => _refreshListenerCount(),
    );
  }

  Future<void> _onGiftEvent(LiveGiftEvent gift) async {
    // Skip our own gift — we already floated + burst it optimistically.
    if (gift.senderId.isNotEmpty && gift.senderId == _selfId) return;
    _reactionsController.add(gift.emoji);
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

  Future<void> _hydrateAuthors() async {
    final missing = _chat.unresolvedAuthorIds;
    if (missing.isEmpty) return;
    final profiles = await _data.fetchProfiles(missing);
    if (!mounted || profiles.isEmpty) return;
    if (_chat.hydrateAuthors(profiles)) setState(() {});
  }

  Future<void> _refreshSpeakers() async {
    final speakers = await _data.fetchSpaceSpeakers(widget.space.id);
    if (!mounted) return;
    setState(() => _speakers = speakers);
  }

  Future<void> _refreshListenerCount() async {
    final count = await _data.countSpaceListeners(widget.space.id);
    if (!mounted) return;
    setState(
      () => _listenerCount = count > 0 ? count : widget.space.viewerCount,
    );
  }

  @override
  void dispose() {
    _listenerPoll?.cancel();
    _messageSub?.cancel();
    _reactionSub?.cancel();
    _giftSub?.cancel();
    _speakerSub?.cancel();
    unawaited(_data.leaveSpace(widget.space.id));
    unawaited(_realtime.dispose());
    _reactionsController.dispose();
    _giftBurstController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage(String body) async {
    final selfId = _selfId;
    if (selfId == null) {
      _showUnavailable('Sign in to chat in this audio space.');
      return;
    }
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
    try {
      await _data.sendSpaceMessage(widget.space.id, body);
    } on LiveSpaceUnavailableException catch (error) {
      if (!mounted) return;
      setState(() => _chatUnavailable = true);
      _showUnavailable(error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _chatUnavailable = true);
      _showUnavailable('Audio-space chat is unavailable right now.');
    }
  }

  Future<void> _sendReaction(String type) async {
    try {
      await _data.sendSpaceReaction(widget.space.id, type);
      _reactionsController.add(reactionEmojiFor(type));
    } on LiveSpaceUnavailableException catch (error) {
      if (!mounted) return;
      setState(() => _reactionsUnavailable = true);
      _showUnavailable(error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _reactionsUnavailable = true);
      _showUnavailable('Audio-space reactions are unavailable right now.');
    }
  }

  Future<void> _openGiftSheet() async {
    final gift = await showLiveGiftSheet(
      context,
      recipientName: widget.space.host?.label ?? 'the host',
    );
    if (gift == null) return;
    try {
      await _data.sendSpaceGift(
        spaceId: widget.space.id,
        giftType: gift.type,
        creditValue: gift.creditValue,
        receiverId: widget.space.hostId,
      );
      if (!mounted) return;
      _reactionsController.add(gift.emoji);
      _giftBurstController.add(gift.emoji, label: gift.label);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${gift.emoji} ${gift.label} sent!')),
      );
    } on LiveSpaceUnavailableException catch (error) {
      if (!mounted) return;
      setState(() => _giftsUnavailable = true);
      _showUnavailable(error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _giftsUnavailable = true);
      _showUnavailable('Audio-space gifts are unavailable right now.');
    }
  }

  void _showUnavailable(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  List<String> get _roomNotices {
    final notices = <String>[];
    if (!_data.isConfigured) {
      notices.add('Live backend is not configured on this device.');
      return notices;
    }
    if (_selfId == null) {
      notices.add('Sign in to join, chat, react, or send gifts.');
    }
    if (_presenceUnavailable) {
      notices.add('Presence join/leave is unavailable; counts may be stale.');
    }
    if (_realtimeUnavailable) {
      notices.add('Realtime updates are unavailable; reopen the room later.');
    }
    if (_chatUnavailable) notices.add('Chat posting is unavailable.');
    if (_reactionsUnavailable) notices.add('Reactions are unavailable.');
    if (_giftsUnavailable) notices.add('Gifts are unavailable.');
    return notices;
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
          const DecoratedBox(
            decoration: BoxDecoration(gradient: LiveTheme.spaceFallback),
          ),
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
                  if (_roomNotices.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _AvailabilityBanner(messages: _roomNotices),
                  ],
                  const SizedBox(height: 12),
                  _SpeakerGrid(speakers: _speakers, host: widget.space.host),
                  const SizedBox(height: 8),
                  const Divider(color: LiveTheme.chipBorder, height: 24),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: LiveChatList(
                        lines: _chat.lines,
                        loading: _loadingChat,
                      ),
                    ),
                  ),
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
                          onSend: _sendMessage,
                          hintText: 'Say something...',
                          accent: LiveTheme.spacePurple,
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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.space.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: LiveTheme.cardTitle.copyWith(fontSize: 16),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const LivePill(color: LiveTheme.spacePurple),
                    const SizedBox(width: 6),
                    ViewerCountChip(
                      count: _listenerCount,
                      icon: Icons.headphones_rounded,
                    ),
                  ],
                ),
              ],
            ),
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

/// A wrapped row of speaker avatars with the host highlighted, mirroring the web
/// `LiveSpaceRoom` speaker stage. The space host is shown even when no speaker
/// row exists yet (web adds a host fallback in `fetchSpeakers`).
class _SpeakerGrid extends StatelessWidget {
  const _SpeakerGrid({required this.speakers, required this.host});

  final List<SpaceSpeaker> speakers;
  final LiveProfile? host;

  @override
  Widget build(BuildContext context) {
    final stageTiles = <Widget>[];
    final listenerTiles = <Widget>[];
    final seen = <String>{};

    for (final speaker in speakers) {
      if (speaker.userId.isEmpty || !seen.add(speaker.userId)) continue;
      final tile = _SpeakerTile(
        profile: speaker.profile,
        isHost: speaker.isHost,
        muted: speaker.muted,
        isListener: speaker.isListener,
      );
      if (speaker.isListener) {
        listenerTiles.add(tile);
      } else {
        stageTiles.add(tile);
      }
    }

    // Host fallback: ensure the space owner always appears on stage.
    if (host != null && seen.add(host!.id)) {
      stageTiles.insert(
        0,
        _SpeakerTile(
          profile: host,
          isHost: true,
          muted: false,
          isListener: false,
        ),
      );
    }

    if (stageTiles.isEmpty && listenerTiles.isEmpty) {
      return const SizedBox(
        height: 76,
        child: Center(
          child: Text(
            'No one on stage yet',
            style: TextStyle(
              color: LiveTheme.onSurfaceFaint,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ParticipantSection(label: 'On stage', children: stageTiles),
          if (listenerTiles.isNotEmpty) ...[
            const SizedBox(height: 14),
            _ParticipantSection(label: 'Listening', children: listenerTiles),
          ],
        ],
      ),
    );
  }
}

class _ParticipantSection extends StatelessWidget {
  const _ParticipantSection({required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: LiveTheme.onSurfaceFaint,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 16,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: children,
        ),
      ],
    );
  }
}

class _SpeakerTile extends StatelessWidget {
  const _SpeakerTile({
    required this.profile,
    required this.isHost,
    required this.muted,
    required this.isListener,
  });

  final LiveProfile? profile;
  final bool isHost;
  final bool muted;
  final bool isListener;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 68,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isHost
                        ? LiveTheme.spacePurple
                        : LiveTheme.chipBorder,
                    width: isHost ? 2.5 : 1.5,
                  ),
                ),
                padding: const EdgeInsets.all(2),
                child: LiveAvatar(profile: profile, size: 52),
              ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: LiveTheme.surface,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isListener
                        ? Icons.headphones_rounded
                        : muted
                        ? Icons.mic_off_rounded
                        : Icons.mic_rounded,
                    size: 12,
                    color: muted || isListener
                        ? LiveTheme.onSurfaceFaint
                        : LiveTheme.spacePurple,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            profile?.label ?? 'feedIn user',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: LiveTheme.onSurface,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (isHost)
            const Text(
              'Host',
              style: TextStyle(
                color: LiveTheme.spacePurple,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            )
          else if (isListener)
            const Text(
              'Listener',
              style: TextStyle(
                color: LiveTheme.onSurfaceFaint,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
        ],
      ),
    );
  }
}

class _AvailabilityBanner extends StatelessWidget {
  const _AvailabilityBanner({required this.messages});

  final List<String> messages;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: LiveTheme.surface.withValues(alpha: 0.78),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: LiveTheme.chipBorder),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.info_outline_rounded,
              color: LiveTheme.spacePurple,
              size: 16,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                messages.join(' '),
                style: const TextStyle(
                  color: LiveTheme.onSurfaceMuted,
                  fontSize: 12,
                  height: 1.25,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
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
