import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/wallet_models.dart';
import '../wallet_presenter.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

class PayoutDestinationSheet extends StatefulWidget {
  const PayoutDestinationSheet({super.key, required this.presenter});

  final WalletPresenter presenter;

  static Future<PayoutDestination?> show(
    BuildContext context, {
    required WalletPresenter presenter,
  }) {
    return showModalBottomSheet<PayoutDestination>(
      context: context,
      isScrollControlled: true,
      backgroundColor: WalletColors.card,
      useSafeArea: true,
      builder: (_) => PayoutDestinationSheet(presenter: presenter),
    );
  }

  @override
  State<PayoutDestinationSheet> createState() => _PayoutDestinationSheetState();
}

class _PayoutDestinationSheetState extends State<PayoutDestinationSheet> {
  final _accountController = TextEditingController();
  List<PaystackBank> _banks = const [];
  PaystackBank? _selectedBank;
  VerifiedPayoutAccount? _verifiedAccount;
  String? _error;
  bool _loadingBanks = true;
  bool _verifying = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadBanks();
  }

  @override
  void dispose() {
    _accountController.dispose();
    super.dispose();
  }

  Future<void> _loadBanks() async {
    try {
      final banks = await widget.presenter.fetchPayoutBanks();
      if (!mounted) return;
      setState(() {
        _banks = banks;
        _loadingBanks = false;
      });
    } on WalletBackendUnavailable catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingBanks = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load the bank directory.';
        _loadingBanks = false;
      });
    }
  }

  void _resetVerification() {
    if (_verifiedAccount == null && _error == null) return;
    setState(() {
      _verifiedAccount = null;
      _error = null;
    });
  }

  Future<void> _verify() async {
    final bank = _selectedBank;
    final accountNumber = _accountController.text.trim();
    if (bank == null || !RegExp(r'^\d{10}$').hasMatch(accountNumber)) {
      setState(() => _error = 'Select a bank and enter 10 account digits.');
      return;
    }

    setState(() {
      _verifying = true;
      _error = null;
      _verifiedAccount = null;
    });
    try {
      final account = await widget.presenter.verifyPayoutAccount(
        bankCode: bank.code,
        accountNumber: accountNumber,
      );
      if (!mounted) return;
      setState(() => _verifiedAccount = account);
    } on WalletBackendUnavailable catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not verify this bank account.');
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _save() async {
    final bank = _selectedBank;
    final account = _verifiedAccount;
    if (bank == null || account == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final destination = await widget.presenter.savePayoutDestination(
        bank: bank,
        accountNumber: account.accountNumber,
      );
      if (!mounted) return;
      Navigator.of(context).pop(destination);
    } on WalletBackendUnavailable catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not save this payout account.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Payout account',
                    style: TextStyle(
                      color: WalletColors.foreground,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: _saving ? null : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: WalletSpacing.md),
            if (_loadingBanks)
              const WalletLoading()
            else ...[
              DropdownButtonFormField<PaystackBank>(
                initialValue: _selectedBank,
                isExpanded: true,
                menuMaxHeight: 360,
                dropdownColor: WalletColors.card,
                style: const TextStyle(color: WalletColors.foreground),
                decoration: const InputDecoration(
                  labelText: 'Bank',
                  prefixIcon: Icon(Icons.account_balance_outlined),
                ),
                items: [
                  for (final bank in _banks)
                    DropdownMenuItem(value: bank, child: Text(bank.name)),
                ],
                onChanged: _saving
                    ? null
                    : (bank) {
                        setState(() {
                          _selectedBank = bank;
                          _verifiedAccount = null;
                          _error = null;
                        });
                      },
              ),
              const SizedBox(height: WalletSpacing.md),
              TextField(
                controller: _accountController,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(10),
                ],
                style: const TextStyle(color: WalletColors.foreground),
                decoration: const InputDecoration(
                  labelText: 'Account number',
                  prefixIcon: Icon(Icons.numbers_rounded),
                ),
                onChanged: (_) => _resetVerification(),
              ),
              if (_verifiedAccount != null) ...[
                const SizedBox(height: WalletSpacing.md),
                Row(
                  children: [
                    const Icon(
                      Icons.check_circle_rounded,
                      color: WalletColors.success,
                    ),
                    const SizedBox(width: WalletSpacing.sm),
                    Expanded(
                      child: Text(
                        _verifiedAccount!.accountName,
                        style: WalletTextStyles.rowTitle,
                      ),
                    ),
                  ],
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: WalletSpacing.md),
                Text(
                  _error!,
                  style: WalletTextStyles.rowMuted.copyWith(
                    color: WalletColors.destructive,
                  ),
                ),
              ],
              const SizedBox(height: WalletSpacing.lg),
              if (_verifiedAccount == null)
                WalletPrimaryButton(
                  label: _verifying ? 'Verifying account' : 'Verify account',
                  icon: Icons.verified_outlined,
                  busy: _verifying,
                  onPressed: _verifying ? null : _verify,
                )
              else
                WalletPrimaryButton(
                  label: _saving ? 'Saving account' : 'Save payout account',
                  icon: Icons.save_outlined,
                  busy: _saving,
                  onPressed: _saving ? null : _save,
                ),
            ],
          ],
        ),
      ),
    );
  }
}
