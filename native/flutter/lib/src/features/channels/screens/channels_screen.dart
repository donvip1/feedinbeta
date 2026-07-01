import 'dart:async';

import 'package:flutter/material.dart';

import '../channels_theme.dart';
import '../data/channel_models.dart';
import '../data/channels_remote_data_source.dart';
import '../view_models/channel_view_models.dart';
import '../widgets/channel_list_tile.dart';
import '../widgets/create_channel_sheet.dart';
import 'channel_view_screen.dart';

/// Which tab of the channels browser is active.
enum _ChannelsTab { discover, mine }

/// Public entry point for the Telegram-style Channels feature.
///
/// A two-tab browser: **Discover** (searchable list of public channels to
/// subscribe to) and **My channels** (the ones the viewer already subscribes to
/// or owns). Each row has an inline Join / Joined toggle; tapping a row opens
/// the [ChannelViewScreen] broadcast view. A gradient "+" opens the
/// create-channel sheet.
///
/// This is the ONE public screen the coordinator wires into navigation (e.g. a
/// "Channels" entry reachable from the Chats/Messages surface, or its own nav
/// item). The Supabase-backed [ChannelsRemoteDataSource] self-detects
/// configuration via [autoDetect] when not supplied, and every backend call
/// degrades to honest empty / "coming soon" states — so this screen is safe to
/// mount even before the channel tables exist.
class ChannelsScreen extends StatefulWidget {
  const ChannelsScreen({
    super.key,
    this.currentUserId,
    this.dataSource,
    this.onBack,
  });

  /// The signed-in user's id. Optional: the data source resolves the auth user
  /// itself; this is accepted for symmetry with the other feature entries and
  /// future "owned by me" filtering.
  final String? currentUserId;

  /// Optional injected data source; defaults to
  /// [ChannelsRemoteDataSource.autoDetect].
  final ChannelsRemoteDataSource? dataSource;

  /// Optional back affordance. When null, no back button is shown (the screen
  /// is assumed to be a tab). When provided, a back button is rendered.
  final VoidCallback? onBack;

  @override
  State<ChannelsScreen> createState() => _ChannelsScreenState();
}

class _ChannelsScreenState extends State<ChannelsScreen> {
  static const Duration _debounce = Duration(milliseconds: 300);

  late final ChannelsRemoteDataSource _dataSource;
  final _searchController = TextEditingController();
  Timer? _debounceTimer;
  int _requestToken = 0;

  _ChannelsTab _tab = _ChannelsTab.discover;
  bool _loading = true;
  List<RemoteChannel> _discover = const [];
  List<RemoteChannel> _mine = const [];

  /// Channel ids with an in-flight subscribe/unsubscribe toggle.
  final Set<String> _busy = <String>{};

  @override
  void initState() {
    super.initState();
    _dataSource = widget.dataSource ?? ChannelsRemoteDataSource.autoDetect();
    _loadAll();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    final token = ++_requestToken;
    setState(() => _loading = true);
    final discover = await _dataSource.fetchDiscoverChannels(
      query: _searchController.text,
    );
    final mine = await _dataSource.fetchMyChannels();
    if (!mounted || token != _requestToken) return;
    setState(() {
      _discover = discover;
      _mine = mine;
      _loading = false;
    });
  }

  Future<void> _reloadDiscover() async {
    final token = ++_requestToken;
    final discover = await _dataSource.fetchDiscoverChannels(
      query: _searchController.text,
    );
    if (!mounted || token != _requestToken) return;
    setState(() => _discover = discover);
  }

