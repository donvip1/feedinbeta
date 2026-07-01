import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/p2p_models.dart';
import '../data/p2p_remote_data_source.dart';
import '../p2p_config.dart';
import '../p2p_theme.dart';
import '../widgets/p2p_common.dart';
import '../widgets/p2p_payment_method_card.dart';

/// Manage saved bank payout methods. Ports the web payment-methods route
/// (`PaymentMethodCard` list + `BankDetailsForm` add flow).
class P2PPaymentMethodsScreen extends StatefulWidget {
  const P2PPaymentMethodsScreen({
    super.key,
    required this.dataSource,
    this.defaultCountryCode = 'NG',
  });

  final P2PRemoteDataSource dataSource;
  final String defaultCountryCode;

  @override
  State<P2PPaymentMethodsScreen> createState() =>
      _P2PPaymentMethodsScreenState();
}

class _P2PPaymentMethodsScreenState extends State<P2PPaymentMethodsScreen> {
  late Future<List<P2PPaymentMethod>> _methodsFuture;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _methodsFuture = widget.dataSource.fetchPaymentMethods();
  }

  void _reload() {
    setState(() {
      _methodsFuture = widget.dataSource.fetchPaymentMethods();
    });
  }

  Future<void> _openAddSheet() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black87,
      builder: (_) => _AddBankSheet(
        dataSource: widget.dataSource,
        defaultCountryCode: widget.defaultCountryCode,
      ),
    );
    if (added == true) _reload();
  }

  Future<void> _setDefault(String id) async {
    setState(() => _busy = true);
    await widget.dataSource.setDefaultPaymentMethod(id);
    if (!mounted) return;
    setState(() => _busy = false);
    _reload();
  }

  Future<void> _delete(String id) async {
    setState(() => _busy = true);
    await widget.dataSource.deletePaymentMethod(id);
    if (!mounted) return;
    setState(() => _busy = false);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: P2PTheme.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(onBack: () => Navigator.of(context).maybePop()),
            Expanded(
              child: FutureBuilder<List<P2PPaymentMethod>>(
                future: _methodsFuture,
                builder: (context, snapshot) {
                  final methods = snapshot.data;
                  if (methods == null) {
                    return const Center(
                      child: CircularProgressIndicator(color: P2PTheme.primary),
                    );
                  }
                  if (methods.isEmpty) {
                    return P2PEmptyState(
                      icon: Icons.account_balance_outlined,
                      title: 'No payment methods',
                      subtitle:
                          'Add a bank account so buyers can pay you and you '
                          'can start selling credits.',
                      action: P2PPrimaryButton(
                        label: 'Add bank account',
                        icon: Icons.add,
                        expand: false,
                        onPressed: _openAddSheet,
                      ),
                    );
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.only(bottom: P2PTheme.xl),
                    itemCount: methods.length,
                    itemBuilder: (context, index) {
                      final method = methods[index];
                      return P2PPaymentMethodCard(
                        method: method,
                        isBusy: _busy,
                        onSetDefault: () => _setDefault(method.id),
                        onDelete: () => _delete(method.id),
                      );
                    },
                  );
                },
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(P2PTheme.lg),
                child: P2PPrimaryButton(
                  label: 'Add bank account',
                  icon: Icons.add,
                  onPressed: _openAddSheet,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        P2PTheme.xs,
        P2PTheme.sm,
        P2PTheme.lg,
        P2PTheme.sm,
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back, color: P2PTheme.foreground),
          ),
          const Text('Payment methods', style: P2PTheme.screenTitle),
        ],
      ),
    );
  }
}

/// Bottom sheet with a bank-details form. For Nigeria the bank is a dropdown of
/// known banks (mirroring the web `BankDetailsForm`); elsewhere it is free text.
class _AddBankSheet extends StatefulWidget {
  const _AddBankSheet({
    required this.dataSource,
    required this.defaultCountryCode,
  });

  final P2PRemoteDataSource dataSource;
  final String defaultCountryCode;

  @override
  State<_AddBankSheet> createState() => _AddBankSheetState();
}

class _AddBankSheetState extends State<_AddBankSheet> {
  final _bankNameController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _accountNameController = TextEditingController();
  late String _countryCode = widget.defaultCountryCode;
  String? _selectedNigerianBank;
  bool _makeDefault = true;
  bool _saving = false;

  bool get _isNigeria => _countryCode == 'NG';

  bool get _isValid {
    final bank = _isNigeria ? _selectedNigerianBank : _bankNameController.text;
    return (bank?.trim().isNotEmpty ?? false) &&
        _accountNumberController.text.trim().isNotEmpty &&
        _accountNameController.text.trim().isNotEmpty;
  }

