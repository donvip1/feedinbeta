import 'dart:io';

import 'package:flutter/material.dart';

import 'feed_immersive_theme.dart';

class PostPhotoViewer extends StatefulWidget {
  const PostPhotoViewer({
    super.key,
    required this.urls,
    required this.localPaths,
    required this.initialIndex,
  });

  final List<String> urls;
  final List<String?> localPaths;
  final int initialIndex;

  static Route<void> route({
    required List<String> urls,
    required List<String?> localPaths,
    required int initialIndex,
  }) {
    return PageRouteBuilder<void>(
      opaque: true,
      barrierColor: Colors.black,
      pageBuilder: (context, animation, secondaryAnimation) => PostPhotoViewer(
        urls: urls,
        localPaths: localPaths,
        initialIndex: initialIndex,
      ),
      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
          FadeTransition(opacity: animation, child: child),
    );
  }

  @override
  State<PostPhotoViewer> createState() => _PostPhotoViewerState();
}

class _PostPhotoViewerState extends State<PostPhotoViewer> {
  late final PageController _controller = PageController(
    initialPage: widget.initialIndex.clamp(0, widget.urls.length - 1),
  );
  late int _index = widget.initialIndex.clamp(0, widget.urls.length - 1);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _localPath(int index) =>
      index < widget.localPaths.length ? widget.localPaths[index] : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: widget.urls.length,
              onPageChanged: (index) => setState(() => _index = index),
              itemBuilder: (context, index) => InteractiveViewer(
                key: ValueKey('post-photo-zoom-$index'),
                minScale: 1,
                maxScale: 5,
                panEnabled: true,
                child: Center(
                  child: _ViewerImage(
                    url: widget.urls[index],
                    localPath: _localPath(index),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: IconButton(
                key: const Key('post-photo-viewer-close'),
                tooltip: 'Close',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.close_rounded, color: Colors.white),
              ),
            ),
            Positioned(
              top: 18,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Center(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: FeedImmersiveTheme.glassSurfaceStrong,
                      borderRadius: BorderRadius.circular(
                        FeedImmersiveTheme.radiusPill,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      child: Text(
                        '${_index + 1} / ${widget.urls.length}',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ViewerImage extends StatelessWidget {
  const _ViewerImage({required this.url, required this.localPath});

  final String url;
  final String? localPath;

  @override
  Widget build(BuildContext context) {
    final path = localPath;
    if (path != null && File(path).existsSync()) {
      return Image.file(
        File(path),
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => _networkImage(),
      );
    }
    return _networkImage();
  }

  Widget _networkImage() => Image.network(
    url,
    fit: BoxFit.contain,
    loadingBuilder: (context, child, progress) => progress == null
        ? child
        : const Center(child: CircularProgressIndicator(color: Colors.white)),
    errorBuilder: (_, _, _) => const Icon(
      Icons.broken_image_outlined,
      size: 54,
      color: Colors.white54,
    ),
  );
}
