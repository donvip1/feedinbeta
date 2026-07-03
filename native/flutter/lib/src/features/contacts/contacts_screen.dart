import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/contacts/contact_hasher.dart';
import '../../data/remote/social_graph_remote_data_source.dart';
import 'contacts_theme.dart';
import 'data/contacts_remote_data_source.dart';
import 'widgets/contact_tile_skeleton.dart';
import 'widgets/contacts_message_state.dart';
import 'widgets/contacts_section_header.dart';
import 'widgets/discoverability_field.dart';
import 'widgets/invite_contact_tile.dart';
import 'widgets/matched_contact_tile.dart';

/// A phone-book contact that has a name + number but is NOT on feedIn — the
/// payload for an "Invite to feedIn" row.
class _InviteCandidate {
  const _InviteCandidate({required this.name, required this.number});
  final String name;
  final String number;
}

/// The overall phase of the contacts flow, driving which state the screen shows.
enum _Phase {
  /// Requesting permission / reading contacts / matching.
  loading,

  /// Permission was denied (or permanently denied).
  permissionDenied,

  /// Loaded successfully (may still be empty → handled in the body).
  loaded,

  /// Reading contacts or matching threw.
  error,
}

/// Public entry point for "find friends from contacts" (Module 6).
///
/// Requests the Contacts permission, reads the phone book, hashes every number
/// on-device ([ContactHasher]) and asks the backend which of them are already
/// on feedIn ([ContactsRemoteDataSource.matchContacts]). It then shows two
/// sections:
///   * **On feedIn** — matched users, each with an optimistic Follow / Following
///     toggle (reusing [SocialGraphRemoteDataSource.follow]).
///   * **Invite to feedIn** — contacts with a name + number but no match, each
///     with an Invite button that opens the platform SMS composer.
///
/// It also lets the user register their OWN number so others can discover them
/// ([ContactsRemoteDataSource.registerMyPhoneHash]).
///
/// Mirrors the GroupsScreen / ChannelsScreen shape so the coordinator can push
/// it from the Chats surface. Both data sources self-detect configuration via
/// `autoDetect` and degrade to honest empty states, so this is safe to mount
/// even before the backend is reachable.
///
/// NOTE: the Android manifest needs the `READ_CONTACTS` permission for the
/// phone-book read to succeed (the coordinator wires this).
class ContactsScreen extends StatefulWidget {
  const ContactsScreen({
    super.key,
    this.currentUserId,
    this.dataSource,
    this.socialGraph,
    this.onBack,
  });

  /// The signed-in user's id. Optional: the data sources resolve the auth user
  /// themselves; accepted for symmetry with the other feature entries.
  final String? currentUserId;

  /// Optional injected contacts source; defaults to
  /// [ContactsRemoteDataSource.autoDetect].
  final ContactsRemoteDataSource? dataSource;

  /// Optional injected follow graph; defaults to
  /// [SocialGraphRemoteDataSource.autoDetect].
  final SocialGraphRemoteDataSource? socialGraph;

  /// Optional back affordance. When null, no back button is shown (the screen
  /// is assumed to be a tab). When provided, a back button is rendered.
  final VoidCallback? onBack;

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  late final ContactsRemoteDataSource _dataSource;
  late final SocialGraphRemoteDataSource _socialGraph;
  final _phoneController = TextEditingController();

  int _requestToken = 0;
  _Phase _phase = _Phase.loading;

  List<MatchedContact> _matched = const [];
  List<_InviteCandidate> _invites = const [];

  /// Matched user ids the viewer currently follows (optimistic).
  final Set<String> _following = <String>{};

  /// Matched user ids with an in-flight follow toggle.
  final Set<String> _followBusy = <String>{};

  /// Whether any phone book contacts were read at all (for empty-vs-no-match).
  bool _hadContacts = false;

  bool _registeringNumber = false;
  bool _numberRegistered = false;

