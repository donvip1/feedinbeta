import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/connectivity/connectivity_service.dart';
import '../../core/connectivity/offline_notice.dart';
import '../../core/notifications/callkit_service.dart';
import '../../core/notifications/local_notifications_service.dart';
import '../../core/notifications/pending_reply_store.dart';
import '../../core/notifications/push_notification_service.dart';
import '../../core/realtime/feedin_realtime_service.dart';
import '../../core/storage/local_storage_maintenance.dart';
import '../../core/storage/storage_diagnostics_service.dart';
import '../../core/sync/conversation_starter.dart';
import '../../core/sync/foreground_sync_coordinator.dart';
import '../../core/sync/sync_service.dart';
import '../../core/sync/upload_queue_service.dart';
import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../../data/local/notification_repository_contract.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../../data/local/post_draft_repository.dart';
import '../../data/local/profile_repository_contract.dart';
import '../../data/local/upload_queue_repository.dart';
import '../../core/media/reel_preloader.dart';
import '../../data/remote/post_views_remote_data_source.dart';
import '../calls/call_controller.dart';
import '../calls/call_screen.dart';
import '../calls/livekit_call_media_engine.dart';
import '../channels/screens/channels_screen.dart';
import '../contacts/contacts_screen.dart';
import '../groups/screens/groups_screen.dart';
import '../live/live_screen.dart';
import '../wallet/wallet_screen.dart';
import '../create/create_post_screen.dart';
import '../messages/messages_screen.dart';
import '../notifications/parity/notifications_view_models.dart';
import '../notifications/parity/widgets/notification_bell_badge.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../profile/user_profile.dart';
import '../settings/settings_screen.dart';
import 'feed_post.dart';
import 'immersive/feed_immersive_theme.dart';
import 'immersive/immersive_post_card.dart';

class FeedShell extends StatefulWidget {
  const FeedShell({
    super.key,
    required this.displayName,
    required this.profile,
    required this.feedRepository,
    required this.messagesRepository,
    required this.notificationRepository,
    required this.preferencesRepository,
    required this.conversationStarter,
    required this.profileRepository,
    required this.postDraftRepository,
    required this.uploadQueueRepository,
    required this.syncService,
    required this.uploadQueueService,
    required this.foregroundSyncCoordinator,
    required this.storageDiagnosticsService,
    required this.realtimeService,
    required this.storageMaintenance,
    required this.pushNotificationService,
    required this.localNotificationsService,
    required this.callKitService,
    required this.connectivityService,
    required this.onSignOut,
  });

  final String displayName;
  final UserProfile profile;
  final LocalFeedRepositoryContract feedRepository;
  final LocalMessagesRepositoryContract messagesRepository;
  final NotificationRepositoryContract notificationRepository;
  final PreferencesRepositoryContract preferencesRepository;
  final ConversationStarter conversationStarter;
  final ProfileRepositoryContract profileRepository;
  final PostDraftRepository postDraftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final SyncServiceContract syncService;
  final UploadQueueService uploadQueueService;
  final ForegroundSyncCoordinator foregroundSyncCoordinator;
  final StorageDiagnosticsService storageDiagnosticsService;
  final FeedinRealtimeService realtimeService;
  final LocalStorageMaintenance storageMaintenance;
  final PushNotificationService pushNotificationService;
  final LocalNotificationsService localNotificationsService;
  final CallKitService callKitService;
  final ConnectivityService connectivityService;
  final VoidCallback onSignOut;

  @override
  State<FeedShell> createState() => _FeedShellState();
}

class _FeedShellState extends State<FeedShell> with WidgetsBindingObserver {
  int _index = 0;
  bool _showNotifications = false;
  late final StreamSubscription<FeedinRealtimeEvent> _realtimeSubscription;
  StreamSubscription<String>? _pushTapSub;
  StreamSubscription<String>? _localTapSub;
  StreamSubscription<PendingReply>? _replySub;
  StreamSubscription<CallKitAction>? _callKitSub;
  int _feedRealtimeVersion = 0;
  int _messagesRealtimeVersion = 0;
  int _newConversationRequests = 0;
  String? _initialConversationId;
  final FeedScreenBackController _feedBackController =
      FeedScreenBackController();
  final MessagesScreenBackController _messagesBackController =
      MessagesScreenBackController();
  final List<int> _tabHistory = <int>[];
  int _homeBackTapCount = 0;
  DateTime? _lastHomeBackTapAt;
  late UserProfile _profile;
  late Future<int> _notificationUnreadCountFuture;

