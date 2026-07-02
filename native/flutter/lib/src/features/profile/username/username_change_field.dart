import 'package:flutter/material.dart';

import 'username_policy_data_source.dart';

/// Policy-aware username control for the profile editor.
///
/// Reflects the server rules (migration 20260702200000): first-time set is
/// free; standard users are then locked; premium users may change every 90
/// days. It reads [UsernamePolicyDataSource.fetchStatus] to decide whether the
/// field is editable and shows lock / cooldown copy accordingly, and performs
/// the change through [UsernamePolicyDataSource.changeUsername] (the RPC is the
/// real enforcement — this UI only mirrors it).
///
/// On unconfigured/offline builds (status null) the control falls back to a
/// plain editable handle field bound to [initialUsername], so the editor still
/// works and the local profile save path is unaffected.
class UsernameChangeField extends StatefulWidget {
  const UsernameChangeField({
    super.key,
    required this.initialUsername,
    this.dataSource,
    this.onChanged,
  });

  final String initialUsername;
  final UsernamePolicyDataSource? dataSource;

  /// Fired with the new username after a successful server change, so the host
  /// editor can update its in-memory profile/handle.
  final ValueChanged<String>? onChanged;

  @override
  State<UsernameChangeField> createState() => _UsernameChangeFieldState();
}

class _UsernameChangeFieldState extends State<UsernameChangeField> {
  late final UsernamePolicyDataSource _data =
      widget.dataSource ?? UsernamePolicyDataSource.autoDetect();
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialUsername);

  UsernameChangeStatus? _status;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    final status = await _data.fetchStatus();
    if (!mounted) return;
    setState(() {
      _status = status;
      _loading = false;
    });
  }

  bool get _editable {
    final status = _status;
    // No backend status (offline/demo) -> allow local editing.
    if (status == null) return true;
    return status.canChange;
  }

  Future<void> _submit() async {
    final value = _controller.text.trim().toLowerCase();
    if (value == widget.initialUsername.trim().toLowerCase()) {
      setState(() => _info = 'That is already your username.');
      return;
    }
    // Client mirror of the server format rule for instant feedback.
    final valid = RegExp(r'^[a-z0-9_]{3,30}$').hasMatch(value);
    if (!valid) {
      setState(() {
        _error = 'Use 3–30 characters: letters, numbers, or underscores.';
        _info = null;
      });
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _info = null;
    });
    final result = await _data.changeUsername(value);
    if (!mounted) return;
    setState(() => _saving = false);
    if (result.ok) {
      widget.onChanged?.call(result.username!);
      setState(() {
        _info = 'Username updated.';
        _error = null;
      });
      _loadStatus();
    } else {
      setState(() => _error = result.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = _status;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _controller,
          enabled: _editable && !_saving,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _editable ? _submit() : null,
          decoration: InputDecoration(
            labelText: 'Username',
            prefixText: '@',
            border: const OutlineInputBorder(),
            suffixIcon: _editable
                ? (_saving
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          tooltip: 'Save username',
                          icon: const Icon(Icons.check),
                          onPressed: _submit,
                        ))
                : const Icon(Icons.lock_outline, size: 20),
          ),
        ),
        const SizedBox(height: 6),
        if (_loading)
          Text(
            'Checking username options…',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          )
        else
          _helperLine(theme, status),
        if (_error != null) ...[
          const SizedBox(height: 4),
          Text(
            _error!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.error,
            ),
          ),
        ],
        if (_info != null) ...[
          const SizedBox(height: 4),
          Text(
            _info!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.primary,
            ),
          ),
        ],
      ],
    );
  }

  Widget _helperLine(ThemeData theme, UsernameChangeStatus? status) {
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    if (status == null) {
      return Text('Choose a unique @username.', style: muted);
    }
    if (status.isFirstTime) {
      return Text(
        'Pick your @username. Standard accounts can set this only once.',
        style: muted,
      );
    }
    if (status.isLockedStandard) {
      return Text(
        'Your username is locked. Upgrade to premium to change it.',
        style: muted,
      );
    }
    if (status.isCooldown) {
      final days = status.daysRemaining;
      return Text(
        'You can change your username again in $days '
        '${days == 1 ? 'day' : 'days'}.',
        style: muted,
      );
    }
    // premium_eligible
    return Text(
      'Premium: you can change your username once every 90 days.',
      style: muted,
    );
  }
}
