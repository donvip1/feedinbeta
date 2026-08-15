import 'package:flutter/material.dart';

import '../wallet_theme.dart';

enum WalletTab { packages, gifts, history, sellCredits, p2p }

extension WalletTabLabel on WalletTab {
  String get label => switch (this) {
    WalletTab.packages => 'Packages',
    WalletTab.gifts => 'Gifts',
    WalletTab.history => 'History',
    WalletTab.sellCredits => 'Sell Credits',
    WalletTab.p2p => 'P2P',
  };
}

class WalletTabBar extends StatelessWidget {
  const WalletTabBar({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final WalletTab selected;
  final ValueChanged<WalletTab> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final tab in WalletTab.values) ...[
            ChoiceChip(
              key: Key('wallet-tab-${tab.name}'),
              label: Text(tab.label),
              selected: selected == tab,
              onSelected: (_) => onSelected(tab),
              showCheckmark: false,
              backgroundColor: WalletColors.card,
              selectedColor: WalletColors.primary,
              side: BorderSide(
                color: selected == tab
                    ? WalletColors.primary
                    : WalletColors.border,
              ),
              labelStyle: TextStyle(
                color: selected == tab
                    ? WalletColors.primaryForeground
                    : WalletColors.mutedForeground,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
            if (tab != WalletTab.values.last)
              const SizedBox(width: WalletSpacing.sm),
          ],
        ],
      ),
    );
  }
}