  /// Shared, long-lived call controller: drives both outgoing calls placed from
  /// a chat header and the app-wide incoming-call presenter below.
  late final CallController _callController;
  bool _callRouteOpen = false;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    WidgetsBinding.instance.addObserver(this);
    _notificationUnreadCountFuture = widget.notificationRepository
        .unreadCount();
    _realtimeSubscription = widget.realtimeService.events.listen(
      _handleRealtimeEvent,
    );
    _connectRealtime();
    // No periodic auto-replay: online actions flush immediately and offline
    // actions are hard-blocked (never queued), so there is no backlog to drain.
    // Live message refresh still arrives via [realtimeService] below.
    unawaited(_initPush());
    _initLocalNotificationsAndCalls();
    // Real 1:1 call media over LiveKit (SFU + managed TURN), matching the web
    // app. The engine fetches a short-lived token from the server-owned
    // `livekit-token` edge function (the app holds no LiveKit secret) and joins
    // room `call-<callId>`. Requires that function + LIVEKIT_* secrets deployed
    // on the project; until then the call UI shows "connection failed" + retry.
    _callController = CallController(mediaEngine: LiveKitCallMediaEngine());
    _callController.addListener(_handleCallControllerChange);
    unawaited(_callController.init());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _realtimeSubscription.cancel();
    _pushTapSub?.cancel();
    _localTapSub?.cancel();
    _replySub?.cancel();
    _callKitSub?.cancel();
    widget.realtimeService.disconnect();
    _callController.removeListener(_handleCallControllerChange);
    _callController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Replies typed into a message notification while we were backgrounded /
    // killed are parked in [PendingReplyStore]; flush them the moment we're back.
    if (state == AppLifecycleState.resumed) {
      unawaited(_drainPendingReplies());
    }
  }

  /// App-wide incoming-call presenter: when the shared [CallController] surfaces
  /// a ringing incoming call, push the full-screen [CallScreen] (which shows the
  /// accept/decline UI). Guarded so only one incoming route is ever open; the
  /// flag resets when the route pops (after the call ends and the controller
  /// returns to idle, auto-popping the screen). Outgoing calls push their own
  /// route via [CallScreen.start] and never set [incomingCall], so they don't
  /// double-present here.
  void _handleCallControllerChange() {
    if (!mounted) return;
    // Auto-present only for a freshly *ringing incoming* call — outgoing calls
    // push their own route via [CallScreen.start], so presenting on hasActiveCall
    // here would double-present them. Calls accepted from the native CallKit
    // screen are presented explicitly by [_handleCallKitAction].
    if (_callController.incomingCall != null) {
      _presentCallScreen();
    }
  }

  /// Push the shared full-screen [CallScreen]. Guarded so only one call route is
  /// ever open; the flag resets when the route pops (the controller returns to
  /// idle and auto-pops the screen).
  void _presentCallScreen() {
    if (!mounted || _callRouteOpen) return;
    _callRouteOpen = true;
    Navigator.of(context, rootNavigator: true)
        .push(
          MaterialPageRoute<void>(
            fullscreenDialog: true,
            builder: (_) => CallScreen(controller: _callController),
          ),
        )
        .whenComplete(() => _callRouteOpen = false);
  }

  /// Set up the rich local-notification + native-call plumbing once the shell is
  /// mounted: route notification taps into the existing deep-link handler, flush
  /// any queued notification replies, and reconcile native CallKit accept/decline
  /// actions with the shared [CallController].
  void _initLocalNotificationsAndCalls() {
    final local = widget.localNotificationsService;
    final callKit = widget.callKitService;
    unawaited(local.initialize());
    callKit.initialize();
    _localTapSub = local.notificationTaps.listen(_openNotificationRoute);
    _replySub = local.replies.listen(_sendReply);
    _callKitSub = callKit.actions.listen(_handleCallKitAction);
    // A tap on a notification that cold-started the app, plus any replies parked
    // while we were away.
    unawaited(_consumeLocalInitialRoute());
    unawaited(_drainPendingReplies());
  }

  Future<void> _consumeLocalInitialRoute() async {
    final route = await widget.localNotificationsService.initialRoute();
    if (route != null && mounted) _openNotificationRoute(route);
  }

  Future<void> _handleCallKitAction(CallKitAction action) async {
    switch (action.kind) {
      case CallKitActionKind.accept:
        final session = await _callController.acceptIncomingById(action.callId);
        if (session != null && mounted) {
          _presentCallScreen();
        }
        break;
      case CallKitActionKind.decline:
      case CallKitActionKind.timeout:
        await _callController.declineIncomingById(action.callId);
        break;
      case CallKitActionKind.ended:
        // Native UI reports the call finished; nothing to reconcile beyond what
        // the controller's own teardown already handles.
        break;
    }
  }

  /// Flush queued notification replies through the normal local-first send path.
  Future<void> _drainPendingReplies() async {
    final replies = await const PendingReplyStore().drain();
    for (final reply in replies) {
      await _sendReply(reply);
    }
  }

  Future<void> _sendReply(PendingReply reply) async {
    await widget.messagesRepository.queueMessage(
      conversationId: reply.conversationId,
      senderName: _profile.displayName,
      senderId: _profile.userId.isEmpty ? null : _profile.userId,
      senderAvatarUrl: _profile.avatarUrl,
      body: reply.body,
    );
    await widget.syncService.syncNow();
    if (!mounted) return;
    setState(() => _messagesRealtimeVersion++);
  }

  Future<void> _connectRealtime() async {
    await widget.realtimeService.connect();
  }

  /// Set up push notifications once the authenticated shell is mounted: request
  /// permission, register this device's FCM token for the user, and route
  /// notification taps (foreground/background/terminated) into the existing
  /// notification deep-link handler.
  Future<void> _initPush() async {
    final push = widget.pushNotificationService;
    await push.initialize();
    await push.registerForUser();
    if (!mounted) return;
    _pushTapSub = push.notificationTaps.listen(_openNotificationRoute);
    final initialRoute = await push.initialRoute();
    if (initialRoute != null && mounted) {
      _openNotificationRoute(initialRoute);
    }
  }

  void _handleRealtimeEvent(FeedinRealtimeEvent event) {
    if (!mounted) return;
    switch (event.type) {
      case FeedinRealtimeEventType.postChanged:
        setState(() {
          _feedRealtimeVersion++;
        });
      case FeedinRealtimeEventType.messageChanged:
        unawaited(_refreshMessagesAfterRealtimeEvent());
      case FeedinRealtimeEventType.notificationChanged:
        _refreshNotificationBadge();
    }
  }

  Future<void> _refreshMessagesAfterRealtimeEvent() async {
    await widget.syncService.syncNow();
    if (!mounted) return;
    setState(() => _messagesRealtimeVersion++);
  }

  void _refreshNotificationBadge() {
    if (!mounted) return;
    setState(() {
      _notificationUnreadCountFuture = widget.notificationRepository
          .unreadCount();
    });
  }

  void _toggleNotifications() {
    setState(() {
      _showNotifications = !_showNotifications;
      _notificationUnreadCountFuture = widget.notificationRepository
          .unreadCount();
    });
  }

  void _showNotificationsScreen() {
    setState(() {
      _showNotifications = true;
      _notificationUnreadCountFuture = widget.notificationRepository
          .unreadCount();
    });
  }

  void _openNotificationRoute(String route) {
    final conversationId = _conversationIdFromRoute(route);
    if (conversationId != null) {
      // Opening the thread clears its collapsed notification group.
      unawaited(
        widget.localNotificationsService.clearConversation(conversationId),
      );
      setState(() {
        _selectTabState(1);
        _initialConversationId = conversationId;
        _messagesRealtimeVersion++;
      });
    }
  }

  String? _conversationIdFromRoute(String route) {
    final value = route.trim();
    if (value.startsWith('conversation:')) {
      return value.substring('conversation:'.length).trim();
    }
    if (value.startsWith('/messages/')) {
      return value.substring('/messages/'.length).trim();
    }
    if (value.startsWith('feedin://messages/')) {
      return value.substring('feedin://messages/'.length).trim();
    }
    return null;
  }

  /// Create is a floating "+" action (web parity), pushed as a full route.
  Future<void> _openCreate() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Create')),
          body: CreatePostScreen(
            draftRepository: widget.postDraftRepository,
            uploadQueueRepository: widget.uploadQueueRepository,
            uploadQueueService: widget.uploadQueueService,
            connectivityService: widget.connectivityService,
            onPostUploaded: () => setState(() => _feedRealtimeVersion++),
          ),
        ),
      ),
    );
  }

  /// Settings lives under Profile (web parity), pushed as a full route.
  void _openSettings() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Settings')),
          body: SettingsScreen(
            preferencesRepository: widget.preferencesRepository,
            storageMaintenance: widget.storageMaintenance,
            onSignOut: widget.onSignOut,
          ),
        ),
      ),
    );
  }

  /// Groups (group conversations) — reachable from the Chats tab app bar. A
  /// group's "Go Live" action opens the group-scoped go-live sheet (plan.md §E).
  void _openGroups() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeCtx) => Scaffold(
          backgroundColor: Colors.black,
          body: GroupsScreen(
            currentUserId: _profile.userId,
            onBack: () => Navigator.of(routeCtx).pop(),
            onGoLive: ({required conversationId, required groupTitle}) {
              showGoLiveSheet(
                routeCtx,
                groupId: conversationId,
                groupName: groupTitle,
              );
            },
          ),
        ),
      ),
    );
  }

  /// Find friends from contacts (hashed matching) — reachable from the Chats
  /// tab app bar.
  void _openContacts() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeCtx) => Scaffold(
          backgroundColor: Colors.black,
          body: ContactsScreen(
            currentUserId: _profile.userId,
            onBack: () => Navigator.of(routeCtx).pop(),
          ),
        ),
      ),
    );
  }

  /// Channels (Telegram-style broadcast channels) — reachable from the Chats
  /// tab app bar, alongside Groups.
  void _openChannels() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeCtx) => Scaffold(
          backgroundColor: Colors.black,
          body: ChannelsScreen(
            currentUserId: _profile.userId,
            onBack: () => Navigator.of(routeCtx).pop(),
          ),
        ),
      ),
    );
  }

  /// The shared search affordance should land on an actionable search surface.
  /// Reuse the Messages tab's existing recipient search/new-chat sheet so the
  /// feed/home search icon no longer appears inert.
  void _openSearch() {
    setState(() {
      _selectTabState(1);
      _initialConversationId = null;
      _newConversationRequests++;
    });
  }

  void _selectTabState(int value) {
    if (value == _index) {
      _showNotifications = false;
      _resetHomeBackTaps();
      return;
    }
    _tabHistory.remove(value);
    _tabHistory.add(_index);
    if (_tabHistory.length > 8) {
      _tabHistory.removeAt(0);
    }
    _showNotifications = false;
    _index = value;
    _resetHomeBackTaps();
  }

  void _selectTab(int value) {
    setState(() => _selectTabState(value));
  }

  void _resetHomeBackTaps() {
    _homeBackTapCount = 0;
    _lastHomeBackTapAt = null;
  }

  void _goToPreviousTabOrHome() {
    final previousTab = _tabHistory.isEmpty ? 0 : _tabHistory.removeLast();
    setState(() {
      _showNotifications = false;
      _index = previousTab;
      _resetHomeBackTaps();
    });
  }

  Future<void> _handleAndroidBack() async {
    if (_showNotifications) {
      setState(() {
        _showNotifications = false;
        _resetHomeBackTaps();
      });
      return;
    }

    if (_index == 1 && _messagesBackController.navigateBack()) {
      _resetHomeBackTaps();
      return;
    }

    if (_index == 0 && _feedBackController.navigateBack()) {
      _resetHomeBackTaps();
      return;
    }

    if (_index != 0) {
      _goToPreviousTabOrHome();
      return;
    }

    final now = DateTime.now();
    if (_lastHomeBackTapAt == null ||
        now.difference(_lastHomeBackTapAt!) > const Duration(seconds: 2)) {
      _homeBackTapCount = 0;
    }
    _lastHomeBackTapAt = now;
    _homeBackTapCount++;

    if (_homeBackTapCount >= 3) {
      await SystemNavigator.pop();
      return;
    }

    if (!mounted) return;
    final remainingTaps = 3 - _homeBackTapCount;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 1),
          content: Text(
            remainingTaps == 1
                ? 'Press back once more to exit.'
                : 'Press back $remainingTaps more times to exit.',
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      FeedScreen(
        feedRepository: widget.feedRepository,
        syncService: widget.syncService,
        connectivityService: widget.connectivityService,
        realtimeVersion: _feedRealtimeVersion,
        onOpenNotifications: _showNotificationsScreen,
        onOpenSearch: _openSearch,
        backController: _feedBackController,
        notificationUnreadCountFuture: _notificationUnreadCountFuture,
      ),
      MessagesScreen(
        messagesRepository: widget.messagesRepository,
        conversationStarter: widget.conversationStarter,
        syncService: widget.syncService,
        connectivityService: widget.connectivityService,
        profile: _profile,
        realtimeVersion: _messagesRealtimeVersion,
        initialConversationId: _initialConversationId,
        newConversationRequest: _newConversationRequests,
        callController: _callController,
        backController: _messagesBackController,
      ),
      const WalletScreen(),
      ProfileScreen(
        profile: _profile,
        profileRepository: widget.profileRepository,
        feedRepository: widget.feedRepository,
        syncService: widget.syncService,
        connectivityService: widget.connectivityService,
        onEditSaved: (profile) => setState(() => _profile = profile),
        onOpenSettings: _openSettings,
      ),
    ];

    // The feed (immersive) and Wallet both draw their own chrome, so the shared
    // AppBar is hidden while either is on screen.
    final immersiveFeed = _index == 0 && !_showNotifications;
    // Feed (immersive), Wallet (index 2) and the redesigned Profile (index 3)
    // each draw their own chrome/header, so the shared AppBar is hidden there.
    final hideAppBar =
        immersiveFeed || ((_index == 2 || _index == 3) && !_showNotifications);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        unawaited(_handleAndroidBack());
      },
      child: Scaffold(
        backgroundColor: immersiveFeed ? Colors.black : null,
        appBar: hideAppBar
            ? null
            : AppBar(
                toolbarHeight: 64,
                title: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'feedIn',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0,
                      ),
                    ),
                    Text(
                      _profile.displayName,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                actions: [
                  IconButton(
                    tooltip: 'Search',
                    onPressed: _openSearch,
                    icon: const Icon(Icons.search),
                  ),
                  if (_index == 1) ...[
                    IconButton(
                      tooltip: 'Find contacts',
                      onPressed: _openContacts,
                      icon: const Icon(Icons.contacts_outlined),
                    ),
                    IconButton(
                      tooltip: 'Channels',
                      onPressed: _openChannels,
                      icon: const Icon(Icons.campaign_outlined),
                    ),
                    IconButton(
                      tooltip: 'Groups',
                      onPressed: _openGroups,
                      icon: const Icon(Icons.groups_2_outlined),
                    ),
                  ],
                  _NotificationBellAction(
                    unreadCountFuture: _notificationUnreadCountFuture,
                    onTap: _toggleNotifications,
                  ),
                ],
              ),
        body: _showNotifications
            ? NotificationsScreen(
                notificationRepository: widget.notificationRepository,
                onOpenRoute: _openNotificationRoute,
                onChanged: _refreshNotificationBadge,
              )
            : pages[_index],
        bottomNavigationBar: _FeedBottomNavigation(
          selectedIndex: _index,
          onSelected: _selectTab,
          onCreate: _openCreate,
        ),
      ),
    );
  }
}

