import 'package:flutter/material.dart';

import '../contacts_theme.dart';
import 'contact_action_button.dart';
import 'contact_avatar.dart';

/// A phone-book contact that is NOT on feedIn: name + number + an "Invite"
/// button that opens the platform SMS composer with a prefilled message.
class InviteContactTile extends StatelessWidget {
  const InviteContactTile({
    super.key,
    required this.name,
    required this.number,
    required this.onInvite,
    this.busy = false,
  });

  final String name;
  final String number;
  final VoidCallback onInvite;
  final bool busy;

  @override
  Widget build(BuildContext context) {
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
          ContactAvatar(name: name),
          const SizedBox(width: ContactsSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ContactsTextStyles.rowTitle,
                ),
                const SizedBox(height: 2),
                Text(
                  number,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ContactsTextStyles.rowSubtitle,
                ),
              ],
            ),
          ),
          const SizedBox(width: ContactsSpacing.sm),
          ContactActionButton(
            label: 'Invite',
            icon: Icons.ios_share_rounded,
            filled: false,
            busy: busy,
            onTap: onInvite,
          ),
        ],
      ),
    );
  }
}
