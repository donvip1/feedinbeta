import 'package:flutter/material.dart';

import '../contacts_theme.dart';
import '../data/contacts_remote_data_source.dart';
import 'contact_action_button.dart';
import 'contact_avatar.dart';

/// A row for a contact that IS already on feedIn: avatar + name/@handle + a
/// Follow / Following toggle. The toggle state is driven by the parent
/// (optimistic), and [busy] shows a spinner while the follow write is in flight.
class MatchedContactTile extends StatelessWidget {
  const MatchedContactTile({
    super.key,
    required this.contact,
    required this.following,
    required this.busy,
    required this.onToggleFollow,
  });

  final MatchedContact contact;
  final bool following;
  final bool busy;
  final VoidCallback onToggleFollow;

  @override
  Widget build(BuildContext context) {
    final subtitle = contact.username.isNotEmpty ? '@${contact.username}' : null;
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: ContactsSpacing.lg,
        vertical: ContactsSpacing.xs,
      ),
      padding: const EdgeInsets.all(ContactsSpacing.md),
      decoration: BoxDecoration(
        color: ContactsColors.rowCard,
        borderRadius: ContactsRadii.card,
        border: Border.all(color: ContactsColors.rowCardBorder),
      ),
      child: Row(
        children: [
          ContactAvatar(name: contact.title, avatarUrl: contact.avatarUrl),
          const SizedBox(width: ContactsSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  contact.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ContactsTextStyles.rowTitle,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ContactsTextStyles.rowSubtitle,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: ContactsSpacing.sm),
          ContactActionButton(
            label: following ? 'Following' : 'Follow',
            icon: following ? Icons.check_rounded : Icons.person_add_alt_1,
            filled: !following,
            busy: busy,
            onTap: onToggleFollow,
          ),
        ],
      ),
    );
  }
}