  @override
  void initState() {
    super.initState();
    _dataSource = widget.dataSource ?? ContactsRemoteDataSource.autoDetect();
    _socialGraph = widget.socialGraph ?? SocialGraphRemoteDataSource.autoDetect();
    _bootstrap();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Load pipeline
  // ---------------------------------------------------------------------------

  Future<void> _bootstrap() async {
    final token = ++_requestToken;
    setState(() => _phase = _Phase.loading);

    final status = await _requestContactsPermission();
    if (!mounted || token != _requestToken) return;
    if (!status.isGranted && !status.isLimited) {
      setState(() => _phase = _Phase.permissionDenied);
      return;
    }

    await _loadContacts(token);
  }

  Future<PermissionStatus> _requestContactsPermission() async {
    try {
      return await Permission.contacts.request();
    } catch (error) {
      debugPrint('ContactsScreen: permission request failed: $error');
      return PermissionStatus.denied;
    }
  }

  Future<void> _loadContacts(int token) async {
    try {
      final contacts = await FlutterContacts.getContacts(
        withProperties: true,
      );
      if (!mounted || token != _requestToken) return;

      final result = _buildLookup(contacts);
      final matched = result.hashes.isEmpty
          ? const <MatchedContact>[]
          : await _dataSource.matchContacts(result.hashes);
      if (!mounted || token != _requestToken) return;

      // The invite list is keyed by phone number and the match RPC returns
      // profiles (no phone in the row), so there is no per-row overlap to strip.
      setState(() {
        _matched = matched;
        _invites = result.invites;
        _hadContacts = result.hadContacts;
        _following.clear();
        _followBusy.clear();
        _phase = _Phase.loaded;
      });
    } catch (error, stack) {
      debugPrint('ContactsScreen: loadContacts failed: $error');
      debugPrintStack(stackTrace: stack);
      if (!mounted || token != _requestToken) return;
      setState(() => _phase = _Phase.error);
    }
  }

  /// Reads the phone book into hash candidates + invite candidates.
  _ContactLookup _buildLookup(List<Contact> contacts) {
    final hashes = <String>{};
    final invites = <_InviteCandidate>[];
    final seenNumbers = <String>{};
    var hadContacts = false;

    for (final contact in contacts) {
      final phones = contact.phones;
      if (phones.isEmpty) continue;
      hadContacts = true;

      for (final phone in phones) {
        final raw = phone.number;
        final candidates = ContactHasher.hashesFor(raw);
        if (candidates.isEmpty) continue;
        hashes.addAll(candidates);

        // One invite candidate per distinct number that has a display name.
        final normalized = ContactHasher.normalize(raw);
        final name = contact.displayName.trim();
        if (name.isNotEmpty && seenNumbers.add(normalized)) {
          invites.add(_InviteCandidate(name: name, number: raw.trim()));
        }
      }
    }

    invites.sort(
      (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
    );
    return _ContactLookup(
      hashes: hashes.toList(),
      invites: invites,
      hadContacts: hadContacts,
    );
  }

  // ---------------------------------------------------------------------------
  // Follow
  // ---------------------------------------------------------------------------

  Future<void> _toggleFollow(MatchedContact contact) async {
    if (_followBusy.contains(contact.id)) return;
    final wasFollowing = _following.contains(contact.id);

    // Optimistic flip.
    setState(() {
      _followBusy.add(contact.id);
      if (wasFollowing) {
        _following.remove(contact.id);
      } else {
        _following.add(contact.id);
      }
    });

    try {
      if (wasFollowing) {
        await _socialGraph.unfollow(contact.id);
      } else {
        await _socialGraph.follow(contact.id);
      }
    } catch (error) {
      debugPrint('ContactsScreen: follow toggle failed: $error');
      if (!mounted) return;
      // Roll back on failure.
      setState(() {
        if (wasFollowing) {
          _following.add(contact.id);
        } else {
          _following.remove(contact.id);
        }
      });
      _toast('Could not update follow. Try again.');
    } finally {
      if (mounted) {
        setState(() => _followBusy.remove(contact.id));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Invite (platform SMS composer)
  // ---------------------------------------------------------------------------

  Future<void> _invite(_InviteCandidate candidate) async {
    const message =
        'Join me on feedIn! Download the app and follow me: https://feedin.app';
    final digits = ContactHasher.normalize(candidate.number);
    // `sms:<number>?body=<msg>` opens the platform SMS composer prefilled.
    final uri = Uri(
      scheme: 'sms',
      path: digits.isNotEmpty ? digits : candidate.number,
      queryParameters: {'body': message},
    );

    try {
      if (await canLaunchUrl(uri)) {
        final launched = await launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
        );
        if (launched) return;
      }
    } catch (error) {
      debugPrint('ContactsScreen: invite launch failed: $error');
    }
    if (!mounted) return;
    _toast('Could not open Messages on this device.');
  }

  // ---------------------------------------------------------------------------
  // Register own number
  // ---------------------------------------------------------------------------

  Future<void> _registerNumber() async {
    final raw = _phoneController.text;
    final hash = ContactHasher.canonicalHashFor(raw);
    if (hash.isEmpty) {
      _toast('Enter a valid phone number.');
      return;
    }
    if (!_dataSource.hasSession) {
      _toast('Sign in to be discoverable.');
      return;
    }

    setState(() => _registeringNumber = true);
    final ok = await _dataSource.registerMyPhoneHash(hash);
    if (!mounted) return;
    setState(() {
      _registeringNumber = false;
      _numberRegistered = ok;
    });
    _toast(
      ok
          ? 'You\'re now discoverable to friends who have your number.'
          : 'Could not register your number. Try again.',
    );
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openSystemSettings() async {
    try {
      await openAppSettings();
    } catch (error) {
      debugPrint('ContactsScreen: openAppSettings failed: $error');
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: ContactsColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(onBack: widget.onBack),
            Expanded(
              child: RefreshIndicator(
                color: ContactsColors.primary,
                backgroundColor: ContactsColors.card,
                onRefresh: _bootstrap,
                child: _buildBody(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _Phase.loading:
        return _buildLoading();
      case _Phase.permissionDenied:
        return ContactsMessageState(
          icon: Icons.contacts_outlined,
          title: 'Find friends from contacts',
          body: 'Allow access to your contacts to see which friends are '
              'already on feedIn and invite the rest.',
          primaryLabel: 'Open settings',
          onPrimary: _openSystemSettings,
          secondaryLabel: 'Try again',
          onSecondary: _bootstrap,
        );
      case _Phase.error:
        return ContactsMessageState(
          icon: Icons.error_outline,
          title: 'Something went wrong',
          body: 'We couldn\'t read your contacts. Pull to refresh or try again.',
          primaryLabel: 'Retry',
          onPrimary: _bootstrap,
        );
      case _Phase.loaded:
        return _buildLoaded();
    }
  }

  Widget _buildLoading() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(
        top: ContactsSpacing.md,
        bottom: ContactsSpacing.xl,
      ),
      children: const [
        ContactsSectionHeader(label: 'On feedIn'),
        ContactTileSkeleton(),
        ContactTileSkeleton(),
        ContactTileSkeleton(),
      ],
    );
  }

  Widget _buildLoaded() {
    // A single scrollable list holds the discoverability field, both sections,
    // and the empty state so RefreshIndicator works throughout.
    final hasAnything = _matched.isNotEmpty || _invites.isNotEmpty;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: ContactsSpacing.xl),
      children: [
        DiscoverabilityField(
          controller: _phoneController,
          busy: _registeringNumber,
          registered: _numberRegistered,
          onSubmit: _registerNumber,
        ),
        if (!hasAnything)
          _buildEmptyInline()
        else ...[
          if (_matched.isNotEmpty) ...[
            ContactsSectionHeader(
              label: 'On feedIn',
              count: _matched.length,
            ),
            for (final contact in _matched)
              MatchedContactTile(
                contact: contact,
                following: _following.contains(contact.id),
                busy: _followBusy.contains(contact.id),
                onToggleFollow: () => _toggleFollow(contact),
              ),
          ],
          if (_invites.isNotEmpty) ...[
            ContactsSectionHeader(
              label: 'Invite to feedIn',
              count: _invites.length,
            ),
            for (final candidate in _invites)
              InviteContactTile(
                name: candidate.name,
                number: candidate.number,
                onInvite: () => _invite(candidate),
              ),
          ],
        ],
      ],
    );
  }

  Widget _buildEmptyInline() {
    final title = _hadContacts ? 'No matches yet' : 'No contacts found';
    final body = _hadContacts
        ? 'None of your contacts are on feedIn yet. Invite them, or share your '
              'number above so friends can find you.'
        : 'We didn\'t find any contacts with a phone number to match or invite.';
    return Padding(
      padding: const EdgeInsets.only(top: ContactsSpacing.xl),
      child: ContactsMessageState(
        icon: Icons.group_outlined,
        title: title,
        body: body,
        primaryLabel: 'Refresh',
        onPrimary: _bootstrap,
      ),
    );
  }
}

/// The parsed phone book: hash candidates to match + invite candidates.
class _ContactLookup {
  const _ContactLookup({
    required this.hashes,
    required this.invites,
    required this.hadContacts,
  });

  final List<String> hashes;
  final List<_InviteCandidate> invites;
  final bool hadContacts;
}

class _Header extends StatelessWidget {
  const _Header({this.onBack});

  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ContactsSpacing.lg,
        ContactsSpacing.md,
        ContactsSpacing.sm,
        ContactsSpacing.sm,
      ),
      child: Row(
        children: [
          if (onBack != null)
            Padding(
              padding: const EdgeInsets.only(right: ContactsSpacing.xs),
              child: IconButton(
                onPressed: onBack,
                tooltip: 'Back',
                icon: const Icon(
                  Icons.arrow_back,
                  color: ContactsColors.foreground,
                ),
              ),
            ),
          const Expanded(
            child: Text('Find friends', style: ContactsTextStyles.screenTitle),
          ),
        ],
      ),
    );
  }
}
