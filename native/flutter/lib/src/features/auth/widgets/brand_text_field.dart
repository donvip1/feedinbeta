import 'package:flutter/material.dart';

import '../auth_theme.dart';

/// A borderless, underline-only text field that floats over the brand
/// gradient. No card, no filled box — just white ink and a subtle bottom
/// divider that brightens on focus. Wraps [TextFormField] so callers get
/// inline per-field validation for free.
class BrandTextField extends StatefulWidget {
  const BrandTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hintText,
    this.icon,
    this.keyboardType,
    this.textInputAction,
    this.obscurable = false,
    this.enabled = true,
    this.validator,
    this.onSubmitted,
    this.autofillHints,
  });

  final TextEditingController controller;

  /// Floating label shown above the field.
  final String label;
  final String? hintText;
  final IconData? icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  /// When true, the field starts obscured and shows a show/hide toggle.
  final bool obscurable;
  final bool enabled;
  final String? Function(String?)? validator;
  final VoidCallback? onSubmitted;
  final Iterable<String>? autofillHints;

  @override
  State<BrandTextField> createState() => _BrandTextFieldState();
}

class _BrandTextFieldState extends State<BrandTextField> {
  late bool _obscured = widget.obscurable;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      enabled: widget.enabled,
      obscureText: _obscured,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      autofillHints: widget.autofillHints,
      validator: widget.validator,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      onFieldSubmitted: (_) => widget.onSubmitted?.call(),
      style: AuthTextStyles.fieldOnBrand,
      cursorColor: AuthColors.onBrand,
      decoration: InputDecoration(
        isDense: true,
        labelText: widget.label,
        hintText: widget.hintText,
        floatingLabelStyle: const TextStyle(
          color: AuthColors.onBrand,
          fontWeight: FontWeight.w700,
        ),
        labelStyle: const TextStyle(color: AuthColors.onBrandFaint),
        hintStyle: const TextStyle(color: AuthColors.onBrandFaint),
        errorStyle: const TextStyle(
          color: AuthColors.onBrandError,
          fontWeight: FontWeight.w600,
        ),
        prefixIcon: widget.icon == null
            ? null
            : Icon(widget.icon, size: 20, color: AuthColors.onBrandMuted),
        suffixIcon: widget.obscurable
            ? IconButton(
                onPressed: () => setState(() => _obscured = !_obscured),
                icon: Icon(
                  _obscured ? Icons.visibility_off : Icons.visibility,
                  size: 20,
                  color: AuthColors.onBrandMuted,
                ),
                tooltip: _obscured ? 'Show password' : 'Hide password',
                splashRadius: 20,
              )
            : null,
        contentPadding: const EdgeInsets.symmetric(vertical: AuthSpacing.md),
        // Underline only — brightens on focus, reddens on error.
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AuthColors.glassLine),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AuthColors.onBrand, width: 1.6),
        ),
        disabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AuthColors.glassLineFaint),
        ),
        errorBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AuthColors.onBrandError),
        ),
        focusedErrorBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AuthColors.onBrandError, width: 1.6),
        ),
      ),
    );
  }
}