  void _onQueryChanged(String raw) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounce, _reloadDiscover);
  }

  Future<void> _toggleSubscribe(RemoteChannel channel) async {
    if (_busy.contains(channel.id)) return;
    if (!_dataSource.hasSession) {
      _toast('Sign in to subscribe to channels.');
      return;
    }
    setState(() => _busy.add(channel.id));

    final ok = channel.isSubscribed
        ? await _dataSource.unsubscribe(channel.id)
        : await _dataSource.subscribe(channel.id);

    if (!mounted) return;
    if (!ok) {
      setState(() => _busy.remove(channel.id));
      _toast('Could not update your subscription. Try again.');
      return;
    }

    setState(() {
      _busy.remove(channel.id);
      final nowSubscribed = !channel.isSubscribed;
      final updated = channel.copyWith(
        isSubscribed: nowSubscribed,
        viewerRole: nowSubscribed
            ? ChannelsRemoteDataSource.roleSubscriber
            : null,
        subscriberCount:
            (channel.subscriberCount + (nowSubscribed ? 1 : -1))
                .clamp(0, 1 << 31),
      );
      _discover = _replace(_discover, updated);
      // Owned channels stay in "mine" regardless; others come/go on subscribe.
      if (nowSubscribed) {
        if (!_mine.any((c) => c.id == updated.id)) {
          _mine = [updated, ..._mine];
        } else {
          _mine = _replace(_mine, updated);
        }
      } else if (updated.viewerRole != ChannelsRemoteDataSource.roleOwner) {
        _mine = _mine.where((c) => c.id != updated.id).toList();
      }
    });
  }

  static List<RemoteChannel> _replace(
    List<RemoteChannel> list,
    RemoteChannel updated,
  ) {
    return [
      for (final c in list)
        if (c.id == updated.id) updated else c,
    ];
  }

  void _openChannel(RemoteChannel channel) {
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => ChannelViewScreen(
              dataSource: _dataSource,
              channelId: channel.id,
              initialDetail: channelToDetail(channel),
              onBack: () => Navigator.of(context).pop(),
              onSubscriptionChanged: _loadAll,
            ),
          ),
        )
        .then((_) => _loadAll());
  }

  void _openCreate() {
    if (!_dataSource.hasSession) {
      _toast('Sign in to create a channel.');
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: ChannelColors.barrier,
      builder: (sheetContext) => CreateChannelSheet(
        onCreate: (result) async {
          Navigator.of(sheetContext).pop();
          final id = await _dataSource.createChannel(
            name: result.name,
            description: result.description,
            avatarUrl: result.avatarUrl,
            slug: result.slug,
          );
          if (!mounted) return;
          if (id == null) {
            _toast('Could not create the channel. Try again.');
            return;
          }
          await _loadAll();
          if (!mounted) return;
          final created = await _dataSource.fetchChannel(id);
          if (!mounted || created == null) return;
          _openChannel(created);
        },
      ),
    );
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: ChannelColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(onBack: widget.onBack, onCreate: _openCreate),
            _SearchBar(
              controller: _searchController,
              onChanged: _onQueryChanged,
            ),
            _Tabs(
              tab: _tab,
              mineCount: _mine.length,
              onChanged: (tab) => setState(() => _tab = tab),
            ),
            Expanded(
              child: RefreshIndicator(
                color: ChannelColors.primary,
                backgroundColor: ChannelColors.card,
                onRefresh: _loadAll,
                child: _buildList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: ChannelColors.primary),
      );
    }

    final source = _tab == _ChannelsTab.discover ? _discover : _mine;
    if (source.isEmpty) {
      return _EmptyState(
        tab: _tab,
        onCreate: _openCreate,
        searching: _searchController.text.trim().isNotEmpty,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(
        top: ChannelSpacing.xs,
        bottom: ChannelSpacing.xl,
      ),
      itemCount: source.length,
      itemBuilder: (context, index) {
        final channel = source[index];
        final isOwner =
            channel.viewerRole == ChannelsRemoteDataSource.roleOwner;
        return ChannelListTile(
          channel: channelToListItem(channel),
          subscribeBusy: _busy.contains(channel.id),
          // Owners can't "unsubscribe" from their own channel via the row.
          showSubscribeButton: !isOwner,
          onTap: () => _openChannel(channel),
          onToggleSubscribe: () => _toggleSubscribe(channel),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onCreate, this.onBack});

  final VoidCallback onCreate;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChannelSpacing.lg,
        ChannelSpacing.md,
        ChannelSpacing.sm,
        ChannelSpacing.sm,
      ),
      child: Row(
        children: [
          if (onBack != null)
            Padding(
              padding: const EdgeInsets.only(right: ChannelSpacing.xs),
              child: IconButton(
                onPressed: onBack,
                tooltip: 'Back',
                icon: const Icon(
                  Icons.arrow_back,
                  color: ChannelColors.foreground,
                ),
              ),
            ),
          const Expanded(
            child: Text('Channels', style: ChannelTextStyles.screenTitle),
          ),
          DecoratedBox(
            decoration: const BoxDecoration(
              gradient: ChannelGradients.sendAction,
              shape: BoxShape.circle,
              boxShadow: ChannelShadows.pink,
            ),
            child: IconButton(
              tooltip: 'New channel',
              onPressed: onCreate,
              icon: const Icon(
                Icons.add_rounded,
                color: ChannelColors.primaryForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChannelSpacing.md,
        ChannelSpacing.xs,
        ChannelSpacing.md,
        ChannelSpacing.sm,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: ChannelColors.input,
          borderRadius: BorderRadius.circular(ChannelRadii.pill),
        ),
        padding: const EdgeInsets.symmetric(horizontal: ChannelSpacing.md),
        child: Row(
          children: [
            const Icon(
              Icons.search_rounded,
              size: 20,
              color: ChannelColors.mutedForeground,
            ),
            const SizedBox(width: ChannelSpacing.sm),
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                cursorColor: ChannelColors.primary,
                style: const TextStyle(
                  fontSize: 15,
                  color: ChannelColors.foreground,
                ),
                decoration: const InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  hintText: 'Search channels',
                  hintStyle: TextStyle(
                    fontSize: 15,
                    color: ChannelColors.mutedForeground,
                  ),
                  contentPadding: EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.tab,
    required this.mineCount,
    required this.onChanged,
  });

  final _ChannelsTab tab;
  final int mineCount;
  final ValueChanged<_ChannelsTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChannelSpacing.md,
        0,
        ChannelSpacing.md,
        ChannelSpacing.sm,
      ),
      child: Row(
        children: [
          _TabButton(
            label: 'Discover',
            selected: tab == _ChannelsTab.discover,
            onTap: () => onChanged(_ChannelsTab.discover),
          ),
          const SizedBox(width: ChannelSpacing.sm),
          _TabButton(
            label: mineCount > 0 ? 'My channels ($mineCount)' : 'My channels',
            selected: tab == _ChannelsTab.mine,
            onTap: () => onChanged(_ChannelsTab.mine),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: ChannelRadii.chip,
      child: InkWell(
        onTap: onTap,
        borderRadius: ChannelRadii.chip,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ChannelSpacing.md,
            vertical: ChannelSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? ChannelColors.primarySoft : Colors.transparent,
            borderRadius: ChannelRadii.chip,
            border: Border.all(
              color: selected ? ChannelColors.primary : ChannelColors.border,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected
                  ? ChannelColors.foreground
                  : ChannelColors.mutedForeground,
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.tab,
    required this.onCreate,
    required this.searching,
  });

  final _ChannelsTab tab;
  final VoidCallback onCreate;
  final bool searching;

  @override
  Widget build(BuildContext context) {
    final isMine = tab == _ChannelsTab.mine;
    final title = searching
        ? 'No channels found'
        : isMine
        ? 'No channels yet'
        : 'No channels to discover';
    final body = searching
        ? 'Try a different search term.'
        : isMine
        ? 'Subscribe to channels or create your own to see them here.'
        : 'Channels are coming soon. Create the first one to get started.';

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(ChannelSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 84,
                      height: 84,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ChannelColors.primaryFaint,
                        boxShadow: ChannelShadows.glow,
                      ),
                      child: Container(
                        width: 60,
                        height: 60,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: ChannelGradients.sendAction,
                          boxShadow: ChannelShadows.pink,
                        ),
                        child: const Icon(
                          Icons.campaign_rounded,
                          size: 28,
                          color: ChannelColors.primaryForeground,
                        ),
                      ),
                    ),
                    const SizedBox(height: ChannelSpacing.lg),
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        color: ChannelColors.foreground,
                      ),
                    ),
                    const SizedBox(height: ChannelSpacing.sm),
                    Text(
                      body,
                      textAlign: TextAlign.center,
                      style: ChannelTextStyles.previewMuted,
                    ),
                    if (!searching) ...[
                      const SizedBox(height: ChannelSpacing.lg),
                      _CreateButton(onTap: onCreate),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CreateButton extends StatelessWidget {
  const _CreateButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(ChannelRadii.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ChannelRadii.md),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ChannelSpacing.xl,
            vertical: ChannelSpacing.md,
          ),
          decoration: BoxDecoration(
            gradient: ChannelGradients.sendAction,
            borderRadius: BorderRadius.circular(ChannelRadii.md),
            boxShadow: ChannelShadows.pink,
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.add_rounded,
                size: 18,
                color: ChannelColors.primaryForeground,
              ),
              SizedBox(width: ChannelSpacing.sm),
              Text(
                'New channel',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: ChannelColors.primaryForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
