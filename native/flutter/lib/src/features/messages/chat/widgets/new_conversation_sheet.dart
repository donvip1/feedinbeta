import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/media/cached_image.dart';
import '../chat_theme.dart';
import '../chat_view_models.dart';

/// Which roster the new-conversation sheet is currently showing.
///
/// Declared here because [NewConversationSheet] is the only widget that owns
/// this concept; it is exported for the screen layer that drives the tabs.
enum NewConversationTab { friends, search }

/// Full-height bottom-sheet / route body for starting a 1:1 conversation.
///
/// Mirrors the web `NewConversationModal`: a header ("New Conversation", or
/// "Share Image With…" when forwarding an image), an optional shared-image
/// thumbnail preview, a debounced search field (strips a leading '@'), two
/// segmented tabs (Friends / Search, the latter showing a count badge), and a
/// scrollable list of [RecipientView] rows whose trailing action is derived
/// from each recipient's [FriendshipStatus].
///
/// This widget is purely presentational. It owns nothing but the debounce
/// [Timer] for the search field — all data and side effects flow through the
/// props. The close affordance is intentionally NOT rendered here: the parent
/// route / sheet provides it (drag handle, app-bar back button, etc.).
///
/// The "Add friend" path is rendered disabled when [onAddFriend] is null,
/// reflecting that the 5-credit friend-request flow is excluded from this
/// build (server-owned / monetization, deferred).
class NewConversationSheet extends StatefulWidget {
  const NewConversationSheet({
    super.key,
    required this.searchController,
    required this.tab,
    required this.results,
    this.isLoading = false,
    this.sharedImageThumbUrl,
    required this.onTabChanged,
    required this.onQueryChanged,
    required this.onStartChat,
    this.onAddFriend,
    this.onAcceptRequest,
    this.onDeclineRequest,
    this.onOpenProfile,
  });

  /// External controller so the screen keeps the query text across rebuilds.
  final TextEditingController searchController;

  /// The currently selected tab.
  final NewConversationTab tab;

  /// Rows to render for the active tab (the screen filters/sorts upstream).
  final List<RecipientView> results;

  /// Whether the active tab is loading its roster / search results.
  final bool isLoading;

  /// When non-null, the sheet is in "share image" mode and shows a thumbnail.
  final String? sharedImageThumbUrl;

  final void Function(NewConversationTab tab) onTabChanged;

  /// Fired ~300ms after the user stops typing (already '@'-stripped).
  final void Function(String query) onQueryChanged;

  /// Open / start a 1:1 chat with an accepted friend.
  final void Function(RecipientView recipient) onStartChat;

  /// Send a friend request. Null disables the "Add" action (credit path off).
  final void Function(RecipientView recipient)? onAddFriend;

  /// Accept an incoming friend request (pendingReceived rows).
  final void Function(RecipientView recipient)? onAcceptRequest;

  /// Decline an incoming friend request (pendingReceived rows).
  final void Function(RecipientView recipient)? onDeclineRequest;

  /// Open a recipient's profile (avatar tap).
  final void Function(ChatUserRef user)? onOpenProfile;

  @override
  State<NewConversationSheet> createState() => _NewConversationSheetState();
}

class _NewConversationSheetState extends State<NewConversationSheet> {
  static const Duration _debounce = Duration(milliseconds: 300);

  Timer? _debounceTimer;

  /// Local mirror so the clear button + empty-state copy react immediately,
  /// without waiting for the debounced [onQueryChanged] round-trip.
  String _query = '';

  @override
  void initState() {
    super.initState();
    _query = widget.searchController.text;
    widget.searchController.addListener(_handleControllerChanged);
  }

  @override
  void dispose() {
    widget.searchController.removeListener(_handleControllerChanged);
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _handleControllerChanged() {
    // Keep the local view of the raw text in sync (drives the clear button).
    final raw = widget.searchController.text;
    if (raw != _query && mounted) {
      setState(() => _query = raw);
    }
  }

  void _onChanged(String raw) {
    setState(() => _query = raw);
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounce, () {
      final cleaned = _stripLeadingAt(raw).trim();
      widget.onQueryChanged(cleaned);
    });
  }

  void _clear() {
    _debounceTimer?.cancel();
    widget.searchController.clear();
    setState(() => _query = '');
    widget.onQueryChanged('');
  }

