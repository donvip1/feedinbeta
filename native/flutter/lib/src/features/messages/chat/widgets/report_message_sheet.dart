import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';

class ReportMessageDraft {
  const ReportMessageDraft({required this.reason, this.description});

  final ReportReason reason;
  final String? description;

  String get reasonValue => reportReasonValue(reason);
}

Future<ReportMessageDraft?> showReportMessageSheet(BuildContext context) {
  return showModalBottomSheet<ReportMessageDraft>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ChatColors.card,
    barrierColor: ChatColors.barrier,
    shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
    builder: (_) => const ReportMessageSheet(),
  );
}

/// Collects a moderation reason and optional context for an incoming message.
///
/// This widget performs no network work. It returns a [ReportMessageDraft] to
/// the screen, which submits it through `MessageInteractionsDataSource`.
class ReportMessageSheet extends StatefulWidget {
  const ReportMessageSheet({super.key});

  @override
  State<ReportMessageSheet> createState() => _ReportMessageSheetState();
}

class _ReportMessageSheetState extends State<ReportMessageSheet> {
  final TextEditingController _descriptionController = TextEditingController();
  ReportReason? _selectedReason;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  void _submit() {
    final reason = _selectedReason;
    if (reason == null) return;
    final description = _descriptionController.text.trim();
    Navigator.of(context).pop(
      ReportMessageDraft(
        reason: reason,
        description: description.isEmpty ? null : description,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          ChatSpacing.lg,
          ChatSpacing.sm,
          ChatSpacing.lg,
          ChatSpacing.lg + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: ChatSpacing.md),
                  decoration: BoxDecoration(
                    color: ChatColors.border,
                    borderRadius: ChatRadii.chip,
                  ),
                ),
              ),
              const Text('Report message', style: ChatTextStyles.headerName),
              const SizedBox(height: ChatSpacing.sm),
              const Text(
                'Choose the issue that best describes this message.',
                style: ChatTextStyles.subtitle,
              ),
              const SizedBox(height: ChatSpacing.md),
              for (final reason in ReportReason.values)
                _ReasonRow(
                  reason: reason,
                  selected: _selectedReason == reason,
                  onTap: () => setState(() => _selectedReason = reason),
                ),
              const SizedBox(height: ChatSpacing.md),
              TextField(
                key: const ValueKey('report-description'),
                controller: _descriptionController,
                minLines: 2,
                maxLines: 4,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Additional details',
                  hintText: 'Optional context for the moderation team',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: ChatSpacing.sm),
              const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: ChatColors.mutedForeground,
                  ),
                  SizedBox(width: ChatSpacing.sm),
                  Expanded(
                    child: Text(
                      'Only report content that genuinely violates the community rules.',
                      style: ChatTextStyles.timestamp,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ChatSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    key: const ValueKey('report-cancel'),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: ChatSpacing.sm),
                  FilledButton.icon(
                    key: const ValueKey('report-submit'),
                    onPressed: _selectedReason == null ? null : _submit,
                    icon: const Icon(Icons.flag_outlined, size: 18),
                    label: const Text('Submit report'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReasonRow extends StatelessWidget {
  const _ReasonRow({
    required this.reason,
    required this.selected,
    required this.onTap,
  });

  final ReportReason reason;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      key: ValueKey('report-reason-${reportReasonValue(reason)}'),
      contentPadding: EdgeInsets.zero,
      minTileHeight: 44,
      leading: Icon(
        selected
            ? Icons.radio_button_checked_rounded
            : Icons.radio_button_off_rounded,
        color: selected ? ChatColors.primary : ChatColors.mutedForeground,
      ),
      title: Text(reportReasonLabel(reason)),
      onTap: onTap,
    );
  }
}
