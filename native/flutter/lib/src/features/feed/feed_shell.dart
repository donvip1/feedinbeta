import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';

import '../../core/connectivity/connectivity_service.dart';
import '../../core/connectivity/offline_notice.dart';
import '../../core/feedin_route_observer.dart';
import '../../core/notifications/callkit_service.dart';
import '../../core/notifications/local_notifications_service.dart';
import '../../core/notifications/pending_reply_store.dart';
import '../../core/notifications/push_notification_service.dart';
import '../../core/realtime/feedin_realtime_service.dart';
import '../../core/storage/local_storage_maintenance.dart';
import '../../core/storage/storage_diagnostics_service.dart';
import '../../core/sync/conversation_starter.dart';
import '../../core/sync/foreground_sync_coordinator.dart';
import '../../core/sync/incremental_message_sync_service.dart';
import '../../core/sync/sync_service.dart';
import '../../core/sync/upload_queue_service.dart';
import '../../data/local/local_feed_repository_contract.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../../data/local/notification_repository_contract.dart';
import '../../data/remote/messages_remote_data_source.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../../data/local/post_draft_repository.dart';
import '../../data/local/profile_repository_contract.dart';
import '../../data/local/upload_queue_repository.dart';
import '../../core/media/reel_preloader.dart';
import '../../data/remote/post_views_remote_data_source.dart';
import '../../data/remote/social_graph_remote_data_source.dart';
import '../calls/call_controller.dart';
import '../calls/call_screen.dart';
import '../calls/livekit_call_media_engine.dart';
import '../channels/screens/channels_screen.dart';
import '../contacts/contacts_screen.dart';
import '../groups/screens/groups_screen.dart';
import '../gifts/data/gift_remote_data_source.dart';
import '../gifts/presentation/gift_marketplace_sheet.dart';
import '../live/live_screen.dart';
import '../wallet/wallet_screen.dart';
import '../create/camera_studio/camera_studio_screen.dart';
import '../create/camera_studio/studio_capture_controls.dart';
import '../create/create_outcome.dart';
import '../create/create_action_sheet.dart';
import '../create/create_post_screen.dart';
import '../create/drafts_uploads_screen.dart';
import '../create/parity/create_view_models.dart';
import '../messages/messages_screen.dart';
import '../notifications/parity/notifications_view_models.dart';
import '../notifications/parity/widgets/notification_bell_badge.dart';
import '../notifications/notifications_screen.dart';
import '../promotions/data/promotion_remote_data_source.dart';
import '../promotions/presentation/promote_post_flow.dart';
import '../profile/profile_screen.dart';
import '../profile/user_profile.dart';
import '../profile/user_profile_screen.dart';
import '../search/feed_search_screen.dart';
import '../settings/settings_screen.dart';
import 'feed_post.dart';
import 'feed_item.dart';
import 'immersive/sponsored_feed_card.dart';
import 'feed_post_pager_screen.dart';
import 'feed_share_service.dart';
import 'immersive/comment_sheet.dart';
import 'immersive/creator_preview_sheet.dart';
import 'immersive/feed_immersive_theme.dart';
import 'immersive/feed_post_actions_sheet.dart';
import 'immersive/incoming_feed_message_banner.dart';
import 'immersive/refeed_sheet.dart';
import '../../core/realtime/incoming_message_resolver.dart';
import 'presentation/post_controller_card.dart';
import 'share/feed_share_actions.dart';
import 'share/feed_share_sheet.dart';
import 'state/feed_chrome_state_machine.dart';
import 'state/post_controller.dart';

class FeedShell extends StatefulWidget {
  const FeedShell({
    super.key,
    required this.displayName,
    required this.profile,
    required this.feedRepository,
    required this.messagesRepository,
    required this.messagesRemoteDataSource,
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
    this.incrementalMessageSyncService,
  });

  final String displayName;
  final UserProfile profile;
  final LocalFeedRepositoryContract feedRepository;
  final LocalMessagesRepositoryContract messagesRepository;
  final MessagesRemoteDataSource messagesRemoteDataSource;
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
  final IncrementalMessageSyncService? incrementalMessageSyncService;

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
  String? _publishedPostTargetId;
  int _messagesRealtimeVersion = 0;
  final int _newConversationRequests = 0;
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
  late final SocialGraphRemoteDataSource _socialGraph;

  /// Most recent Feed chrome visibility. The shell uses this to decide
  /// whether the shared `_FeedBottomNavigation` (and the immersive
  /// background color) should be visible. Defaults to full so a brand
  /// new Feed renders the standard bottom navigation before the first
  /// chrome callback fires.
  FeedChromeVisibility _feedChromeVisibility = FeedChromeVisibility.full;

  /// The newest incoming-message banner the Feed wants to display above
  /// the immersive pager. The shell is responsible only for the
  /// conversation tap routing; the Feed owns dedup/expiry/visibility.
  IncomingFeedMessageBanner? _incomingMessageBanner;

  /// Shared, long-lived call controller: drives both outgoing calls placed from
  /// a chat header and the app-wide incoming-call presenter below.
  late final CallController _callController;
  bool _callRouteOpen = false;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    _socialGraph = SocialGraphRemoteDataSource.autoDetect();
    unawaited(widget.incrementalMessageSyncService?.start(_profile.userId));
    WidgetsBinding.instance.addObserver(this);
    _notificationUnreadCountFuture = widget.notificationRepository
        .unreadCount();
    _realtimeSubscription = widget.realtimeService.events.listen(
      _handleRealtimeEvent,
    );
    _connectRealtime();
    // The V2 service subscribes before cursor catch-up and drains its durable
    // outbox whenever connectivity returns. Legacy sync remains active during
    // the dual-read rollout.
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
    unawaited(widget.incrementalMessageSyncService?.stop());
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
      unawaited(widget.incrementalMessageSyncService?.start(_profile.userId));
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

  void _handleChromeVisibilityChanged(FeedChromeVisibility visibility) {
    if (!mounted || _feedChromeVisibility == visibility) return;
    setState(() => _feedChromeVisibility = visibility);
  }

  void _handleIncomingMessageBannerChanged(IncomingFeedMessageBanner? banner) {
    if (!mounted) return;
    if (banner?.id == _incomingMessageBanner?.id) return;
    setState(() => _incomingMessageBanner = banner);
  }