  static String _stripLeadingAt(String value) {
    final trimmed = value.trimLeft();
    return trimmed.startsWith('@') ? trimmed.substring(1) : trimmed;
  }

  bool get _hasQuery => _stripLeadingAt(_query).trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final isShareMode = widget.sharedImageThumbUrl != null;

    return Container(
      color: ChatColors.background,
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.max,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(isShareMode: isShareMode),
            if (isShareMode)
              _SharedImagePreview(thumbUrl: widget.sharedImageThumbUrl!),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChatSpacing.lg,
                ChatSpacing.sm,
                ChatSpacing.lg,
                ChatSpacing.md,
              ),
              child: _SearchField(
                controller: widget.searchController,
                hasText: _query.isNotEmpty,
                onChanged: _onChanged,
                onClear: _clear,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.lg),
              child: _Tabs(
                tab: widget.tab,
                searchCount: widget.results.length,
                onTabChanged: widget.onTabChanged,
              ),
            ),
            const SizedBox(height: ChatSpacing.sm),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (widget.isLoading) {
      return const Center(
        child: SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            valueColor: AlwaysStoppedAnimation<Color>(ChatColors.primary),
          ),
        ),
      );
    }

    if (widget.results.isEmpty) {
      return _EmptyState(
        tab: widget.tab,
        hasQuery: _hasQuery,
        onSearchHint: () => widget.onTabChanged(NewConversationTab.search),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.sm,
        ChatSpacing.xs,
        ChatSpacing.sm,
        ChatSpacing.xl,
      ),
      itemCount: widget.results.length,
      separatorBuilder: (_, __) => const SizedBox(height: 2),
      itemBuilder: (context, index) {
        final recipient = widget.results[index];
        return _RecipientRow(
          recipient: recipient,
          onStartChat: () => widget.onStartChat(recipient),
          onAddFriend: widget.onAddFriend == null
              ? null
              : () => widget.onAddFriend!(recipient),
          onAccept: widget.onAcceptRequest == null
              ? null
              : () => widget.onAcceptRequest!(recipient),
          onDecline: widget.onDeclineRequest == null
              ? null
              : () => widget.onDeclineRequest!(recipient),
          onOpenProfile: widget.onOpenProfile == null
              ? null
              : () => widget.onOpenProfile!(recipient.user),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({required this.isShareMode});

  final bool isShareMode;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: ChatSpacing.headerHeight,
      padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.lg),
      alignment: Alignment.centerLeft,
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: ChatColors.border, width: 0.5),
        ),
      ),
      child: Text(
        isShareMode ? 'Share Image With…' : 'New Conversation',
        style: ChatTextStyles.headerName,
      ),
    );
  }
}

class _SharedImagePreview extends StatelessWidget {
  const _SharedImagePreview({required this.thumbUrl});

