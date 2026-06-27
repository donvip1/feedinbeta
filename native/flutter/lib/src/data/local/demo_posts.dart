class DemoPost {
  const DemoPost({
    required this.authorName,
    required this.body,
    required this.meta,
    this.mediaUrl,
    this.mediaType,
    this.mediaUrls = const [],
    this.mediaTypes = const [],
    this.location,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.viewsCount = 0,
    this.refeedsCount = 0,
  });

  final String authorName;
  final String body;
  final String meta;
  final String? mediaUrl;
  final String? mediaType;
  final List<String> mediaUrls;
  final List<String> mediaTypes;
  final String? location;
  final int likesCount;
  final int commentsCount;
  final int viewsCount;
  final int refeedsCount;
}

const demoPosts = [
  DemoPost(
    authorName: 'feedIn Creators',
    body:
        'Welcome to the new immersive feed ✨ Swipe up for more. '
        'Double-tap to like. #feedIn #flutter',
    meta: 'Featured',
    mediaUrl:
        'https://flutter.github.io/assets-for-api-docs/assets/videos/bee.mp4',
    mediaType: 'video',
    location: 'feedIn HQ',
    likesCount: 1280,
    commentsCount: 64,
    viewsCount: 15400,
    refeedsCount: 12,
  ),
  DemoPost(
    authorName: 'Nature Daily',
    body:
        'Butterfly season is here 🦋 Full-screen autoplay, tap to pause, '
        'progress bar at the bottom. #nature #video',
    meta: 'Trending',
    mediaUrl:
        'https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4',
    mediaType: 'video',
    likesCount: 980,
    commentsCount: 41,
    viewsCount: 8800,
    refeedsCount: 7,
  ),
  DemoPost(
    authorName: 'Travel Frames',
    body:
        'Swipe through the gallery → photo carousel with page dots. '
        '#photography #travel @feedIn',
    meta: 'Gallery',
    mediaUrls: [
      'https://picsum.photos/seed/feedin-a/1080/1920',
      'https://picsum.photos/seed/feedin-b/1080/1920',
      'https://picsum.photos/seed/feedin-c/1080/1920',
    ],
    mediaTypes: ['image', 'image', 'image'],
    location: 'Lagos, Nigeria',
    likesCount: 540,
    commentsCount: 22,
    viewsCount: 4200,
    refeedsCount: 3,
  ),
  DemoPost(
    authorName: 'Studio Light',
    body: 'Single full-bleed photo post. Tap the avatar, save, or share. #design',
    meta: 'Photo',
    mediaUrl: 'https://picsum.photos/seed/feedin-single/1080/1920',
    mediaType: 'image',
    likesCount: 312,
    commentsCount: 9,
    viewsCount: 2100,
    refeedsCount: 1,
  ),
  DemoPost(
    authorName: 'feedIn System',
    body:
        'Flutter shell is active. This is the cross-platform rebuild path, '
        'now with an immersive media-first feed.',
    meta: 'Local-first',
    likesCount: 88,
    commentsCount: 4,
    viewsCount: 600,
  ),
];
