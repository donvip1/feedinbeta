import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/p2p_models.dart';
import '../data/p2p_remote_data_source.dart';
import '../p2p_config.dart';
import '../p2p_theme.dart';
import '../widgets/p2p_common.dart';

/// Bottom sheet for creating a sell listing. Ported from the web
/// `CreateListingModal`: balance header, quick-percentage selectors, credits +
/// price inputs, a live rate preview, and the escrow info note.
///
/// The listing is priced in the seller's local currency (derived from their
/// country), stored as `price_cents` on the live `p2p_listings` table.
class P2PCreateListingSheet extends StatefulWidget {
  const P2PCreateListingSheet({
    super.key,
    required this.dataSource,
    required this.creditBalance,
    required this.eligibility,
  });

  final P2PRemoteDataSource dataSource;
  final int creditBalance;
  final P2PEligibility eligibility;

  @override
  State<P2PCreateListingSheet> createState() => _P2PCreateListingSheetState();
}

class _P2PCreateListingSheetState extends State<P2PCreateListingSheet> {
  final _creditsController = TextEditingController();
  final _priceController = TextEditingController();
  bool _submitting = false;
  String? _error;

  P2PCountry get _country =>
      P2PConfig.countryByCode(widget.eligibility.userCountry) ??
      P2PConfig.supportedCountries.first;

  int get _credits => int.tryParse(_creditsController.text.trim()) ?? 0;
  double get _price => double.tryParse(_priceController.text.trim()) ?? 0;

  int get _rate => _price > 0 ? (_credits / _price).round() : 0;