class _FeedBottomNavigation extends StatelessWidget {
  const _FeedBottomNavigation({
    required this.selectedIndex,
    required this.onSelected,
    required this.onCreate,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Material(
        elevation: 8,
        color: scheme.surface,
        child: SizedBox(
          height: 70,
          child: Row(
            children: [
              _BottomNavItem(
                label: 'Feed',
                icon: Icons.home_outlined,
                selectedIcon: Icons.home,
                selected: selectedIndex == 0,
                onTap: () => onSelected(0),
              ),
              _BottomNavItem(
                label: 'Chats',
                icon: Icons.mail_outline,
                selectedIcon: Icons.mail,
                selected: selectedIndex == 1,
                onTap: () => onSelected(1),
              ),
              Expanded(
                child: Center(child: _CreateNavButton(onTap: onCreate)),
              ),
              _BottomNavItem(
                label: 'Wallet',
                icon: Icons.account_balance_wallet_outlined,
                selectedIcon: Icons.account_balance_wallet,
                selected: selectedIndex == 2,
                onTap: () => onSelected(2),
              ),
              _BottomNavItem(
                label: 'Profile',
                icon: Icons.person_outline,
                selectedIcon: Icons.person,
                selected: selectedIndex == 3,
                onTap: () => onSelected(3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomNavItem extends StatelessWidget {
  const _BottomNavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = selected ? scheme.primary : scheme.onSurfaceVariant;
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(selected ? selectedIcon : icon, color: color, size: 24),
                const SizedBox(height: 4),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CreateNavButton extends StatelessWidget {
  const _CreateNavButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Create',
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Ink(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: FeedImmersiveTheme.brandGradient,
              boxShadow: [
                BoxShadow(
                  color: Color(0x59FF3D9A),
                  blurRadius: 14,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.add, color: Colors.white, size: 28),
          ),
        ),
      ),
    );
  }
}

class _NotificationBellAction extends StatelessWidget {
  const _NotificationBellAction({
    required this.unreadCountFuture,
    required this.onTap,
    this.foregroundColor,
  });

  final Future<int> unreadCountFuture;
  final VoidCallback onTap;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<int>(
      future: unreadCountFuture,
      builder: (context, snapshot) {
        final count = snapshot.data ?? 0;
        final bell = NotificationBellBadge(
          viewModel: NotificationBellViewModel(unreadCount: count),
          onTap: onTap,
          pulse: count > 0,
          foregroundColor: foregroundColor,
        );

        return bell;
      },
    );
  }
}

class FeedScreenBackController {
  VoidCallback? _activeBackHandler;

  bool navigateBack() {
    final handler = _activeBackHandler;
    if (handler == null) return false;
    handler();
    return true;
  }

  void setActiveBackHandler(VoidCallback? handler) {
    _activeBackHandler = handler;
  }
}

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    super.key,
    required this.feedRepository,
    required this.syncService,
    required this.connectivityService,
    required this.realtimeVersion,
    required this.onOpenNotifications,
    required this.onOpenSearch,
    required this.backController,
    required this.notificationUnreadCountFuture,
  });

  final LocalFeedRepositoryContract feedRepository;
  final SyncServiceContract syncService;
  final ConnectivityService connectivityService;
  final int realtimeVersion;
  final VoidCallback onOpenNotifications;
  final VoidCallback onOpenSearch;
  final FeedScreenBackController backController;
  final Future<int> notificationUnreadCountFuture;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late Future<List<FeedPost>> _postsFuture;
  final PageController _pageController = PageController();
  final PostViewsRemoteDataSource _postViews =
      PostViewsRemoteDataSource.autoDetect();
  String? _message;
  int _tabIndex = 0;
  int _activePage = 0;
  bool _isLoadingMore = false;
  bool _hasMorePosts = true;
  final Set<String> _savedPostIds = {};
  final Set<String> _likedPostIds = {};
  // Posts whose view has been recorded this session, so a post is counted once
  // even if it scrolls in and out of focus.
  final Set<String> _recordedViewIds = {};

  @override
  void initState() {
    super.initState();
    _postsFuture = _initialLoad();
    _syncBackController();
  }

  @override
  void dispose() {
    widget.backController.setActiveBackHandler(null);
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant FeedScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.backController != widget.backController) {
      oldWidget.backController.setActiveBackHandler(null);
      _syncBackController();
    }
    if (oldWidget.realtimeVersion != widget.realtimeVersion) {
      _reloadAfterRealtimeEvent();
    }
  }

  void _syncBackController() {
    widget.backController.setActiveBackHandler(
      _tabIndex == 0 ? null : _returnToReelsTab,
    );
  }

  void _returnToReelsTab() {
    setState(() {
      _tabIndex = 0;
      _activePage = 0;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
    });
    _syncBackController();
  }

  Future<void> _reloadAfterRealtimeEvent() async {
    final result = await widget.feedRepository.refresh();
    if (!mounted) return;
    setState(() {
      _postsFuture = Future.value(result.posts);
      _message = 'New feed activity synced.';
    });
  }

  Future<List<FeedPost>> _initialLoad() async {
    final cachedPosts = await widget.feedRepository.loadPosts();
    final result = await widget.feedRepository.refresh();
    if (!mounted) return result.posts.isNotEmpty ? result.posts : cachedPosts;

    setState(() {
      _message = result.message;
      _hasMorePosts = result.usedRemote;
    });

    return result.posts.isNotEmpty ? result.posts : cachedPosts;
  }

  Future<void> _refresh() async {
    final result = await widget.feedRepository.refresh();
    if (!mounted) return;
    setState(() {
      _postsFuture = Future.value(result.posts);
      _message = result.message ?? 'Feed refreshed.';
      _hasMorePosts = result.usedRemote;
    });
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMorePosts) return;
    setState(() {
      _isLoadingMore = true;
      _message = null;
    });

    final result = await widget.feedRepository.loadMorePosts();
    if (!mounted) return;
    setState(() {
      _isLoadingMore = false;
      _hasMorePosts = result.hasMore;
      _postsFuture = Future.value(result.posts);
      _message = result.message;
    });
  }

  /// Whether the device currently has connectivity. Online actions are
  /// hard-blocked when offline (modern-social behaviour — nothing is queued for
  /// later); only cached reads work offline.
  bool get _isOnline => widget.connectivityService.isOnline;

  /// Show the standard "you're offline" affordance and return false when the
  /// device is offline; return true when it's safe to proceed with a write.
  bool _requireOnline() {
    if (_isOnline) return true;
    showOfflineSnackBar(context);
    return false;
  }

  /// Run an online write, then flush immediately so it is sent now (not queued
  /// for "later"). Blocks with the offline affordance when there's no network.
  Future<void> _runOnlineAction(Future<void> Function() action) async {
    if (!_requireOnline()) return;
    await action();
    await widget.syncService.syncNow();
  }

  Future<void> _likePost(FeedPost post) async {
    if (!_requireOnline()) return;
    if (!_likedPostIds.contains(post.id)) {
      setState(() => _likedPostIds.add(post.id));
    }
    await widget.feedRepository.queueLike(post.id);
    await widget.syncService.syncNow();
  }

  /// Pull the next page in once the viewer nears the end of the loaded feed.
  void _maybeLoadMore(int index, int loadedCount) {
    if (index >= loadedCount - 2) {
      _loadMore();
    }
  }

  /// Best-effort record that [post] was viewed. De-duplicated per session so a
  /// post is counted once, and never allowed to disrupt the feed (the data
  /// source swallows remote errors).
  void _recordView(FeedPost post) {
    if (!_recordedViewIds.add(post.id)) return;
    unawaited(_postViews.recordView(post.id));
  }

  void _onTabChanged(int value) {
    if (value == _tabIndex) return;
    setState(() {
      _tabIndex = value;
      _activePage = 0;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
    });
    _syncBackController();
  }

  Future<void> _savePost(FeedPost post) async {
    if (!_requireOnline()) return;
    await widget.feedRepository.queueSave(post.id);
    await widget.syncService.syncNow();
    if (!mounted) return;
    setState(() {
      _savedPostIds.add(post.id);
      _message = 'Post saved.';
    });
  }

  Future<void> _sharePost(FeedPost post) async {
    // Copying the share text is a local action and stays available offline;
    // recording the share event to the backend requires connectivity.
    final text = _shareTextForPost(post);
    await Clipboard.setData(ClipboardData(text: text));
    if (!_requireOnline()) {
      if (!mounted) return;
      setState(() => _message = 'Share text copied.');
      return;
    }
    await widget.feedRepository.queueShare(post.id);
    await widget.syncService.syncNow();
    if (!mounted) return;
    setState(() => _message = 'Share text copied.');
  }

  String _shareTextForPost(FeedPost post) {
    final mediaUrl = post.mediaUrl ?? post.mediaUrls.firstOrNull;
    return [
      '${post.authorName} on feedIn',
      if (post.body.trim().isNotEmpty) post.body.trim(),
      if (mediaUrl != null && mediaUrl.isNotEmpty) mediaUrl,
    ].join('\n\n');
  }

  Future<void> _openComments(FeedPost post) async {
    final comment = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _CommentSheet(post: post),
    );
    if (comment == null || comment.trim().isEmpty) return;
    await _runOnlineAction(
      () => widget.feedRepository.queueComment(post.id, comment),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<FeedPost>>(
      future: _postsFuture,
      builder: (context, snapshot) {
        final posts = snapshot.data;
        final topInset = MediaQuery.of(context).padding.top;
        final overlayHeight = topInset + 104;

        Widget content;
        if (_tabIndex == 2) {
          // Live loads from its own data source. Do not block this tab behind
          // the feed post refresh; otherwise a slow/failed feed fetch makes the
          // Live tab look non-functional.
          content = LiveScreen(topPadding: overlayHeight);
        } else if (posts == null) {
          content = _ImmersiveLoadingState(topPadding: overlayHeight);
        } else {
          final filteredPosts = _filterPosts(posts);
          content = filteredPosts.isEmpty
              ? _ImmersiveEmptyState(
                  tabIndex: _tabIndex,
                  topPadding: overlayHeight,
                  onRefresh: _refresh,
                )
              : _buildImmersivePager(filteredPosts);
        }

        return ColoredBox(
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(child: content),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: _buildTopOverlay(context),
              ),
              if (_message != null)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: _FeedStatusBanner(message: _message),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildImmersivePager(List<FeedPost> posts) {
    // Record a view for whichever post is currently in focus — covers the first
    // post on load and the active post after every page change / tab switch.
    // Scheduled post-frame so it never calls into recordView during build; the
    // per-session id set keeps it to one record per post.
    if (posts.isNotEmpty) {
      final activePost = posts[_activePage.clamp(0, posts.length - 1)];
      if (!_recordedViewIds.contains(activePost.id)) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _recordView(activePost),
        );
      }
    }
    return PageView.builder(
      controller: _pageController,
      scrollDirection: Axis.vertical,
      itemCount: posts.length,
      onPageChanged: (index) {
        setState(() => _activePage = index);
        _maybeLoadMore(index, posts.length);
        // Warm the next few reels so swiping to them starts playback instantly.
        ReelPreloader.instance.preloadAround([
          for (final p in posts) p.mediaUrl ?? p.mediaUrls.firstOrNull,
        ], index);
      },
      itemBuilder: (context, index) {
        final post = posts[index];
        final card = ImmersivePostCard(
          post: post,
          isActive: index == _activePage,
          isLiked: _likedPostIds.contains(post.id),
          isSaved: _savedPostIds.contains(post.id),
          onLike: () => _likePost(post),
          onComment: () => _openComments(post),
          onRefeed: () => _runOnlineAction(
            () => widget.feedRepository.queueRefeed(post.id),
          ),
          onSave: () => _savePost(post),
          onShare: () => _sharePost(post),
        );
        return _PageTransition(
          controller: _pageController,
          index: index,
          child: card,
        );
      },
    );
  }

  Widget _buildTopOverlay(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: FeedImmersiveTheme.topScrim),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 4, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Text(
                    'feedIn',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                      shadows: FeedImmersiveTheme.textShadow,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Search',
                    onPressed: widget.onOpenSearch,
                    icon: const Icon(Icons.search, color: Colors.white),
                  ),
                  _NotificationBellAction(
                    unreadCountFuture: widget.notificationUnreadCountFuture,
                    onTap: widget.onOpenNotifications,
                    foregroundColor: Colors.white,
                  ),
                ],
              ),
              _ImmersiveFeedTabs(
                selectedIndex: _tabIndex,
                onChanged: _onTabChanged,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<FeedPost> _filterPosts(List<FeedPost> posts) {
    return switch (_tabIndex) {
      0 => posts.where((post) => post.mediaType == 'video').toList(),
      1 => posts.where((post) => post.mediaType != 'video').toList(),
      2 => const <FeedPost>[],
      _ => posts,
    };
  }
}

/// Applies a subtle depth transition to immersive feed pages as they scroll:
/// the page settling into view scales up to full size and brightens while the
/// neighbouring pages sit slightly back and dimmed. Driven directly by the
/// shared [PageController] so it stays in sync with the user's drag without
/// triggering setState rebuilds.
class _PageTransition extends StatelessWidget {
  const _PageTransition({
    required this.controller,
    required this.index,
    required this.child,
  });