  final String thumbUrl;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.lg,
        ChatSpacing.md,
        ChatSpacing.lg,
        0,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(ChatRadii.md),
            child: Container(
              width: 56,
              height: 56,
              color: ChatColors.muted,
              child: CachedImage(
                url: thumbUrl,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                placeholderColor: ChatColors.muted,
                errorWidget: const Icon(
                  Icons.image_outlined,
                  color: ChatColors.mutedForeground,
                ),
              ),
            ),
          ),
          const SizedBox(width: ChatSpacing.md),
          const Expanded(
            child: Text(
              'Choose who to share this image with',
              style: ChatTextStyles.subtitle,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Search field
// ---------------------------------------------------------------------------

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hasText,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final bool hasText;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: TextInputAction.search,
      cursorColor: ChatColors.primary,
      style: const TextStyle(fontSize: 15, color: ChatColors.foreground),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: ChatColors.input,
        hintText: 'Search by username (without @)…',
        hintStyle: const TextStyle(
          fontSize: 15,
          color: ChatColors.mutedForeground,
        ),
        prefixIcon: const Icon(
          Icons.search,
          size: 20,
          color: ChatColors.mutedForeground,
        ),
        suffixIcon: hasText
            ? IconButton(
                icon: const Icon(
                  Icons.close,
                  size: 18,
                  color: ChatColors.mutedForeground,
                ),
                splashRadius: 18,
                tooltip: 'Clear',
                onPressed: onClear,
              )
            : null,
        contentPadding: const EdgeInsets.symmetric(
          vertical: ChatSpacing.md,
          horizontal: ChatSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ChatRadii.md),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ChatRadii.md),
          borderSide: const BorderSide(color: ChatColors.border, width: 0.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ChatRadii.md),
          borderSide: const BorderSide(color: ChatColors.primary, width: 1.5),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Segmented tabs
// ---------------------------------------------------------------------------

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.tab,
    required this.searchCount,
    required this.onTabChanged,
  });

  final NewConversationTab tab;
  final int searchCount;
  final void Function(NewConversationTab tab) onTabChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: ChatColors.muted,
        borderRadius: BorderRadius.circular(ChatRadii.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabButton(
              label: 'Friends',
              selected: tab == NewConversationTab.friends,
              onTap: () => onTabChanged(NewConversationTab.friends),
            ),
          ),
          Expanded(
            child: _TabButton(
              label: 'Search',
              selected: tab == NewConversationTab.search,
              badgeCount: searchCount > 0 ? searchCount : null,
              onTap: () => onTabChanged(NewConversationTab.search),
            ),
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
    this.badgeCount,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? badgeCount;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? ChatColors.background : Colors.transparent,
      borderRadius: BorderRadius.circular(ChatRadii.sm),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ChatRadii.sm),
        child: Container(
          height: 34,
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? ChatColors.foreground
                      : ChatColors.mutedForeground,
                ),
              ),
              if (badgeCount != null) ...[
                const SizedBox(width: 6),
                _TabBadge(count: badgeCount!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TabBadge extends StatelessWidget {
  const _TabBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      constraints: const BoxConstraints(minWidth: 18),
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: ChatColors.primary,
        borderRadius: BorderRadius.circular(ChatRadii.pill),
      ),
      child: Text(label, style: ChatTextStyles.badge),
    );
  }
}

// ---------------------------------------------------------------------------
// Recipient row
// ---------------------------------------------------------------------------

class _RecipientRow extends StatelessWidget {
  const _RecipientRow({
    required this.recipient,
    required this.onStartChat,
    this.onAddFriend,
    this.onAccept,
    this.onDecline,
    this.onOpenProfile,
  });

  final RecipientView recipient;
  final VoidCallback onStartChat;
  final VoidCallback? onAddFriend;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final VoidCallback? onOpenProfile;

  @override
  Widget build(BuildContext context) {
    final user = recipient.user;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ChatSpacing.md,
        vertical: ChatSpacing.sm,
      ),
      constraints: const BoxConstraints(
        minHeight: ChatSpacing.listItemMinHeight,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _RecipientAvatar(user: user, onTap: onOpenProfile),
          const SizedBox(width: ChatSpacing.md),
          Expanded(child: _identity(user)),
          const SizedBox(width: ChatSpacing.sm),
          _action(),
        ],
      ),
    );
  }

  Widget _identity(ChatUserRef user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                user.displayName.isEmpty ? 'Unknown User' : user.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ChatTextStyles.conversationName,
              ),
            ),
            if (user.isVerified) ...[
              const SizedBox(width: ChatSpacing.xs),
              const Icon(Icons.verified, size: 14, color: ChatColors.primary),
            ],
          ],
        ),
        if (user.username != null && user.username!.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            '@${user.username}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: ChatTextStyles.previewMuted,
          ),
        ],
      ],
    );
  }

  Widget _action() {
    if (recipient.isProcessing) {
      return const SizedBox(
        width: 24,
        height: 24,
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(ChatColors.primary),
            ),
          ),
        ),
      );
    }

    switch (recipient.friendship) {
      case FriendshipStatus.accepted:
        return _PrimaryActionButton(
          icon: Icons.chat_bubble_outline,
          label: 'Chat',
          onPressed: onStartChat,
        );
      case FriendshipStatus.pendingSent:
        return const _PendingChip();
      case FriendshipStatus.pendingReceived:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _PrimaryActionButton(
              icon: Icons.check,
              label: 'Accept',
              onPressed: onAccept,
            ),
            const SizedBox(width: ChatSpacing.xs),
            _OutlineIconButton(
              icon: Icons.close,
              tooltip: 'Decline',
              onPressed: onDecline,
            ),
          ],
        );
      case FriendshipStatus.none:
        return _OutlineActionButton(
          icon: Icons.person_add_alt_1,
          label: 'Add',
          // Disabled when the credit-gated add path is excluded.
          onPressed: onAddFriend,
        );
    }
  }
}