  void _openConversationFromBanner(String conversationId) {
    if (conversationId.isEmpty) return;
    setState(() {
      _incomingMessageBanner = null;
    });
    _openNotificationRoute('conversation:$conversationId');
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

  /// Create is a floating "+" action. Source selection happens before camera
  /// initialization, so opening Create never requests camera access by itself.
  void _openCreate() {
    unawaited(_chooseCreateAction());
  }

  Future<void> _chooseCreateAction() async {
    final action = await showCreateActionSheet(context);
    if (!mounted || action == null) return;
    switch (action) {
      case CreateAction.video:
        await _openSelectedCreateMethod(CaptureMethod.recordVideo);
      case CreateAction.photo:
        await _openComposerRoute(storyMode: false);
      case CreateAction.story:
        await _openComposerRoute(storyMode: true);
      case CreateAction.goLive:
        final liveAction = await showLiveCreateActionSheet(context);
        if (!mounted || liveAction == null) return;
        switch (liveAction) {
          case LiveCreateAction.videoLive:
            await showGoLiveSheet(context);
          case LiveCreateAction.audioSpace:
            await showStartLiveSpaceSheet(context);
        }
    }
  }

  void _handlePostUploaded(String? postId) {
    if (!mounted) return;
    setState(() => _feedRealtimeVersion++);
  }

  Future<void> _openSelectedCreateMethod(CaptureMethod method) async {
    final outcome = await Navigator.of(context).push<CreateOutcome>(
      MaterialPageRoute<CreateOutcome>(
        fullscreenDialog: true,
        builder: (_) => CameraStudioScreen(
          draftRepository: widget.postDraftRepository,
          uploadQueueRepository: widget.uploadQueueRepository,
          uploadQueueService: widget.uploadQueueService,
          connectivityService: widget.connectivityService,
          initialSource: method,
          initialMode:
              method == CaptureMethod.recordVideo ||
                  method == CaptureMethod.videoLibrary
              ? StudioCaptureMode.video60
              : StudioCaptureMode.photo,
          onPostUploaded: _handlePostUploaded,
        ),
      ),
    );
    if (!mounted || outcome == null) return;
    switch (outcome) {
      case CreatePublished(:final postId):
        await widget.feedRepository.refresh();
        if (!mounted) return;
        setState(() {
          _index = 0;
          _showNotifications = false;
          _publishedPostTargetId = postId;
        });
      case CreateDraftSaved():
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => DraftsUploadsScreen(
              draftRepository: widget.postDraftRepository,
              uploadQueueRepository: widget.uploadQueueRepository,
              uploadQueueService: widget.uploadQueueService,
              onPostUploaded: _handlePostUploaded,
            ),
          ),
        );
    }
  }

  /// Opens the fullscreen composer. In post mode (`storyMode: false`) media is
  /// optional, so users can publish text-only posts or attach photos ("Share
  /// your thoughts"); in story mode it seeds the 24h story flow.
  Future<void> _openComposerRoute({required bool storyMode}) async {
    final outcome = await Navigator.of(context).push<CreateOutcome>(
      MaterialPageRoute<CreateOutcome>(
        fullscreenDialog: true,
        builder: (_) => CreatePostScreen(
          draftRepository: widget.postDraftRepository,
          uploadQueueRepository: widget.uploadQueueRepository,
          uploadQueueService: widget.uploadQueueService,
          connectivityService: widget.connectivityService,
          onPostUploaded: _handlePostUploaded,
          initialStoryMode: storyMode,
        ),
      ),
    );
    if (!mounted || outcome == null) return;
    switch (outcome) {
      case CreatePublished(:final postId):
        await widget.feedRepository.refresh();
        if (!mounted) return;
        setState(() {
          _index = 0;
          _showNotifications = false;
          _publishedPostTargetId = postId;
        });
      case CreateDraftSaved():
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => DraftsUploadsScreen(
              draftRepository: widget.postDraftRepository,
              uploadQueueRepository: widget.uploadQueueRepository,
              uploadQueueService: widget.uploadQueueService,
              onPostUploaded: _handlePostUploaded,
            ),
          ),
        );
    }
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

  void _openSearch([String? initialQuery]) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FeedSearchScreen(
          feedRepository: widget.feedRepository,
          initialQuery: initialQuery,
          onOpenPerson: (person) {
            Navigator.of(context).pop();
            _openUserProfile(person.userId);
          },
          onOpenPost: (post) {
            Navigator.of(context).pop();
            _openSearchPost(post);
          },
        ),
      ),
    );
  }

  void _openSearchPost(FeedPost post) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FeedPostPagerScreen(
          posts: [post],
          initialIndex: 0,
          feedRepository: widget.feedRepository,
          syncService: widget.syncService,
          connectivityService: widget.connectivityService,
          currentUserId: _profile.userId,
          onOpenUserProfile: _openUserProfile,
          socialGraphDataSource: _socialGraph,
        ),
      ),
    );
  }

  void _openUserProfile(String userId) {
    if (userId.isEmpty) return;
    if (userId == _profile.userId) {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
      if (!mounted) return;
      setState(() => _selectTabState(3));
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => UserProfileScreen(
          userId: userId,
          profileRepository: widget.profileRepository,
          feedRepository: widget.feedRepository,
          connectivityService: widget.connectivityService,
          syncService: widget.syncService,
          currentUserId: _profile.userId,
          onOpenUserProfile: _openUserProfile,
          socialGraphDataSource: _socialGraph,
        ),
      ),
    );
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

  /// Messaging is presented as a focused, full-screen destination. Once its
  /// own back controller has closed an open thread, leaving the inbox always
  /// returns to Feed/Reels instead of exposing an arbitrary tab from history.
  void _returnFromMessagesToFeed() {
    setState(() {
      _showNotifications = false;
      _index = 0;
      _tabHistory.clear();
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

    if (_index == 1) {
      _returnFromMessagesToFeed();
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
        publishedPostTargetId: _publishedPostTargetId,
        onOpenNotifications: _showNotificationsScreen,
        onOpenSearch: _openSearch,
        onOpenSearchQuery: _openSearch,
        backController: _feedBackController,
        notificationUnreadCountFuture: _notificationUnreadCountFuture,
        onOpenUserProfile: _openUserProfile,
        onOpenWallet: () => _selectTab(2),
        socialGraphDataSource: _socialGraph,
        currentUserId: _profile.userId,
        onChromeVisibilityChanged: _handleChromeVisibilityChanged,
        onIncomingMessageBannerChanged: _handleIncomingMessageBannerChanged,
        onOpenConversation: _openConversationFromBanner,
        realtimeService: widget.realtimeService,
      ),
      MessagesScreen(
        messagesRepository: widget.messagesRepository,
        messagesRemoteDataSource: widget.messagesRemoteDataSource,
        conversationStarter: widget.conversationStarter,
        syncService: widget.syncService,
        connectivityService: widget.connectivityService,
        profile: _profile,
        realtimeVersion: _messagesRealtimeVersion,
        initialConversationId: _initialConversationId,
        newConversationRequest: _newConversationRequests,
        callController: _callController,
        backController: _messagesBackController,
        incrementalMessageSyncService: widget.incrementalMessageSyncService,
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
        socialGraphDataSource: _socialGraph,
        onOpenUserProfile: _openUserProfile,
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
        // Chats own the whole viewport. Navigation returns only after the
        // inbox/thread back flow lands on Feed/Reels again.
        bottomNavigationBar: _shouldShowFeedBottomNavigation()
            ? _FeedBottomNavigation(
                selectedIndex: _index,
                onSelected: _selectTab,
                onCreate: _openCreate,
              )
            : null,
        // The incoming-message banner sits above the immersive pager but
        // below pushed routes. It is only relevant while the immersive
        // Feed is on screen and the chrome is auto-hidden (or revealed),
        // so we gate it to the Feed tab. The widget itself is a no-op
        // when [IncomingFeedMessageBanner] is null.
        floatingActionButtonLocation: FloatingActionButtonLocation.endTop,
        floatingActionButton: _index == 0 && !_showNotifications
            ? _IncomingBannerHost(
                banner: _incomingMessageBanner,
                onOpen: _openConversationFromBanner,
              )
            : null,
      ),
    );
  }

  /// Whether the shared bottom navigation should be on screen.
  ///
  /// Chats (_index == 1) always owns the full viewport. Every other tab keeps
  /// the home bar (Feed / Chats / + / Wallet / Profile) visible at all times —
  /// even while the feed chrome is tapped away for immersive viewing.
  bool _shouldShowFeedBottomNavigation() {
    return _index != 1;
  }
}

