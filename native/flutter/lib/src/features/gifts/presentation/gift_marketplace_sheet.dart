import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../data/gift_models.dart';
import '../data/gift_repository.dart';
import 'gift_activation_overlay.dart';
import 'gift_asset_view.dart';
import 'gift_credit_badge.dart';

Future<GiftSendResult?> showGiftMarketplaceSheet(
  BuildContext context, {
  required String postId,
  required GiftRepository repository,
  VoidCallback? onOpenWallet,
  bool playActivation = true,
}) async {
  final result = await showModalBottomSheet<_GiftSheetResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0xB8000000),
    builder: (_) => _GiftMarketplaceSheet(
      postId: postId,
      repository: repository,
      onOpenWallet: onOpenWallet,
    ),
  );
  if (result == null) return null;
  if (playActivation && context.mounted) {
    await showGiftActivationOverlay(context, gift: result.gift);
  }
  return result.sendResult;
}

class _GiftSheetResult {
  const _GiftSheetResult(this.gift, this.sendResult);
  final GiftCatalogItem gift;
  final GiftSendResult sendResult;
}

class _GiftMarketplaceSheet extends StatefulWidget {
  const _GiftMarketplaceSheet({
    required this.postId,
    required this.repository,
    this.onOpenWallet,
  });

  final String postId;
  final GiftRepository repository;
  final VoidCallback? onOpenWallet;

  @override
  State<_GiftMarketplaceSheet> createState() => _GiftMarketplaceSheetState();
}

class _GiftMarketplaceSheetState extends State<_GiftMarketplaceSheet>
    with SingleTickerProviderStateMixin {
  static const _uuid = Uuid();
  late final TabController _tabs = TabController(length: 3, vsync: this);
  late final Future<List<GiftCatalogItem>> _future = widget.repository
      .fetchPostGifts();
  GiftCatalogItem? _selected;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final gift = _selected;
    if (gift == null || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    final idempotencyKey = _uuid.v4();
    try {
      final result = await widget.repository.sendPostGift(
        giftId: gift.id,
        postId: widget.postId,
        idempotencyKey: idempotencyKey,
      );
      if (!mounted) return;
      Navigator.of(context).pop(_GiftSheetResult(gift, result));
    } on InsufficientCredits catch (failure) {
      if (!mounted) return;
      setState(() => _error = failure.message);
    } on GiftFailure catch (failure) {
      if (!mounted) return;
      setState(() => _error = failure.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: .82,
      minChildSize: .58,
      maxChildSize: .94,
      expand: false,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0E1015),
          borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
          border: Border(top: BorderSide(color: Color(0xFF2D323B))),
        ),
        child: Column(
          children: [
            const SizedBox(height: 9),
            Container(width: 42, height: 4, color: const Color(0xFF555D69)),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Send a Gift',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.volume_up_outlined,
                    color: Color(0xFFA8AFBA),
                    size: 20,
                  ),
                ],
              ),
            ),
            TabBar(
              controller: _tabs,
              labelColor: Colors.white,
              unselectedLabelColor: const Color(0xFF8F96A2),
              indicatorColor: const Color(0xFF35C6C3),
              tabs: const [
                Tab(text: 'Basic'),
                Tab(text: 'Premium'),
                Tab(text: 'Exclusive'),
              ],
            ),
            Expanded(
              child: FutureBuilder<List<GiftCatalogItem>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return Center(
                      child: Text(
                        snapshot.error.toString(),
                        style: const TextStyle(color: Colors.white70),
                      ),
                    );
                  }
                  final gifts = snapshot.data ?? const [];
                  return TabBarView(
                    controller: _tabs,
                    children: [
                      for (final tier in GiftTier.values)
                        _GiftGrid(
                          controller: scrollController,
                          tier: tier,
                          gifts: gifts
                              .where((gift) => gift.tier == tier)
                              .toList(),
                          selected: _selected,
                          onSelect: (gift) => setState(() => _selected = gift),
                        ),
                    ],
                  );
                },
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: Color(0xFFFF8B9A),
                          fontSize: 12,
                        ),
                      ),
                    ),
                    if (widget.onOpenWallet != null)
                      TextButton(
                        onPressed: widget.onOpenWallet,
                        child: const Text('Get credits'),
                      ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  key: const Key('gift-send-button'),
                  onPressed: _selected == null || _sending ? null : _send,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF35C6C3),
                    foregroundColor: const Color(0xFF061313),
                  ),
                  child: Text(
                    _sending
                        ? 'Sending...'
                        : _selected == null
                        ? 'Select a gift'
                        : 'Send ${_selected!.name}',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GiftGrid extends StatelessWidget {
  const _GiftGrid({
    required this.controller,
    required this.tier,
    required this.gifts,
    required this.selected,
    required this.onSelect,
  });
  final ScrollController controller;
  final GiftTier tier;
  final List<GiftCatalogItem> gifts;
  final GiftCatalogItem? selected;
  final ValueChanged<GiftCatalogItem> onSelect;

  @override
  Widget build(BuildContext context) {
    if (gifts.isEmpty) {
      return const Center(
        child: Text(
          'No gifts available',
          style: TextStyle(color: Colors.white54),
        ),
      );
    }
    final panel = switch (tier) {
      GiftTier.basic => const Color(0xFF101B2C),
      GiftTier.premium => const Color(0xFF24162F),
      GiftTier.exclusive => const Color(0xFF211B10),
    };
    return GridView.builder(
      controller: controller,
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: .82,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: gifts.length,
      itemBuilder: (context, index) {
        final gift = gifts[index];
        final active = selected?.id == gift.id;
        return Material(
          color: panel,
          borderRadius: BorderRadius.circular(7),
          child: InkWell(
            key: ValueKey('gift-card-${gift.key}'),
            onTap: () => onSelect(gift),
            borderRadius: BorderRadius.circular(7),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(7),
                border: Border.all(
                  color: active
                      ? const Color(0xFF35C6C3)
                      : const Color(0xFF353B46),
                  width: active ? 2 : 1,
                ),
              ),
              padding: const EdgeInsets.all(8),
              child: Column(
                children: [
                  Expanded(
                    child: GiftAssetView(
                      gift: gift,
                      state: active
                          ? GiftVisualState.preview
                          : GiftVisualState.idle,
                    ),
                  ),
                  Text(
                    gift.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  GiftCreditBadge(credits: gift.creditCost),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