class _RecipientAvatar extends StatelessWidget {
  const _RecipientAvatar({required this.user, this.onTap});

  final ChatUserRef user;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    const size = ChatSpacing.avatarMd;

    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: ChatGradients.avatarFallback,
      ),
      child: Text(
        user.initial,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: ChatColors.primaryForeground,
        ),
      ),
    );

    final avatar = CachedCircleAvatar(
      url: user.avatarUrl,
      radius: size / 2,
      fallback: fallback,
    );

    if (onTap == null) return avatar;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: avatar,
    );
  }
}

// ---------------------------------------------------------------------------
// Action affordances
// ---------------------------------------------------------------------------

/// Filled, gradient-pink pill button used for the primary "Chat" / "Accept".
class _PrimaryActionButton extends StatelessWidget {
  const _PrimaryActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;

    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(ChatRadii.sm),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(ChatRadii.sm),
          child: Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.md),
            decoration: BoxDecoration(
              gradient: ChatGradients.sendAction,
              borderRadius: BorderRadius.circular(ChatRadii.sm),
              boxShadow: enabled ? ChatShadows.pink : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: ChatColors.primaryForeground),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: ChatColors.primaryForeground,
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

/// Bordered "Add"-style pill button (greyed-out when [onPressed] is null).
class _OutlineActionButton extends StatelessWidget {
  const _OutlineActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final color = enabled ? ChatColors.foreground : ChatColors.mutedForeground;

    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(ChatRadii.sm),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(ChatRadii.sm),
          child: Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(ChatRadii.sm),
              border: Border.all(color: ChatColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: color,
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

/// Square bordered icon button (the "Decline" affordance).
class _OutlineIconButton extends StatelessWidget {
  const _OutlineIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;

    final button = Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(ChatRadii.sm),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(ChatRadii.sm),
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ChatRadii.sm),
            border: Border.all(color: ChatColors.border),
          ),
          child: Icon(icon, size: 18, color: ChatColors.mutedForeground),
        ),
      ),
    );

    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Tooltip(message: tooltip, child: button),
    );
  }
}

/// Disabled "Pending" chip for outgoing-request rows.
class _PendingChip extends StatelessWidget {
  const _PendingChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.md),
      decoration: BoxDecoration(
        color: ChatColors.muted,
        borderRadius: BorderRadius.circular(ChatRadii.sm),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.schedule, size: 14, color: ChatColors.mutedForeground),
          SizedBox(width: 6),
          Text(
            'Pending',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: ChatColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.tab,
    required this.hasQuery,
    required this.onSearchHint,
  });

  final NewConversationTab tab;
  final bool hasQuery;
  final VoidCallback onSearchHint;

  @override
  Widget build(BuildContext context) {
    final IconData icon;
    final String title;
    final String subtitle;
    final bool showSearchHint;

    if (tab == NewConversationTab.friends) {
      icon = Icons.people_outline;
      title = 'No friends yet';
      subtitle = 'Search for users to add as friends';
      showSearchHint = true;
    } else if (!hasQuery) {
      icon = Icons.search;
      title = 'Search for users';
      subtitle = 'Enter a username to find and add new friends';
      showSearchHint = false;
    } else {
      icon = Icons.people_outline;
      title = 'No users found';
      subtitle = 'Try searching with a different username';
      showSearchHint = false;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ChatSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: ChatColors.mutedForeground),
            const SizedBox(height: ChatSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: ChatColors.foreground,
              ),
            ),
            const SizedBox(height: ChatSpacing.xs),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: ChatTextStyles.previewMuted,
            ),
            if (showSearchHint) ...[
              const SizedBox(height: ChatSpacing.md),
              TextButton(
                onPressed: onSearchHint,
                style: TextButton.styleFrom(
                  foregroundColor: ChatColors.primary,
                ),
                child: const Text(
                  'Search users',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: ChatColors.primary,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