  final PageController controller;
  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      child: child,
      builder: (context, child) {
        // Distance (in pages) of this page from the current scroll position.
        double delta = 0;
        if (controller.hasClients && controller.position.hasContentDimensions) {
          final page = controller.page ?? controller.initialPage.toDouble();
          delta = (page - index).abs().clamp(0.0, 1.0);
        }
        // Active page -> scale 1.0 / full opacity; neighbour -> 0.92 / 0.55.
        final scale = 1.0 - (0.08 * delta);
        final opacity = 1.0 - (0.45 * delta);
        return Opacity(
          opacity: opacity,
          child: Transform.scale(scale: scale, child: child),
        );
      },
    );
  }
}

class _ImmersiveFeedTabs extends StatelessWidget {
  const _ImmersiveFeedTabs({
    required this.selectedIndex,
    required this.onChanged,
  });

  final int selectedIndex;
  final ValueChanged<int> onChanged;

  static const _labels = ['Videos', 'Photos', 'Live'];

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < _labels.length; i++)
          _ImmersiveTab(
            label: _labels[i],
            selected: i == selectedIndex,
            onTap: () => onChanged(i),
          ),
      ],
    );
  }
}

class _ImmersiveTab extends StatefulWidget {
  const _ImmersiveTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_ImmersiveTab> createState() => _ImmersiveTabState();
}