/// Tiny wrapper that mounts the banner above the immersive pager. Uses
/// `Stack` + `Positioned` so it does not interfere with the Scaffold's
/// layout. Returns `SizedBox.shrink()` when no banner is provided.
class _IncomingBannerHost extends StatelessWidget {
  const _IncomingBannerHost({required this.banner, required this.onOpen});

  final IncomingFeedMessageBanner? banner;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final banner = this.banner;
    if (banner == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 88),
      child: IncomingFeedMessageBannerView(
        banner: banner,
        onTap: () => onOpen(banner.conversationId),
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
    // A translucent, blurred glass bar with a hairline top border — the media
    // and page content show faintly through it (prototype's `backdrop-blur-xl`).
    return SafeArea(
      top: false,
      child: ClipRect(
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
            sigmaX: FeedImmersiveTheme.navBlur,
            sigmaY: FeedImmersiveTheme.navBlur,
          ),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              color: FeedImmersiveTheme.navGlassSurface,
              border: Border(
                top: BorderSide(color: FeedImmersiveTheme.navBorderTop),
              ),
            ),
            child: SizedBox(
              height: FeedImmersiveTheme.navHeight,
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
    final color = selected
        ? FeedImmersiveTheme.brandPink
        : FeedImmersiveTheme.inkMuted;
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
                AnimatedScale(
                  scale: selected ? 1.06 : 1,
                  duration: FeedImmersiveTheme.motionFast,
                  curve: FeedImmersiveTheme.premiumSettleCurve,
                  child: Icon(
                    selected ? selectedIcon : icon,
                    color: color,
                    size: 24,
                  ),
                ),
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
    const radius = BorderRadius.all(
      Radius.circular(FeedImmersiveTheme.radiusMd),
    );
    return Semantics(
      button: true,
      label: 'Create',
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Ink(
            width: FeedImmersiveTheme.createPillWidth,
            height: FeedImmersiveTheme.createPillHeight,
            decoration: const BoxDecoration(
              borderRadius: radius,
              gradient: FeedImmersiveTheme.createPillGradient,
              boxShadow: FeedImmersiveTheme.createPillGlow,
            ),
            child: const Icon(Icons.add, color: Colors.white, size: 24),
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

/// Keeps the feed selector at the viewport midpoint while reserving equal
/// chrome space for the brand and the variable right-side action cluster.
class FeedTopChromeLayout extends StatelessWidget {
  const FeedTopChromeLayout({
    super.key,
    required this.leading,
    required this.center,
    required this.trailing,
  });

  final Widget leading;
  final Widget center;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Keep at least an 80px center slot on narrow phones. The compact
        // action cluster is 108px wide when the post menu is present.
        final sideWidth =
            ((constraints.maxWidth - 80) / 2).clamp(0.0, 128.0).toDouble();
        return Row(
          children: [
            SizedBox(
              width: sideWidth,
              child: Align(alignment: Alignment.centerLeft, child: leading),
            ),
            Expanded(
              child: Center(
                child: FittedBox(fit: BoxFit.scaleDown, child: center),
              ),
            ),
            SizedBox(
              width: sideWidth,
              child: Align(alignment: Alignment.centerRight, child: trailing),
            ),
          ],
        );
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

class PublishedPostPlacement {
  const PublishedPostPlacement({
    required this.tabIndex,
    required this.pageIndex,
    required this.found,
  });

  final int tabIndex;
  final int pageIndex;
  final bool found;
}

PublishedPostPlacement locatePublishedPost(
  List<FeedItem> items,
  String postId,
) {
  final published = items.whereType<FeedPostItem>().where(
    (item) => item.post.id == postId || item.post.displayedPost.id == postId,
  );
  if (published.isEmpty) {
    return const PublishedPostPlacement(
      tabIndex: 0,
      pageIndex: 0,
      found: false,
    );
  }

  final post = published.first.post.displayedPost;
  final tabIndex = post.hasVideoMedia ? 0 : 1;
  final filtered = items
      .whereType<FeedPostItem>()
      .where((item) {
        final displayed = item.post.displayedPost;
        return tabIndex == 0
            ? displayed.hasVideoMedia
            : !displayed.hasVideoMedia;
      })
      .toList(growable: false);
  final pageIndex = filtered.indexWhere(
    (item) => item.post.id == postId || item.post.displayedPost.id == postId,
  );

  return PublishedPostPlacement(
    tabIndex: tabIndex,
    pageIndex: pageIndex < 0 ? 0 : pageIndex,
    found: pageIndex >= 0,
  );
}

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    super.key,
    required this.feedRepository,
    required this.syncService,
    required this.connectivityService,
    required this.realtimeVersion,
    required this.publishedPostTargetId,
    required this.onOpenNotifications,
    required this.onOpenSearch,
    required this.onOpenSearchQuery,
    required this.backController,
    required this.notificationUnreadCountFuture,
    required this.onOpenUserProfile,
    required this.onOpenWallet,
    required this.socialGraphDataSource,
    required this.currentUserId,
    required this.onChromeVisibilityChanged,
    required this.onIncomingMessageBannerChanged,
    required this.onOpenConversation,
    required this.realtimeService,
    this.shareService = const FeedShareService(),
  });

  final LocalFeedRepositoryContract feedRepository;
  final SyncServiceContract syncService;
  final ConnectivityService connectivityService;
  final int realtimeVersion;
  final String? publishedPostTargetId;
  final VoidCallback onOpenNotifications;
  final VoidCallback onOpenSearch;

  /// Opens search pre-filled with a query (used by comment @mention / #hashtag
  /// taps). Routed through the shell so it reuses the same search route.
  final ValueChanged<String> onOpenSearchQuery;
  final FeedScreenBackController backController;
  final Future<int> notificationUnreadCountFuture;
  final ValueChanged<String> onOpenUserProfile;
  final VoidCallback onOpenWallet;
  final SocialGraphRemoteDataSource socialGraphDataSource;
  final String currentUserId;
  final FeedShareService shareService;

  /// Called whenever the chrome state machine transitions. The shell
  /// uses this to decide whether the shared `_FeedBottomNavigation`
  /// should be on screen.
  final ValueChanged<FeedChromeVisibility> onChromeVisibilityChanged;

  /// Called whenever the newest incoming-message banner should be
  /// shown/hidden above the immersive pager.
  final ValueChanged<IncomingFeedMessageBanner?> onIncomingMessageBannerChanged;

  /// Called when the user taps the incoming-message banner; the shell
  /// handles the actual conversation routing.
  final ValueChanged<String> onOpenConversation;

  /// Used to listen for incoming-message Realtime events. We only need
  /// the stream surface; the shell already owns connect/disconnect.
  final FeedinRealtimeService realtimeService;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> with RouteAware {
  late Future<List<FeedItem>> _postsFuture;
  final PageController _pageController = PageController();
  final PostViewsRemoteDataSource _postViews =
      PostViewsRemoteDataSource.autoDetect();
  final GiftRemoteDataSource _giftRepository =
      GiftRemoteDataSource.autoDetect();
  final PromotionRemoteDataSource _promotionRepository =
      PromotionRemoteDataSource.autoDetect();
  String? _message;
  int _tabIndex = 0;
  int _activePage = 0;
  bool _isLoadingMore = false;
  bool _hasMorePosts = true;

  /// Feed-engine session: a stable id per feed session so the server can track
  /// the no-repeat cycle; the first fetch of a session sets isNewSession=true.
  final String _feedSessionId = const Uuid().v4();
  bool _isNewFeedSession = true;
  int _feedOffset = 0;

  /// True until the first background refresh completes. Used only to keep the
  /// loading state (not the "No posts yet" empty state) on screen when the app
  /// opens with a cold/empty cache — otherwise an empty first paint would flash
  /// the empty state for a beat before posts arrive.
  bool _initialRefreshPending = true;
  Timer? _realtimeRefreshDebounce;
  String? _appliedPublishedPostTargetId;
  ModalRoute<void>? _subscribedRoute;
  bool _routeVisible = true;

  /// Staged immersive chrome state machine. Owned by the Feed (not the
  /// shell) because the chrome is a property of the immersive pager
  /// itself. The current visibility value is reported up to the shell
  /// via [widget.onChromeVisibilityChanged].
  final FeedChromeStateMachine _chrome = FeedChromeStateMachine();
  FeedChromeVisibility _chromeState = FeedChromeVisibility.full;

  /// Last reported video-playback state (used to suppress duplicate
  /// timer resets while the controller is mid-initialize).
  bool _lastVideoPlaying = false;

  /// Most recent banner to display above the immersive pager.
  IncomingFeedMessageBanner? _incomingBanner;

  /// Subscriptions owned by this state and cancelled in [dispose].
  StreamSubscription<FeedinRealtimeEvent>? _messagesRealtimeSub;
  Timer? _bannerExpiryTimer;

  /// Posts whose view has been recorded this session, so a post is counted once
  /// even if it scrolls in and out of focus.
  final Set<String> _recordedViewIds = {};

  /// IDs of message banners we've already shown, so the same Realtime
  /// event never produces two banners if the shell replays it.
  final Set<String> _displayedBannerIds = {};

  @override
  void initState() {
    super.initState();
    // Show whatever is already cached instantly (a synchronous-feeling Hive
    // read) so the feed paints immediately on open, then reconcile with the
    // ranked server engine in the background. The old path awaited a full
    // remote refresh before showing anything, which made the feed take seconds.
    _postsFuture = widget.feedRepository.loadPosts().then(
      (posts) => posts.map<FeedItem>(FeedPostItem.new).toList(),
    );
    _refreshInBackground();
    _syncBackController();
    _chrome.attachListener(_onChromeStateChanged);
    _messagesRealtimeSub = widget.realtimeService.events
        .where((event) => event.type == FeedinRealtimeEventType.messageChanged)
        .listen(_handleMessagesRealtimeEvent);
  }

  void _onChromeStateChanged(FeedChromeVisibility visibility) {
    if (!mounted) return;
    setState(() => _chromeState = visibility);
    widget.onChromeVisibilityChanged(visibility);
  }

  void _handleMessagesRealtimeEvent(FeedinRealtimeEvent event) {
    if (!mounted || !_routeVisible) return;
    final banner = IncomingMessageResolver(
      currentUserId: widget.currentUserId,
      event: event,
    ).buildBanner();
    if (banner == null) return;
    if (_displayedBannerIds.contains(banner.id)) return;
    _displayedBannerIds.add(banner.id);
    setState(() => _incomingBanner = banner);
    widget.onIncomingMessageBannerChanged(banner);
    _scheduleBannerExpiry(banner);
  }

  void _scheduleBannerExpiry(IncomingFeedMessageBanner banner) {
    _bannerExpiryTimer?.cancel();
    _bannerExpiryTimer = Timer(const Duration(seconds: 6), () {
      if (!mounted) return;
      if (_incomingBanner?.id != banner.id) return;
      setState(() => _incomingBanner = null);
      widget.onIncomingMessageBannerChanged(null);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route == null || identical(route, _subscribedRoute)) return;
    if (_subscribedRoute != null) {
      feedinRouteObserver.unsubscribe(this);
    }
    _subscribedRoute = route;
    feedinRouteObserver.subscribe(this, route);
  }

  @override
  void didPushNext() {
    final coveringRoute = feedinRouteObserver.routeAbove(_subscribedRoute);
    if (coveringRoute is FeedCommentSheetRoute<void>) return;
    if (_routeVisible) setState(() => _routeVisible = false);
    // The Feed is now hidden under a pushed route (notifications,
    // search, creator preview, etc). Stop the auto-hide timer so it
    // doesn't fire while the user is interacting elsewhere.
    _chrome.reportImmersiveSurface(isActive: false);
  }

  @override
  void didPopNext() {
    if (!_routeVisible) setState(() => _routeVisible = true);
    if (_routeVisible) {
      _reapplyImmersiveSurfaceState();
    }
  }

  @override
  void dispose() {
    feedinRouteObserver.unsubscribe(this);
    widget.backController.setActiveBackHandler(null);
    _realtimeRefreshDebounce?.cancel();
    _bannerExpiryTimer?.cancel();
    _messagesRealtimeSub?.cancel();
    _chrome.dispose();
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
      _realtimeRefreshDebounce?.cancel();
      _realtimeRefreshDebounce = Timer(
        const Duration(milliseconds: 250),
        _reloadAfterRealtimeEvent,
      );
    }
    final targetId = widget.publishedPostTargetId;
    if (targetId != null && targetId != _appliedPublishedPostTargetId) {
      _appliedPublishedPostTargetId = targetId;
      unawaited(_focusPublishedPost(targetId));
    }
  }

  Future<void> _focusPublishedPost(String postId) async {
    final posts = await widget.feedRepository.loadPosts();
    if (!mounted || widget.publishedPostTargetId != postId) return;
    final items = posts.map<FeedItem>(FeedPostItem.new).toList(growable: false);
    final placement = locatePublishedPost(items, postId);
    setState(() {
      _postsFuture = Future.value(items);
      _tabIndex = placement.tabIndex;
      _activePage = placement.pageIndex;
      _message = 'Post published.';
    });
    _syncBackController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_pageController.hasClients) return;
      _pageController.jumpToPage(placement.pageIndex);
      _reapplyImmersiveSurfaceState();
    });
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
    // A realtime nudge starts a fresh ranked session so new activity surfaces.
    final result = await widget.feedRepository.fetchRankedFeed(
      sessionId: _feedSessionId,
      isNewSession: true,
    );
    if (!mounted) return;
    setState(() {
      _feedOffset = _postCount(result.items);
      _isNewFeedSession = false;
      _hasMorePosts = result.hasMore;
      _postsFuture = Future.value(result.items);
      _clearEngagementOverrides();
      _message = 'New feed activity synced.';
    });
  }

  void _clearEngagementOverrides() {
    // Engagement state is keyed per post by Riverpod and reconciles from each
    // refreshed FeedPost snapshot at the card boundary.
  }

  /// Number of organic posts (excluding injected ads) in a ranked page — the
  /// engine paginates by post offset, not by item count.
  int _postCount(List<FeedItem> items) =>
      items.whereType<FeedPostItem>().length;

  /// Reconcile the instantly-shown cache with the ranked engine without blocking
  /// the first paint. Called once from [initState]; cached posts are already on
  /// screen, so this swaps in the ranked+ad list once it returns. When the
  /// engine yields nothing (empty/offline), the cache stays put.
  void _refreshInBackground() {
    unawaited(() async {
      final result = await widget.feedRepository.fetchRankedFeed(
        sessionId: _feedSessionId,
        isNewSession: _isNewFeedSession,
      );
      if (!mounted) return;
      setState(() {
        _initialRefreshPending = false;
        _message = result.message;
        _hasMorePosts = result.hasMore;
        if (result.items.isNotEmpty) {
          _feedOffset = _postCount(result.items);
          _isNewFeedSession = false;
          _postsFuture = Future.value(result.items);
          _clearEngagementOverrides();
        }
      });
    }());
  }

  Future<void> _refresh() async {
    // Pull-to-refresh restarts the ranked session (new-before-old, no repeats).
    final result = await widget.feedRepository.fetchRankedFeed(
      sessionId: _feedSessionId,
      isNewSession: true,
    );
    if (!mounted) return;
    setState(() {
      _feedOffset = _postCount(result.items);
      _isNewFeedSession = false;
      _postsFuture = Future.value(result.items);
      _clearEngagementOverrides();
      _message = result.message ?? 'Feed refreshed.';
      _hasMorePosts = result.hasMore;
    });
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMorePosts) return;
    setState(() {
      _isLoadingMore = true;
      _message = null;
    });

    final result = await widget.feedRepository.fetchRankedFeed(
      offset: _feedOffset,
      sessionId: _feedSessionId,
      isNewSession: false,
    );
    if (!mounted) return;
    final existing = _lastPosts ?? const <FeedItem>[];
    final merged = [...existing, ...result.items];
    setState(() {
      _isLoadingMore = false;
      _hasMorePosts = result.hasMore;
      _feedOffset += _postCount(result.items);
      _postsFuture = Future.value(merged);
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
    // Photos / Live do not own the immersive video timer; full chrome
    // is the right resting state for those tabs.
    if (mounted) _reapplyImmersiveSurfaceState();
  }

  /// Decide whether the immersive surface qualifies for the auto-hide
  /// timer. Only the primary Video tab while the route is visible
  /// qualifies; Photos, Live, comment sheets, and any pushed route do
  /// not. Calling this reapplies the current playback state to the
  /// chrome machine so it can arm/disarm the timer correctly.
  void _reapplyImmersiveSurfaceState() {
    final isImmersiveVideoTab =
        _tabIndex == 0 && _routeVisible && _isActivePostVideo;
    _chrome.reportImmersiveSurface(isActive: isImmersiveVideoTab);
    if (isImmersiveVideoTab) {
      _chrome.reportVideoPlayback(isPlaying: _lastVideoPlaying);
    } else {
      _chrome.reportVideoPlayback(isPlaying: false);
    }
  }

  bool get _isActivePostVideo {
    final cached = _lastPosts;
    if (cached == null || cached.isEmpty) return false;
    final active = cached[_activePage.clamp(0, cached.length - 1)];
    // Ads are not video surfaces for the immersive timer's purposes.
    return active is FeedPostItem && active.post.displayedPost.hasVideoMedia;
  }

  List<FeedItem>? _lastPosts;

  Future<void> _deletePost(FeedPost post) async {
    if (post.userId != widget.currentUserId || !_requireOnline()) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete post?'),
        content: const Text('This permanently deletes the post.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await widget.feedRepository.deletePost(post.id);
      if (!mounted) return;
      final currentPosts = await _postsFuture;
      if (!mounted) return;
      final remaining = currentPosts
          .where((item) => item is! FeedPostItem || item.post.id != post.id)
          .toList(growable: false);
      setState(() {
        _postsFuture = Future.value(remaining);
        _activePage = remaining.isEmpty
            ? 0
            : _activePage.clamp(0, remaining.length - 1);
        _message = 'Post deleted.';
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_pageController.hasClients || remaining.isEmpty) {
          return;
        }
        _pageController.jumpToPage(_activePage);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'Could not delete this post.');
    }
  }

  Future<void> _openPostActions(FeedPost post) async {
    final content = post.displayedPost;
    final action = await showFeedPostActionsSheet(
      context,
      canDelete: post.userId == widget.currentUserId,
      canPromote:
          content.visibility == FeedPostVisibility.public &&
          !content.isPromoted,
    );
    if (!mounted || action == null) return;
    switch (action) {
      case FeedPostMenuAction.promote:
        final campaign = await Navigator.of(context).push(
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => PromotePostFlow(
              post: content,
              repository: _promotionRepository,
            ),
          ),
        );
        if (!mounted || campaign == null) return;
        setState(() => _message = 'Promotion created successfully.');
      case FeedPostMenuAction.delete:
        await _deletePost(post);
    }
  }

  Future<void> _sharePost(FeedPost post, PostController controller) async {
    final actions = FeedShareActionsImpl(
      post: post,
      shareService: widget.shareService,
      isConfigured: widget.currentUserId.isNotEmpty,
      initiallySaved: controller.isSaved,
      onToggleSave: () async {
        await controller.toggleSave();
        return controller.isSaved;
      },
      onExternalShared: () => widget.shareService.recordShare(
        post: post,
        repository: widget.feedRepository,
        syncService: widget.syncService,
        connectivityService: widget.connectivityService,
      ),
    );

    final message = await showFeedShareDrawer(context, actions: actions);
    if (!mounted || message == null) return;
    setState(() => _message = message);
  }

  Future<void> _openGiftMarketplace(FeedPost post) async {
    try {
      await showGiftMarketplaceSheet(
        context,
        postId: post.displayedPost.id,
        repository: _giftRepository,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'Could not open gifts right now.');
    }
  }

  /// Opens a quoted/original post in the full-screen post viewer — the native
  /// equivalent of a "post detail" screen. Used by the embedded quote card.
  void _openOriginalPost(FeedPost original) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FeedPostPagerScreen(
          posts: [original],
          initialIndex: 0,
          feedRepository: widget.feedRepository,
          syncService: widget.syncService,
          connectivityService: widget.connectivityService,
          currentUserId: widget.currentUserId,
          onOpenUserProfile: widget.onOpenUserProfile,
          socialGraphDataSource: widget.socialGraphDataSource,
          shareService: widget.shareService,
        ),
      ),
    );
  }

  Future<void> _openCreatorPreview(FeedPost post) async {
    final content = post.displayedPost;
    final isOwnProfile = content.userId == widget.currentUserId;
    var initiallyFollowing = false;
    if (!isOwnProfile && content.userId.isNotEmpty) {
      try {
        initiallyFollowing = await widget.socialGraphDataSource
            .isCurrentUserFollowing(content.userId);
      } catch (_) {
        // The preview still opens; follow can report its own update failure.
      }
    }
    if (!mounted) return;
    await showCreatorPreview(
      context,
      heroTag: 'creator-avatar-${post.id}',
      name: content.authorName,
      handle: content.authorHandle ?? content.meta,
      avatarUrl: content.avatarUrl,
      initiallyFollowing: initiallyFollowing,
      onToggleFollow: isOwnProfile
          ? null
          : () => widget.socialGraphDataSource.toggleFollow(content.userId),
      loadStats: content.userId.isEmpty
          ? null
          : () async {
              // Followers/following come from the social graph; the tapped
              // post's own count stands in for a lightweight "Posts" hint.
              final results = await Future.wait([
                widget.socialGraphDataSource
                    .fetchFollowers(content.userId)
                    .then((list) => list.length)
                    .catchError((_) => 0),
                widget.socialGraphDataSource
                    .fetchFollowing(content.userId)
                    .then((list) => list.length)
                    .catchError((_) => 0),
              ]);
              return CreatorStats(followers: results[0], following: results[1]);
            },
      onViewProfile: () => widget.onOpenUserProfile(content.userId),
    );
  }

  Future<void> _followCreator(FeedPost creatorPost) async {
    try {
      final following = await widget.socialGraphDataSource.toggleFollow(
        creatorPost.userId,
      );
      if (!mounted) return;
      setState(() {
        _message = following
            ? 'You are now following ${creatorPost.authorName}.'
            : 'Follow status updated.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'Could not follow this creator.');
    }
  }

  Future<void> _openComments(FeedPost post) async {
    List<FeedComment> comments = const [];
    try {
      comments = await widget.feedRepository.loadComments(post.id);
    } catch (_) {
      // The composer remains usable if an older backend cannot list comments.
    }
    if (!mounted) return;
    await showCommentSheet(
      context,
      post: post,
      comments: comments,
      onSubmit: (body, parentCommentId) async {
        final created = await widget.feedRepository.addComment(
          post.id,
          body,
          parentCommentId: parentCommentId,
        );
        return created;
      },
      onToggleLike: (comment, liked) =>
          widget.feedRepository.toggleCommentLike(comment.id, liked: liked),
      onDelete: (comment) async {
        await widget.feedRepository.deleteComment(comment.id);
      },
      onCountChanged: (delta) {
        if (!mounted) return;
        final args = PostControllerArgs(
          post: post,
          repository: widget.feedRepository,
        );
        ProviderScope.containerOf(
          context,
        ).read(postControllerProvider(args).notifier).adjustCommentCount(delta);
      },
      onOpenUserProfile: widget.onOpenUserProfile,
      currentUserId: widget.currentUserId,
      onOpenHashtag: (tag) => widget.onOpenSearchQuery('#$tag'),
      onOpenMention: (handle) => widget.onOpenSearchQuery('@$handle'),
      onSearchMentions: (query) async {
        try {
          final results = await widget.feedRepository.search(query, limit: 8);
          return results.people
              .map(
                (person) => CommentMentionCandidate(
                  userId: person.userId,
                  displayName: person.displayName,
                  handle: person.handle,
                  avatarUrl: person.avatarUrl,
                ),
              )
              .toList(growable: false);
        } catch (_) {
          return const <CommentMentionCandidate>[];
        }
      },
    );
  }

  Future<void> _refeedPost(FeedPost post, PostController controller) async {
    if (!_requireOnline()) return;
    final currentlyRefeeded = controller.isRefeeded;
    final action = await showRefeedActionSheet(
      context,
      isRefeeded: currentlyRefeeded,
    );
    if (!mounted || action == null) return;
    if (action == RefeedAction.quoteRefeed) {
      final quote = await showQuoteRefeedComposer(context, post: post);
      if (!mounted || quote == null) return;
      try {
        final created = await widget.feedRepository.createQuoteRefeed(
          post.displayedPost.id,
          quote,
        );
        controller.recordQuoteRefeed();
        final currentPosts = await _postsFuture;
        if (!mounted) return;
        final nextPosts = <FeedItem>[
          FeedPostItem(created),
          ...currentPosts.where(
            (item) => item is! FeedPostItem || item.post.id != created.id,
          ),
        ];
        setState(() {
          _postsFuture = Future.value(nextPosts);
          _tabIndex = created.displayedPost.hasVideoMedia ? 0 : 1;
          _activePage = 0;
          _message = 'Quote shared to your feed.';
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _pageController.hasClients) {
            _pageController.jumpToPage(0);
          }
        });
      } catch (_) {
        if (mounted) setState(() => _message = 'Could not share this quote.');
      }
      return;
    }
    await controller.toggleRefeed();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<FeedItem>>(
      future: _postsFuture,
      builder: (context, snapshot) {
        final posts = snapshot.data;
        _lastPosts = posts;
        // After every future result (initial load or refresh), decide
        // whether the active surface still qualifies for the immersive
        // timer. The first posts may be images, in which case chrome
        // should stay full.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _reapplyImmersiveSurfaceState();
        });

        final topInset = MediaQuery.of(context).padding.top;
        final overlayHeight = topInset + 104;
        // While the chrome is visible the immersive pager is framed BELOW the
        // pinned bar + demarcation line; when it hides (video playing) the
        // pager expands to true full screen. Photos, Live, loading and empty
        // states always sit below the bar via their own topPadding.
        final chromeVisible = _chromeState == FeedChromeVisibility.full;
        final pagerTopInset =
            topInset + FeedImmersiveTheme.feedTopBarContentHeight;

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
          // Keep the loading state (not the empty state) while the very first
          // refresh is still in flight against a cold cache; otherwise show the
          // real empty state once we know there is genuinely nothing to show.
          content = filteredPosts.isEmpty
              ? (_initialRefreshPending
                    ? _ImmersiveLoadingState(topPadding: overlayHeight)
                    : _ImmersiveEmptyState(
                        tabIndex: _tabIndex,
                        topPadding: overlayHeight,
                        onRefresh: _refresh,
                      ))
              : AnimatedPadding(
                  duration: FeedImmersiveTheme.motionMedium,
                  curve: FeedImmersiveTheme.premiumSettleCurve,
                  padding: EdgeInsets.only(top: chromeVisible ? pagerTopInset : 0),
                  // Remove the top safe-area padding inside the framed pager so
                  // the card's own header offset isn't double-counted against
                  // the inset we just applied.
                  child: MediaQuery.removePadding(
                    context: context,
                    removeTop: true,
                    child: _buildImmersivePager(filteredPosts),
                  ),
                );
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
                child: _buildTopOverlay(context, posts: posts),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: IgnorePointer(
                  child: AnimatedSlide(
                    offset: _message == null
                        ? const Offset(0, 0.35)
                        : Offset.zero,
                    duration: FeedImmersiveTheme.motionStatus,
                    curve: FeedImmersiveTheme.premiumSettleCurve,
                    child: AnimatedOpacity(
                      opacity: _message == null ? 0 : 1,
                      duration: FeedImmersiveTheme.motionFast,
                      curve: FeedImmersiveTheme.premiumSettleCurve,
                      child: _FeedStatusBanner(message: _message),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildImmersivePager(List<FeedItem> items) {
    // Record a view for whichever post is currently in focus — covers the first
    // post on load and the active post after every page change / tab switch.
    // Scheduled post-frame so it never calls into recordView during build; the
    // per-session id set keeps it to one record per post. Ad pages record no view.
    if (items.isNotEmpty) {
      final active = items[_activePage.clamp(0, items.length - 1)];
      if (active is FeedPostItem &&
          !_recordedViewIds.contains(active.post.id)) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _recordView(active.post),
        );
      }
    }
    return PageView.builder(
      controller: _pageController,
      scrollDirection: Axis.vertical,
      // Pre-build the adjacent page so swiping to it is instant (media widget
      // is already mounted before the drag completes).
      allowImplicitScrolling: true,
      itemCount: items.length,
      onPageChanged: (index) {
        setState(() => _activePage = index);
        _maybeLoadMore(index, items.length);
        // The active page may have changed media type / become an ad;
        // re-evaluate immersive eligibility so non-video pages don't get the
        // auto-hide timer.
        _reapplyImmersiveSurfaceState();
        // Warm the next few reels so swiping to them starts playback instantly.
        ReelPreloader.instance.preloadAround([
          for (final item in items)
            if (item is FeedPostItem)
              item.post.displayedPost.mediaUrl ??
                  item.post.displayedPost.mediaUrls.firstOrNull
            else
              null,
        ], index);
      },
      itemBuilder: (context, index) {
        final item = items[index];
        final Widget card = switch (item) {
          FeedAdItem(:final ad) => SponsoredFeedCard(
            key: ValueKey<String>('feed-ad-${ad.adId}'),
            ad: ad,
            onCta: () => _handleAdCta(ad),
          ),
          FeedPostItem(:final post) => PostControllerCard(
            key: ValueKey<String>('feed-post-${post.id}'),
            post: post,
            repository: widget.feedRepository,
            isActive: _routeVisible && index == _activePage,
            onCommentRequested: (_) => _openComments(post),
            onRefeedRequested: (controller) => _refeedPost(post, controller),
            onShare: (controller) => _sharePost(post, controller),
            onGift: () => unawaited(_openGiftMarketplace(post)),
            onFollow:
                post.displayedPost.userId == widget.currentUserId ||
                    post.displayedPost.viewerIsFollowing
                ? null
                : () => unawaited(_followCreator(post.displayedPost)),
            onAvatar: () => _openCreatorPreview(post),
            // The outer header author is the QUOTER for quotes, else the
            // content author — tap it to open that author's profile.
            onCreatorName: () => widget.onOpenUserProfile(
              (post.isQuoteRefeed ? post : post.displayedPost).userId,
            ),
            // The embedded quote card opens the ORIGINAL POST (never a
            // profile) in the full-screen post viewer.
            onOpenOriginalPost: post.isQuoteRefeed
                ? () => _openOriginalPost(post.displayedPost)
                : null,
            // Sit the identity header just below the pinned top bar (the feed
            // is framed below it), closing the previous large gap.
            headerTopGap: FeedImmersiveTheme.spacingXs + 2,
            chromeState: _chromeState,
            onSurfaceTap: _handleSurfaceTapForPost(post, index),
            onPlaybackChange: _handlePlaybackChangeForPost(post),
          ),
        };
        return _PageTransition(
          controller: _pageController,
          index: index,
          child: card,
        );
      },
    );
  }

  /// Open a sponsored ad's link and record the click impression.
  void _handleAdCta(FeedAd ad) {
    unawaited(_postViews.recordAdClick(ad.adId));
    final url = ad.clickUrl;
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    unawaited(launchUrl(uri, mode: LaunchMode.externalApplication));
  }

  /// Single-tap from the immersive video surface. The video player decides
  /// the intent from the current playback state (playing → reveal + pause,
  /// paused → hide + resume) and forwards it here; the pager just applies it
  /// to the chrome state machine.
  void Function(FeedSurfaceTapIntent intent) _handleSurfaceTapForPost(
    FeedPost post,
    int postIndex,
  ) {
    return (intent) {
      if (!_routeVisible) return;
      _chrome.handleSurfaceTap(intent);
    };
  }

  /// Video playback callback. We only treat the active post's playback
  /// as authoritative; we ignore playback reports from off-screen pages
  /// because the ImmersiveVideoPlayer already pauses off-screen reels.
  void Function(bool isPlaying) _handlePlaybackChangeForPost(FeedPost post) {
    return (isPlaying) {
      if (!_routeVisible) return;
      final activeIndex = _activePage;
      final posts = _lastPosts;
      if (posts == null) return;
      final active = posts[activeIndex.clamp(0, posts.length - 1)];
      if (active is! FeedPostItem || active.post.id != post.id) return;
      _lastVideoPlaying = isPlaying;
      _chrome.reportVideoPlayback(isPlaying: isPlaying);
    };
  }

  Widget _buildTopOverlay(
    BuildContext context, {
    required List<FeedItem>? posts,
  }) {
    // The top chrome is part of the full chrome stage. Hidden and
    // socialOnly must not eat taps — wrap with IgnorePointer so the
    // reveal sequence still works while a fade-out animation is in
    // progress.
    final showTopChrome = _chromeState == FeedChromeVisibility.full;

    return IgnorePointer(
      ignoring: !showTopChrome,
      child: AnimatedSlide(
        offset: showTopChrome ? Offset.zero : const Offset(0, -0.1),
        duration: FeedImmersiveTheme.motionMedium,
        curve: FeedImmersiveTheme.premiumSettleCurve,
        child: AnimatedOpacity(
          opacity: showTopChrome
              ? FeedImmersiveTheme.opacityVisible
              : FeedImmersiveTheme.opacityHidden,
          duration: FeedImmersiveTheme.motionMedium,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          child: ClipRect(
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(
                sigmaX: FeedImmersiveTheme.navBlur,
                sigmaY: FeedImmersiveTheme.navBlur,
              ),
              child: DecoratedBox(
                // A pinned, opaque bar with a hairline demarcation line so the
                // feed never scrolls under it (framed below); it slides away
                // only when chrome hides for true full-screen media.
                decoration: const BoxDecoration(
                  color: FeedImmersiveTheme.navGlassSurface,
                  border: Border(
                    bottom: BorderSide(color: FeedImmersiveTheme.divider),
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 4, 8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          height: 48,
                          child: FeedTopChromeLayout(
                        leading: const Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(text: 'feed'),
                              TextSpan(
                                text: 'In',
                                style: TextStyle(
                                  color: FeedImmersiveTheme.brandPink,
                                ),
                              ),
                            ],
                          ),
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                            shadows: FeedImmersiveTheme.textShadow,
                          ),
                        ),
                        center: _ImmersiveFeedTabs(
                          key: const Key('feed-top-tabs'),
                          selectedIndex: _tabIndex,
                          onChanged: _onTabChanged,
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              tooltip: 'Search',
                              onPressed: widget.onOpenSearch,
                              constraints: const BoxConstraints.tightFor(
                                width: 32,
                                height: 32,
                              ),
                              padding: EdgeInsets.zero,
                              icon: const Icon(
                                Icons.search,
                                color: Colors.white,
                              ),
                            ),
                            _NotificationBellAction(
                              unreadCountFuture:
                                  widget.notificationUnreadCountFuture,
                              onTap: widget.onOpenNotifications,
                              foregroundColor: Colors.white,
                            ),
                            if (posts != null &&
                                posts.isNotEmpty &&
                                _tabIndex != 2)
                              Builder(
                                builder: (context) {
                                  final filtered = _filterPosts(posts);
                                  if (filtered.isEmpty) {
                                    return const SizedBox.shrink();
                                  }
                                  final active =
                                      filtered[_activePage.clamp(
                                        0,
                                        filtered.length - 1,
                                      )];
                                  if (active is! FeedPostItem) {
                                    return const SizedBox.shrink();
                                  }
                                  return IconButton(
                                    key: const Key('feed-post-more-actions'),
                                    tooltip: 'Post actions',
                                    onPressed: () => unawaited(
                                      _openPostActions(active.post),
                                    ),
                                    constraints: const BoxConstraints.tightFor(
                                      width: 32,
                                      height: 32,
                                    ),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(
                                      Icons.more_vert_rounded,
                                      color: Colors.white,
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        ),
        ),
      ),
    );
  }

  /// Filter feed items for the active media tab. Organic posts split by media
  /// type (Video / Photo); injected ads are kept in both so sponsored slots
  /// still surface regardless of the tab.
  List<FeedItem> _filterPosts(List<FeedItem> posts) {
    bool isVideo(FeedItem item) =>
        item is FeedPostItem && item.post.displayedPost.hasVideoMedia;
    // The Photos tab holds photo posts AND text-only posts (branded gradient
    // cards) — everything that isn't a video — matching the old web feed.
    bool isPhotoOrText(FeedItem item) =>
        item is FeedPostItem && !item.post.displayedPost.hasVideoMedia;
    return switch (_tabIndex) {
      0 => posts.where((item) => item is FeedAdItem || isVideo(item)).toList(),
      1 => posts
          .where((item) => item is FeedAdItem || isPhotoOrText(item))
          .toList(),
      2 => const <FeedItem>[],
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
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: controller,
        child: child,
        builder: (context, child) {
          // Distance (in pages) of this page from the current scroll position.
          double delta = 0;
          if (controller.hasClients &&
              controller.position.hasContentDimensions) {
            final page = controller.page ?? controller.initialPage.toDouble();
            delta = (page - index).abs().clamp(0.0, 1.0);
          }
          // A subtle scale-back for neighbours. No Opacity: that forces a
          // per-frame saveLayer on the full-screen page and is the main scroll
          // jank source — a paint-time Transform is effectively free.
          final scale = 1.0 - (0.04 * delta);
          return Transform.scale(scale: scale, child: child);
        },
      ),
    );
  }
}

class _ImmersiveFeedTabs extends StatelessWidget {
  const _ImmersiveFeedTabs({
    super.key,
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
            isLive: _labels[i] == 'Live',
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
    this.isLive = false,
  });

  final String label;
  final bool selected;
  final bool isLive;
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
        duration: FeedImmersiveTheme.motionPress,
        curve: FeedImmersiveTheme.premiumSettleCurve,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.isLive) ...[
                    const _LiveDot(),
                    const SizedBox(width: 6),
                  ],
                  AnimatedDefaultTextStyle(
                    duration: FeedImmersiveTheme.motionFast,
                    curve: FeedImmersiveTheme.premiumSettleCurve,
                    style: TextStyle(
                      color: selected ? Colors.white : Colors.white60,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                      fontSize: 10,
                      letterSpacing: selected ? 0.0 : 0.1,
                      shadows: FeedImmersiveTheme.textShadow,
                    ),
                    child: Text(widget.label),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              AnimatedContainer(
                duration: FeedImmersiveTheme.motionFast,
                curve: FeedImmersiveTheme.premiumSettleCurve,
                height: 2,
                width: selected ? 18 : 0,
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

/// Softly pulsing "live" indicator dot used on the Live feed tab.
class _LiveDot extends StatefulWidget {
  const _LiveDot();

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionLivePulse,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _pulse,
        builder: (context, _) {
          final t = Curves.easeInOut.transform(_pulse.value);
          return Container(
            width: FeedImmersiveTheme.liveDotSize,
            height: FeedImmersiveTheme.liveDotSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: FeedImmersiveTheme.liveDot,
              boxShadow: [
                BoxShadow(
                  color: FeedImmersiveTheme.liveDotGlow,
                  blurRadius: 4 + (6 * t),
                  spreadRadius: 0.5 * t,
                ),
              ],
            ),
          );
        },
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
      duration: FeedImmersiveTheme.motionLoading,
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
                  CurvedAnimation(
                    parent: _controller,
                    curve: FeedImmersiveTheme.gentleCurve,
                  ),
                ),
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: FeedImmersiveTheme.brandGradient,
                    boxShadow: FeedImmersiveTheme.brandGlow,
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
