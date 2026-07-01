import 'package:flutter/material.dart';

import '../channels_theme.dart';
import '../data/channels_remote_data_source.dart';
import '../view_models/channel_view_models.dart';
import '../widgets/channel_composer.dart';
import '../widgets/channel_header.dart';
import '../widgets/channel_post_card.dart';

/// The channel broadcast view: a top app bar, the channel header, the broadcast
/// post feed (newest at the bottom, Telegram-style), and — only when the viewer
/// is the channel owner/admin — a composer to publish new broadcasts.
///
/// Subscribers see the same feed but no composer. When the channel tables are
/// not yet provisioned the feed is empty and the header degrades to a neutral
/// "channel unavailable" state via the loading path.
class ChannelViewScreen extends StatefulWidget {
  const ChannelViewScreen({
    super.key,
    required this.dataSource,
    required this.channelId,
    this.initialDetail,
    this.onBack,
    this.onSubscriptionChanged,
  });

  final ChannelsRemoteDataSource dataSource;
  final String channelId;

  /// An optional already-loaded detail (from the list) so the header can render
  /// instantly while the fresh copy + posts load.
  final ChannelDetailView? initialDetail;

  final VoidCallback? onBack;

  /// Notifies the list to refresh subscription state when the viewer joins or
  /// leaves from inside this screen.
  final VoidCallback? onSubscriptionChanged;

  @override
  State<ChannelViewScreen> createState() => _ChannelViewScreenState();
}

class _ChannelViewScreenState extends State<ChannelViewScreen> {
  final _composerController = TextEditingController();

  ChannelDetailView? _detail;
  List<ChannelPostView> _posts = const [];
  bool _loading = true;
  bool _subscribeBusy = false;

  @override
  void initState() {
    super.initState();
    _detail = widget.initialDetail;
    _load();
  }

  @override
  void dispose() {
    _composerController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final channel = await widget.dataSource.fetchChannel(widget.channelId);
    final posts = await widget.dataSource.fetchPosts(widget.channelId);
    if (!mounted) return;
    setState(() {
      _detail = channel != null ? channelToDetail(channel) : _detail;
      _posts = channelPostsToViews(posts);
      _loading = false;
    });
  }

  Future<void> _toggleSubscribe() async {
    final detail = _detail;
    if (detail == null || _subscribeBusy) return;
    setState(() => _subscribeBusy = true);

    final ok = detail.isSubscribed
        ? await widget.dataSource.unsubscribe(detail.id)
        : await widget.dataSource.subscribe(detail.id);

    if (!mounted) return;
    if (!ok) {
      setState(() => _subscribeBusy = false);
      _toast('Could not update your subscription. Try again.');
      return;
    }

    final nowSubscribed = !detail.isSubscribed;
    setState(() {
      _detail = detail.copyWith(
        isSubscribed: nowSubscribed,
        viewerRole: nowSubscribed ? ChannelRole.subscriber : ChannelRole.none,
        subscriberCount:
            (detail.subscriberCount + (nowSubscribed ? 1 : -1))
                .clamp(0, 1 << 31),
      );
      _subscribeBusy = false;
    });
    widget.onSubscriptionChanged?.call();
  }

  Future<void> _publish() async {
    final detail = _detail;
    if (detail == null) return;
    final id = await widget.dataSource.publishPost(
      channelId: detail.id,
      content: _composerController.text,
    );
    if (!mounted) return;
    if (id == null) {
      _toast('Could not publish. Only admins can post here.');
      return;
    }
    _composerController.clear();
    await _load();
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      backgroundColor: ChannelColors.background,
      appBar: AppBar(
        backgroundColor: ChannelColors.card,
        elevation: 0,
        leading: widget.onBack != null
            ? IconButton(
                tooltip: 'Back',
                icon: const Icon(
                  Icons.arrow_back,
                  color: ChannelColors.foreground,
                ),
                onPressed: widget.onBack,
              )
            : null,
        title: Text(
          detail?.name ?? 'Channel',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: ChannelColors.foreground,
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              color: ChannelColors.primary,
              backgroundColor: ChannelColors.card,
              onRefresh: _load,
              child: _buildBody(detail),
            ),
          ),
          if (detail != null && detail.canPost)
            ChannelComposer(
              controller: _composerController,
              onPublish: _publish,
            ),
        ],
      ),
    );
  }

  Widget _buildBody(ChannelDetailView? detail) {
    if (detail == null) {
      if (_loading) {
        return const Center(
          child: CircularProgressIndicator(color: ChannelColors.primary),
        );
      }
      return _UnavailableState(onBack: widget.onBack);
    }

    // Header + feed in one scroll view. Posts are rendered oldest-first so the
    // newest broadcast sits at the bottom (Telegram-style); the data source
    // returns newest-first, so reverse for display.
    final ordered = _posts.reversed.toList();

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: ChannelSpacing.lg),
      itemCount: ordered.length + 2,
      itemBuilder: (context, index) {
        if (index == 0) {
          return ChannelHeader(
            channel: detail,
            subscribeBusy: _subscribeBusy,
            onToggleSubscribe: _toggleSubscribe,
          );
        }
        if (index == 1) {
          if (ordered.isEmpty && !_loading) {
            return _EmptyFeed(canPost: detail.canPost);
          }
          return const SizedBox(height: ChannelSpacing.sm);
        }
        final post = ordered[index - 2];
        if (post.isFirstOfDay) {
          return Column(
            children: [
              _DayDivider(label: channelDateHeader(post.createdAtMillis)),
              ChannelPostCard(post: post),
            ],
          );
        }
        return ChannelPostCard(post: post);
      },
    );
  }
}

class _DayDivider extends StatelessWidget {
  const _DayDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: ChannelSpacing.sm),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ChannelSpacing.md,
            vertical: 4,
          ),
          decoration: BoxDecoration(
            color: ChannelColors.secondary,
            borderRadius: ChannelRadii.chip,
          ),
          child: Text(label, style: ChannelTextStyles.timestamp),
        ),
      ),
    );
  }
}

class _EmptyFeed extends StatelessWidget {
  const _EmptyFeed({required this.canPost});

  final bool canPost;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ChannelSpacing.xl,
        vertical: 48,
      ),
      child: Column(
        children: [
          const Icon(
            Icons.campaign_outlined,
            size: 40,
            color: ChannelColors.mutedForeground,
          ),
          const SizedBox(height: ChannelSpacing.md),
          Text(
            canPost ? 'No broadcasts yet' : 'Nothing here yet',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: ChannelColors.foreground,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            canPost
                ? 'Post your first broadcast — subscribers will see it here.'
                : 'When the channel posts, it will show up here.',
            textAlign: TextAlign.center,
            style: ChannelTextStyles.previewMuted,
          ),
        ],
      ),
    );
  }
}

class _UnavailableState extends StatelessWidget {
  const _UnavailableState({this.onBack});

  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 96),
        const Icon(
          Icons.wifi_off_rounded,
          size: 40,
          color: ChannelColors.mutedForeground,
        ),
        const SizedBox(height: ChannelSpacing.md),
        const Center(
          child: Text(
            'Channel unavailable',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: ChannelColors.foreground,
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: ChannelSpacing.xl),
          child: Text(
            'This channel could not be loaded right now.',
            textAlign: TextAlign.center,
            style: ChannelTextStyles.previewMuted,
          ),
        ),
      ],
    );
  }
}
