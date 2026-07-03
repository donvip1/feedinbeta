import 'package:flutter/material.dart';

import '../contacts_theme.dart';

/// A small card letting the user register their OWN number so contacts who have
/// it can discover them. We can't reliably read the device's own number, so the
/// user types it; on submit the parent hashes + registers it via
/// `set_my_phone_hash`. Shows a confirmed state once registered.
class DiscoverabilityField extends StatelessWidget {
  const DiscoverabilityField({
    super.key,
    required this.controller,
    required this.onSubmit,
    required this.busy,
    required this.registered,
  });

  final TextEditingController controller;
  final VoidCallback onSubmit;
  final bool busy;

  /// True once the number has been registered this session.
  final bool registered;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(
        ContactsSpacing.lg,
        ContactsSpacing.md,
        ContactsSpacing.lg,
        ContactsSpacing.sm,
      ),
      padding: const EdgeInsets.all(ContactsSpacing.lg),
      decoration: BoxDecoration(
        color: ContactsColors.card,
        borderRadius: ContactsRadii.card,
        border: Border.all(color: ContactsColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                registered ? Icons.verified_user : Icons.travel_explore,
                size: 18,
                color: registered
                    ? ContactsColors.online
                    : ContactsColors.primary,
              ),
              const SizedBox(width: ContactsSpacing.sm),
              const Expanded(
                child: Text(
                  'Be discoverable',
                  style: ContactsTextStyles.rowTitle,
                ),
              ),
            ],
          ),
          const SizedBox(height: ContactsSpacing.xs),
          Text(
            registered
                ? 'Your number is registered. Friends who have it can find you.'
                : 'Add your number so friends who have it in their contacts can '
                      'find you on feedIn.',
            style: ContactsTextStyles.rowSubtitle,
          ),
          const SizedBox(height: ContactsSpacing.md),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.phone,
                  enabled: !busy,
                  style: const TextStyle(
                    color: ContactsColors.foreground,
                    fontSize: 15,
                  ),
                  onSubmitted: (_) => onSubmit(),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: '+1 555 123 4567',
                    hintStyle: const TextStyle(
                      color: ContactsColors.mutedForeground,
                    ),
                    filled: true,
                    fillColor: ContactsColors.cardElevated,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: ContactsSpacing.md,
                      vertical: ContactsSpacing.md,
                    ),
                    enabledBorder: const OutlineInputBorder(
                      borderRadius: ContactsRadii.tile,
                      borderSide: BorderSide(color: ContactsColors.border),
                    ),
                    disabledBorder: const OutlineInputBorder(
                      borderRadius: ContactsRadii.tile,
                      borderSide: BorderSide(color: ContactsColors.border),
                    ),
                    focusedBorder: const OutlineInputBorder(
                      borderRadius: ContactsRadii.tile,
                      borderSide: BorderSide(
                        color: ContactsColors.primary,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: ContactsSpacing.sm),
              _SubmitButton(busy: busy, onTap: onSubmit),
            ],
          ),
        ],
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: ContactsRadii.tile,
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: ContactsRadii.tile,
        child: Container(
          height: ContactsSpacing.tapTarget,
          width: ContactsSpacing.tapTarget,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            gradient: ContactsGradients.primary,
            borderRadius: ContactsRadii.tile,
          ),
          child: busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      ContactsColors.primaryForeground,
                    ),
                  ),
                )
              : const Icon(
                  Icons.arrow_forward_rounded,
                  size: 20,
                  color: ContactsColors.primaryForeground,
                ),
        ),
      ),
    );
  }
}
