import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/wallet_models.dart';
import '../data/wallet_remote_data_source.dart';
import '../wallet_presenter.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

/// Bottom sheet to transfer credits to another user by @username (web Wallet
/// "Send" -> `transfer_credits` RPC).
///
/// Returns `true` via the completer when a transfer succeeds so the host can
/// refresh the balance/ledger.
class SendCreditsSheet extends StatefulWidget {
  const SendCreditsSheet({
    super.key,
    required this.presenter,
    required this.balance,
  });

  final WalletPresenter presenter;
  final CreditBalance balance;

  /// Convenience launcher. Resolves to `true` when a transfer succeeded.
  static Future<bool?> show(
    BuildContext context, {
    required WalletPresenter presenter,
    required CreditBalance balance,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: WalletColors.barrier,
      builder: (_) => SendCreditsSheet(presenter: presenter, balance: balance),
    );
  }

  @override
  State<SendCreditsSheet> createState() => _SendCreditsSheetState();
}

class _SendCreditsSheetState extends State<SendCreditsSheet> {
  final _recipientController = TextEditingController();
  final _amountController = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _recipientController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  int get _amount => int.tryParse(_amountController.text.trim()) ?? 0;

  bool get _valid =>
      _recipientController.text.trim().isNotEmpty &&
      _amount > 0 &&
      _amount <= widget.balance.balance;

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_valid || _sending) return;
    setState(() => _sending = true);
    try {
      await widget.presenter.transferCredits(
        recipientUsername: _recipientController.text.trim(),
        amount: _amount,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      _toast('Sent ${formatCredits(_amount)} credits.');
    } on WalletTransferException catch (e) {
      _toast(e.message, error: true);
    } on WalletBackendUnavailable catch (e) {
      _toast(e.message, error: true);
    } catch (_) {
      _toast('Something went wrong. Please try again.', error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _toast(String message, {bool error = false}) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error
            ? WalletColors.destructive
            : WalletColors.success,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.of(context).viewInsets;
    return Padding(
      padding: EdgeInsets.only(bottom: insets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: WalletColors.card,
          borderRadius: WalletRadii.sheetTop,
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SheetGrabber(),
            const SizedBox(height: WalletSpacing.md),
            Row(
              children: const [
                Icon(Icons.send_rounded, color: WalletColors.primary, size: 20),
                SizedBox(width: 8),
                Text('Send Credits', style: WalletTextStyles.sectionTitle),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Available: ${formatCredits(widget.balance.balance)} credits',
              style: WalletTextStyles.rowMuted,
            ),
            const SizedBox(height: WalletSpacing.lg),
            _Field(
              controller: _recipientController,
              label: 'Recipient username',
              hint: '@username',
              icon: Icons.alternate_email_rounded,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: WalletSpacing.md),
            _Field(
              controller: _amountController,
              label: 'Amount',
              hint: '0',
              icon: Icons.monetization_on_rounded,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              onChanged: (_) => setState(() {}),
            ),
            if (_amount > widget.balance.balance)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Amount exceeds your balance.',
                  style: TextStyle(
                    fontSize: 12,
                    color: WalletColors.destructive,
                  ),
                ),
              ),
            const SizedBox(height: WalletSpacing.lg),
            WalletPrimaryButton(
              label: 'Send',
              icon: Icons.send_rounded,
              busy: _sending,
              onPressed: _valid ? _submit : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// Labelled text field used by the wallet sheets.
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.inputFormatters,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: WalletTextStyles.rowMuted),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          onChanged: onChanged,
          style: WalletTextStyles.rowTitle.copyWith(fontSize: 15),
          cursorColor: WalletColors.primary,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: WalletTextStyles.rowMuted,
            prefixIcon: Icon(
              icon,
              size: 18,
              color: WalletColors.mutedForeground,
            ),
            filled: true,
            fillColor: WalletColors.background,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: WalletRadii.inner,
              borderSide: const BorderSide(color: WalletColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: WalletRadii.inner,
              borderSide: const BorderSide(color: WalletColors.primary),
            ),
          ),
        ),
      ],
    );
  }
}

class _SheetGrabber extends StatelessWidget {
  const _SheetGrabber();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        decoration: BoxDecoration(
          color: WalletColors.border,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