  @override
  void dispose() {
    _creditsController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _applyPercentage(double pct) {
    final amount = (widget.creditBalance * pct).floor();
    _creditsController.text = amount.toString();
    // Suggest a price at the P2P sell rate (85 credits = $1) in local currency.
    final usd = P2PConfig.creditsToUsdForSelling(amount);
    _priceController.text = usd.toStringAsFixed(2);
    setState(() {});
  }

  Future<void> _submit() async {
    final minTrade = widget.eligibility.minTradeAmount;
    if (_credits < minTrade) {
      setState(() => _error = 'Minimum trade amount is $minTrade credits');
      return;
    }
    if (_credits > widget.creditBalance) {
      setState(() => _error = 'Exceeds your available balance');
      return;
    }
    if (_price <= 0) {
      setState(() => _error = 'Enter a valid price');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final listing = await widget.dataSource.createListing(
        creditsAmount: _credits,
        priceCents: (_price * 100).round(),
        currency: _country.currency,
      );
      if (!mounted) return;
      Navigator.of(context).pop(listing);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Could not create the listing. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit =
        !_submitting &&
        _credits >= widget.eligibility.minTradeAmount &&
        _credits <= widget.creditBalance &&
        _price > 0;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: P2PTheme.card,
          borderRadius: P2PTheme.sheetTop,
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(P2PTheme.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: P2PTheme.lg),
                    decoration: BoxDecoration(
                      color: P2PTheme.borderStrong,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    const Icon(
                      Icons.sell_outlined,
                      color: P2PTheme.primary,
                      size: 22,
                    ),
                    const SizedBox(width: P2PTheme.sm),
                    const Text('Create listing', style: P2PTheme.sectionTitle),
                    const Spacer(),
                    P2PChip(label: '${_country.name} · ${_country.currency}'),
                  ],
                ),
                const SizedBox(height: P2PTheme.lg),
                _BalanceCard(balance: widget.creditBalance),
                const SizedBox(height: P2PTheme.lg),
                const Text('Quick select', style: P2PTheme.muted),
                const SizedBox(height: P2PTheme.sm),
                Row(
                  children: [
                    for (final pct in const [0.25, 0.5, 0.75, 1.0])
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(right: P2PTheme.sm),
                          child: _PercentButton(
                            label: '${(pct * 100).round()}%',
                            onTap: () => _applyPercentage(pct),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: P2PTheme.lg),
                _LabeledField(
                  label: 'Credits to sell',
                  controller: _creditsController,
                  hint: 'Min ${widget.eligibility.minTradeAmount}',
                  onChanged: (_) => setState(() => _error = null),
                ),
                const SizedBox(height: P2PTheme.md),
                _LabeledField(
                  label: 'Price (${_country.currency})',
                  controller: _priceController,
                  hint: 'Enter price',
                  allowDecimal: true,
                  onChanged: (_) => setState(() => _error = null),
                ),
                if (_rate > 0) ...[
                  const SizedBox(height: P2PTheme.md),
                  Container(
                    padding: const EdgeInsets.all(P2PTheme.md),
                    decoration: BoxDecoration(
                      color: P2PTheme.primary.withValues(alpha: 0.1),
                      borderRadius: P2PTheme.chipRadius,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Rate: ${p2pFormatInt(_rate)} credits per '
                          '${_country.symbol}1',
                          style: P2PTheme.body.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'P2P sell rate is ${P2PConfig.sellRate} credits per '
                          '\$1 (vs ${P2PConfig.buyRate} in store)',
                          style: P2PTheme.meta,
                        ),
                      ],
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: P2PTheme.md),
                  Text(
                    _error!,
                    style: P2PTheme.muted.copyWith(color: P2PTheme.danger),
                  ),
                ],
                const SizedBox(height: P2PTheme.md),
                Container(
                  padding: const EdgeInsets.all(P2PTheme.md),
                  decoration: BoxDecoration(
                    color: P2PTheme.info.withValues(alpha: 0.1),
                    borderRadius: P2PTheme.chipRadius,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Icon(Icons.info_outline, size: 16, color: P2PTheme.info),
                      SizedBox(width: P2PTheme.sm),
                      Expanded(
                        child: Text(
                          'Your credits are locked in escrow when a buyer '
                          'starts a transaction, and released after you confirm '
                          'payment.',
                          style: P2PTheme.meta,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: P2PTheme.lg),
                P2PPrimaryButton(
                  label: 'Create listing',
                  icon: Icons.check,
                  busy: _submitting,
                  onPressed: canSubmit ? _submit : null,
                ),
                const SizedBox(height: P2PTheme.sm),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance});
  final int balance;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(P2PTheme.md),
      decoration: BoxDecoration(
        color: P2PTheme.surface,
        borderRadius: P2PTheme.chipRadius,
        border: Border.all(color: P2PTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Available balance', style: P2PTheme.meta),
          const SizedBox(height: 2),
          Text('${p2pFormatInt(balance)} credits', style: P2PTheme.amount),
        ],
      ),
    );
  }
}

class _PercentButton extends StatelessWidget {
  const _PercentButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: P2PTheme.chipRadius,
        onTap: onTap,
        child: Container(
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: P2PTheme.surface,
            borderRadius: P2PTheme.chipRadius,
            border: Border.all(color: P2PTheme.border),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: P2PTheme.foreground,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.controller,
    required this.hint,
    this.allowDecimal = false,
    this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final bool allowDecimal;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: P2PTheme.muted),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          onChanged: onChanged,
          keyboardType: TextInputType.numberWithOptions(decimal: allowDecimal),
          inputFormatters: [
            allowDecimal
                ? FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                : FilteringTextInputFormatter.digitsOnly,
          ],
          style: P2PTheme.body,
          cursorColor: P2PTheme.primary,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: P2PTheme.muted.copyWith(color: P2PTheme.faintForeground),
            filled: true,
            fillColor: P2PTheme.surface,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: P2PTheme.md,
              vertical: P2PTheme.md,
            ),
            border: OutlineInputBorder(
              borderRadius: P2PTheme.chipRadius,
              borderSide: const BorderSide(color: P2PTheme.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: P2PTheme.chipRadius,
              borderSide: const BorderSide(color: P2PTheme.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: P2PTheme.chipRadius,
              borderSide: const BorderSide(color: P2PTheme.primary),
            ),
          ),
        ),
      ],
    );
  }
}
