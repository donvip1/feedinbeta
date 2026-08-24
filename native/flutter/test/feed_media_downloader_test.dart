import 'dart:io';

import 'package:feedin/src/features/feed/share/feed_media_downloader.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeGallery implements MediaSaverGateway {
  _FakeGallery({this.access = true});

  bool access;
  final List<String> savedImages = [];
  final List<String> savedVideos = [];
  int requestCalls = 0;

  @override
  Future<bool> hasAccess() async => access;

  @override
  Future<bool> requestAccess() async {
    requestCalls++;
    return access;
  }

  @override
  Future<void> saveImage(String path) async => savedImages.add(path);

  @override
  Future<void> saveVideo(String path) async => savedVideos.add(path);
}

void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('feedin_dl_test');
  });

  tearDown(() async {
    if (tempDir.existsSync()) await tempDir.delete(recursive: true);
  });

  FeedMediaDownloader make(_FakeGallery gallery) => FeedMediaDownloader(
    gateway: gallery,
    fetchBytes: (uri) async => <int>[1, 2, 3, 4],
    tempDirProvider: () async => tempDir,
  );

  test('image routes to saveImage', () async {
    final gallery = _FakeGallery();
    await make(gallery).saveToGallery(
      url: 'https://cdn.example.com/pic.jpg',
      isVideo: false,
    );
    expect(gallery.savedImages, hasLength(1));
    expect(gallery.savedVideos, isEmpty);
    expect(File(gallery.savedImages.single).existsSync(), isTrue);
  });

  test('video routes to saveVideo', () async {
    final gallery = _FakeGallery();
    await make(gallery).saveToGallery(
      url: 'https://cdn.example.com/clip.mp4',
      isVideo: true,
    );
    expect(gallery.savedVideos, hasLength(1));
    expect(gallery.savedImages, isEmpty);
  });

  test('requests access when not yet granted', () async {
    final gallery = _FakeGallery(access: false);
    await expectLater(
      make(gallery).saveToGallery(url: 'https://x/y.jpg', isVideo: false),
      throwsA(isA<MediaDownloadException>()),
    );
    expect(gallery.requestCalls, 1);
    expect(gallery.savedImages, isEmpty);
  });

  test('empty url is rejected before any gallery call', () async {
    final gallery = _FakeGallery();
    await expectLater(
      make(gallery).saveToGallery(url: '   ', isVideo: false),
      throwsA(isA<MediaDownloadException>()),
    );
    expect(gallery.savedImages, isEmpty);
  });
}
