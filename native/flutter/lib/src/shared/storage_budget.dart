class StorageBudget {
  const StorageBudget({
    required this.name,
    required this.megabytes,
    required this.autoCleanup,
  });

  final String name;
  final int megabytes;
  final bool autoCleanup;
}

const storageBudgets = [
  StorageBudget(name: 'Feed cache', megabytes: 250, autoCleanup: true),
  StorageBudget(name: 'Profile cache', megabytes: 100, autoCleanup: true),
  StorageBudget(name: 'Message cache', megabytes: 500, autoCleanup: false),
  StorageBudget(name: 'Media cache', megabytes: 2048, autoCleanup: true),
  StorageBudget(name: 'Drafts', megabytes: 500, autoCleanup: false),
  StorageBudget(name: 'Upload queue', megabytes: 1024, autoCleanup: false),
  StorageBudget(name: 'Pending actions', megabytes: 25, autoCleanup: false),
];