  @override
  void dispose() {
    _bankNameController.dispose();
    _accountNumberController.dispose();
    _accountNameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_isValid) return;
    setState(() => _saving = true);
    final bankName = _isNigeria
        ? (_selectedNigerianBank ?? '')
        : _bankNameController.text.trim();
    await widget.dataSource.addPaymentMethod(
      accountName: _accountNameController.text.trim(),
      accountNumber: _accountNumberController.text.trim(),
      bankName: bankName,
      countryCode: _countryCode,
      makeDefault: _makeDefault,
    );
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
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
                const Text('Add bank account', style: P2PTheme.sectionTitle),
                const SizedBox(height: P2PTheme.lg),
                const Text('Country', style: P2PTheme.muted),
                const SizedBox(height: 6),
                _CountryDropdown(
                  value: _countryCode,
                  onChanged: (code) => setState(() {
                    _countryCode = code;
                    _selectedNigerianBank = null;
                  }),
                ),
                const SizedBox(height: P2PTheme.md),
                const Text('Bank', style: P2PTheme.muted),
                const SizedBox(height: 6),
                if (_isNigeria)
                  _BankDropdown(
                    value: _selectedNigerianBank,
                    onChanged: (v) => setState(() => _selectedNigerianBank = v),
                  )
                else
                  _SheetField(
                    controller: _bankNameController,
                    hint: 'Enter your bank name',
                    onChanged: (_) => setState(() {}),
                  ),
                const SizedBox(height: P2PTheme.md),
                Text(
                  _isNigeria ? 'Account number (NUBAN)' : 'Account number',
                  style: P2PTheme.muted,
                ),
                const SizedBox(height: 6),
                _SheetField(
                  controller: _accountNumberController,
                  hint: _isNigeria ? '10-digit account number' : 'Account number',
                  digitsOnly: true,
                  maxLength: _isNigeria ? 10 : 34,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: P2PTheme.md),
                const Text('Account holder name', style: P2PTheme.muted),
                const SizedBox(height: 6),
                _SheetField(
                  controller: _accountNameController,
                  hint: 'Full name as shown on account',
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: P2PTheme.md),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: _makeDefault,
                  activeTrackColor: P2PTheme.primary,
                  onChanged: (v) => setState(() => _makeDefault = v),
                  title: const Text(
                    'Set as default',
                    style: P2PTheme.body,
                  ),
                ),
                const SizedBox(height: P2PTheme.sm),
                P2PPrimaryButton(
                  label: 'Save payment method',
                  icon: Icons.check,
                  busy: _saving,
                  onPressed: _isValid && !_saving ? _save : null,
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

class _CountryDropdown extends StatelessWidget {
  const _CountryDropdown({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return _DropdownShell(
      child: DropdownButton<String>(
        value: value,
        isExpanded: true,
        dropdownColor: P2PTheme.surface,
        underline: const SizedBox.shrink(),
        iconEnabledColor: P2PTheme.mutedForeground,
        style: P2PTheme.body,
        items: [
          for (final c in P2PConfig.supportedCountries)
            DropdownMenuItem(
              value: c.code,
              child: Text('${c.name} (${c.currency})'),
            ),
        ],
        onChanged: (v) => v == null ? null : onChanged(v),
      ),
    );
  }
}

class _BankDropdown extends StatelessWidget {
  const _BankDropdown({required this.value, required this.onChanged});
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return _DropdownShell(
      child: DropdownButton<String>(
        value: value,
        isExpanded: true,
        hint: Text(
          'Select your bank',
          style: P2PTheme.muted.copyWith(color: P2PTheme.faintForeground),
        ),
        dropdownColor: P2PTheme.surface,
        underline: const SizedBox.shrink(),
        iconEnabledColor: P2PTheme.mutedForeground,
        style: P2PTheme.body,
        menuMaxHeight: 320,
        items: [
          for (final bank in P2PConfig.nigerianBanks)
            DropdownMenuItem(value: bank, child: Text(bank)),
        ],
        onChanged: onChanged,
      ),
    );
  }
}

class _DropdownShell extends StatelessWidget {
  const _DropdownShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: P2PTheme.md),
      decoration: BoxDecoration(
        color: P2PTheme.surface,
        borderRadius: P2PTheme.chipRadius,
        border: Border.all(color: P2PTheme.border),
      ),
      child: child,
    );
  }
}

class _SheetField extends StatelessWidget {
  const _SheetField({
    required this.controller,
    required this.hint,
    this.digitsOnly = false,
    this.maxLength,
    this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final bool digitsOnly;
  final int? maxLength;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      maxLength: maxLength,
      keyboardType: digitsOnly ? TextInputType.number : TextInputType.text,
      inputFormatters:
          digitsOnly ? [FilteringTextInputFormatter.digitsOnly] : null,
      style: P2PTheme.body,
      cursorColor: P2PTheme.primary,
      decoration: InputDecoration(
        counterText: '',
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
    );
  }
}