class _ImmersiveTabState extends State<_ImmersiveTab> {
  bool _held = false;

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _held = true),
      onTapUp: (_) => setState(() => _held = false),
      onTapCancel: () => setState(() => _held = false),
      child: AnimatedScale(
        scale: _held ? 0.93 : 1.0,
        duration: const Duration(milliseconds: 90),
        curve: Curves.easeOut,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedDefaultTextStyle(
                duration: FeedImmersiveTheme.motionFast,
                curve: FeedImmersiveTheme.settleCurve,
                style: TextStyle(
                  color: selected ? Colors.white : Colors.white60,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  fontSize: 16,
                  letterSpacing: selected ? 0.0 : 0.1,
                  shadows: FeedImmersiveTheme.textShadow,
                ),
                child: Text(widget.label),
              ),
              const SizedBox(height: 5),
              AnimatedContainer(
                duration: FeedImmersiveTheme.motionFast,
                curve: FeedImmersiveTheme.settleCurve,
                height: 3,
                width: selected ? 24 : 0,
                decoration: const BoxDecoration(
                  gradient: FeedImmersiveTheme.brandGradient,
                  borderRadius: BorderRadius.all(Radius.circular(2)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ImmersiveEmptyState extends StatelessWidget {
  const _ImmersiveEmptyState({
    required this.tabIndex,
    required this.topPadding,
    required this.onRefresh,
  });

  final int tabIndex;
  final double topPadding;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final isVideo = tabIndex == 0;
    final title = isVideo ? 'No videos yet' : 'No posts yet';
    final body = isVideo
        ? 'Pull down to refresh or create a video post.'
        : 'Pull down to refresh or create the first post.';
    return Padding(
      padding: EdgeInsets.only(top: topPadding),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isVideo ? Icons.play_circle_outline : Icons.dynamic_feed_outlined,
              color: Colors.white70,
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Branded full-bleed loading state for the immersive feed: a soft pulsing
/// glyph over black, replacing the bare white spinner so the first paint feels
/// intentional rather than empty.
class _ImmersiveLoadingState extends StatefulWidget {
  const _ImmersiveLoadingState({required this.topPadding});

  final double topPadding;

  @override
  State<_ImmersiveLoadingState> createState() => _ImmersiveLoadingStateState();
}

class _ImmersiveLoadingStateState extends State<_ImmersiveLoadingState>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: widget.topPadding),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FadeTransition(
              opacity: Tween(begin: 0.45, end: 1.0).animate(_controller),
              child: ScaleTransition(
                scale: Tween(begin: 0.92, end: 1.04).animate(
                  CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
                ),
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: FeedImmersiveTheme.brandGradient,
                    boxShadow: [
                      BoxShadow(color: Color(0x66FF3D9A), blurRadius: 24),
                    ],
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Loading your feed…',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedStatusBanner extends StatelessWidget {
  const _FeedStatusBanner({required this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final text = message ?? '';
    if (text.isEmpty) return const SizedBox.shrink();
    return IgnorePointer(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ),
      ),
    );
  }
}

class _CommentSheet extends StatefulWidget {
  const _CommentSheet({required this.post});

  final FeedPost post;

  @override
  State<_CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<_CommentSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Comments',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            widget.post.body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 5,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Add a comment',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(_controller.text),
              icon: const Icon(Icons.send),
              label: const Text('Comment'),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfilePanel extends StatelessWidget {
  const ProfilePanel({super.key, required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.displayName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '@${profile.handle}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                if (profile.bio.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    profile.bio,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                const Text('Stored locally'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class PlaceholderPanel extends StatelessWidget {
  const PlaceholderPanel({super.key, required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    body,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
