import 'package:flutter/material.dart';

enum FeedPostMenuAction { promote, delete }

Future<FeedPostMenuAction?> showFeedPostActionsSheet(
  BuildContext context, {
  required bool canDelete,
  required bool canPromote,
}) {
  return showModalBottomSheet<FeedPostMenuAction>(
    context: context,
    backgroundColor: const Color(0xFF111318),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
    ),
    builder: (context) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (canPromote)
              ListTile(
                leading: const Icon(
                  Icons.campaign_rounded,
                  color: Color(0xFF35C6C3),
                ),
                title: const Text(
                  'Promote post',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const Text(
                  'Reach more people with a credit campaign',
                  style: TextStyle(color: Color(0xFFA8AFBA)),
                ),
                onTap: () =>
                    Navigator.of(context).pop(FeedPostMenuAction.promote),
              ),
            if (canDelete)
              ListTile(
                leading: const Icon(
                  Icons.delete_outline_rounded,
                  color: Color(0xFFFF7C8D),
                ),
                title: const Text(
                  'Delete post',
                  style: TextStyle(
                    color: Color(0xFFFFA3AF),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () =>
                    Navigator.of(context).pop(FeedPostMenuAction.delete),
              ),
          ],
        ),
      ),
    ),
  );
}
