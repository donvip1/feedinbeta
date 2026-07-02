/// Icon TabBar for the profile content section: Posts / Reels / Tagged / Saved.
///
/// A thin wrapper over Material's [TabBar] styled with the shared profile
/// tokens (brand-pink indicator, muted inactive icons). Pure presentational —
/// the host owns the [TabController] and the tab views.
library;

import 'package:flutter/material.dart';

import '../parity/profile_tokens.dart';

/// The four content tabs, in render order. The host maps each to a view.
enum ProfileContentTab { posts, reels, tagged, saved }

/// Icons for each tab, exposed so the host can reuse them elsewhere.
const Map<ProfileContentTab, IconData> profileTabIcons = {
  ProfileContentTab.posts: Icons.grid_view_rounded,
  ProfileContentTab.reels: Icons.movie_creation_outlined,
  ProfileContentTab.tagged: Icons.person_pin_outlined,
  ProfileContentTab.saved: Icons.bookmark_border_rounded,
};

/// A brand-styled 4-icon [TabBar]. [controller] must have length 4.
class ProfileTabBar extends StatelessWidget {
  const ProfileTabBar({super.key, required this.controller});

  final TabController controller;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: ProfileColors.border),
        ),
      ),
      child: TabBar(
        controller: controller,
        indicatorColor: ProfileColors.primary,
        indicatorWeight: 2.5,
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: ProfileColors.primary,
        unselectedLabelColor: ProfileColors.mutedForeground,
        dividerColor: Colors.transparent,
        tabs: const [
          Tab(icon: Icon(Icons.grid_view_rounded), text: 'Posts'),
          Tab(icon: Icon(Icons.movie_creation_outlined), text: 'Reels'),
          Tab(icon: Icon(Icons.person_pin_outlined), text: 'Tagged'),
          Tab(icon: Icon(Icons.bookmark_border_rounded), text: 'Saved'),
        ],
      ),
    );
  }
}
