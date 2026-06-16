import 'package:flutter/material.dart';

import '../../shared/storage_budget.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.onSignOut});

  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: storageBudgets.length + 2,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == 0) {
          return Text(
            'Device storage',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          );
        }

        if (index == storageBudgets.length + 1) {
          return Align(
            alignment: Alignment.centerLeft,
            child: ActionChip(
              avatar: const Icon(Icons.logout),
              label: const Text('Sign out'),
              onPressed: onSignOut,
            ),
          );
        }

        final budget = storageBudgets[index - 1];
        return Card(
          child: ListTile(
            title: Text(budget.name),
            subtitle: Text('${budget.megabytes} MB budget'),
            trailing: Text(budget.autoCleanup ? 'Auto cleanup' : 'Retained'),
          ),
        );
      },
    );
  }
}
