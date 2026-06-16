class DemoPost {
  const DemoPost({
    required this.authorName,
    required this.body,
    required this.meta,
  });

  final String authorName;
  final String body;
  final String meta;
}

const demoPosts = [
  DemoPost(
    authorName: 'FEEDIN System',
    body:
        'Flutter shell is active. This is now the cross-platform rebuild path.',
    meta: 'Android + iOS + future desktop',
  ),
  DemoPost(
    authorName: 'Offline Engine',
    body:
        'The next layer will add local storage for feed, messages, drafts, media cache, and pending actions.',
    meta: 'Local-first architecture',
  ),
  DemoPost(
    authorName: 'Secure Backend',
    body:
        'Supabase auth and server-side functions will handle protected data and privileged operations.',
    meta: 'Server-secured',
  ),
];
