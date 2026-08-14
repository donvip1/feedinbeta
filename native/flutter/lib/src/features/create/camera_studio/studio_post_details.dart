import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import '../parity/create_view_models.dart';
import '../parity/widgets/privacy_selector.dart';
import 'studio_filter_tray.dart';
import 'studio_filters.dart';

class StudioPostDetails extends StatefulWidget {
  const StudioPostDetails({
    super.key,
    required this.file,
    required this.isVideo,
    required this.filter,
    required this.caption,
    required this.privacy,
    required this.isSubmitting,
    required this.onBack,
    required this.onCaptionChanged,
    required this.onPrivacyChanged,
    required this.onFilterChanged,
    required this.onSubmit,
    this.errorMessage,
  });

  final XFile file;
  final bool isVideo;
  final StudioFilter filter;
  final String caption;
  final PostPrivacy privacy;
  final bool isSubmitting;
  final String? errorMessage;
  final VoidCallback onBack;
  final ValueChanged<String> onCaptionChanged;
  final ValueChanged<PostPrivacy> onPrivacyChanged;
  final ValueChanged<StudioFilter> onFilterChanged;
  final VoidCallback onSubmit;

  @override
  State<StudioPostDetails> createState() => _StudioPostDetailsState();
}

class _StudioPostDetailsState extends State<StudioPostDetails> {
  bool _filtersOpen = false;
  VideoPlayerController? _videoController;
  Object? _videoError;

  @override
  void initState() {
    super.initState();
    _initializeVideo();
  }

  @override
  void didUpdateWidget(covariant StudioPostDetails oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.file.path != widget.file.path ||
        oldWidget.isVideo != widget.isVideo) {
      _disposeVideo();
      _initializeVideo();
    }
  }

  void _initializeVideo() {
    if (!widget.isVideo) return;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || !widget.isVideo) return;
      final controller = VideoPlayerController.file(File(widget.file.path));
      _videoController = controller;
      try {
        await controller.initialize();
        await controller.setLooping(true);
        await controller.play();
      } catch (error) {
        _videoError = error;
      }
      if (mounted && identical(_videoController, controller)) setState(() {});
    });
  }

  void _disposeVideo() {
    final controller = _videoController;
    _videoController = null;
    _videoError = null;
    controller?.dispose();
  }

  @override
  void dispose() {
    _disposeVideo();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    return Material(
      key: const Key('studio-post-details'),
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          KeyedSubtree(
            key: const Key('studio-post-media-preview'),
            child: _preview(),
          ),
          const _DetailsScrim(),
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 12, 0),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: widget.isSubmitting ? null : widget.onBack,
                      tooltip: 'Back to media review',
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: Colors.white,
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'New post',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          shadows: FeedImmersiveTheme.textShadow,
                        ),
                      ),
                    ),
                    FilledButton(
                      key: const Key('studio-post-submit'),
                      onPressed: widget.isSubmitting ? null : widget.onSubmit,
                      child: Text(widget.isSubmitting ? 'Posting…' : 'Post'),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedPadding(
            duration: const Duration(milliseconds: 180),
            padding: EdgeInsets.only(bottom: keyboardInset),
            child: Align(
              alignment: Alignment.bottomCenter,
              child: SafeArea(
                top: false,
                child: Container(
                  constraints: const BoxConstraints(maxHeight: 360),
                  margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xE6121218),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextFormField(
                          key: const Key('studio-post-caption'),
                          initialValue: widget.caption,
                          onChanged: widget.onCaptionChanged,
                          minLines: 2,
                          maxLines: 5,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            hintText: 'Write a caption…',
                            hintStyle: TextStyle(color: Colors.white60),
                            border: InputBorder.none,
                          ),
                        ),
                        if (!widget.isVideo) ...[
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton.icon(
                              key: const Key('studio-post-filter'),
                              onPressed: () =>
                                  setState(() => _filtersOpen = !_filtersOpen),
                              icon: const Icon(Icons.filter_vintage_rounded),
                              label: Text('Filter · ${widget.filter.id}'),
                            ),
                          ),
                          StudioFilterTray(
                            visible: _filtersOpen,
                            selectedId: widget.filter.id,
                            onSelected: widget.onFilterChanged,
                            onClose: () => setState(() => _filtersOpen = false),
                          ),
                        ],
                        const Text(
                          'Who can see this?',
                          style: TextStyle(
                            color: Colors.white70,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        KeyedSubtree(
                          key: const Key('studio-post-privacy'),
                          child: PrivacySelector(
                            value: widget.privacy,
                            onChanged: widget.onPrivacyChanged,
                          ),
                        ),
                        if (widget.errorMessage case final message?) ...[
                          const SizedBox(height: 10),
                          Text(
                            message,
                            style: const TextStyle(
                              color: FeedImmersiveTheme.brandPink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _preview() {
    if (widget.isVideo) {
      final controller = _videoController;
      if (_videoError != null) {
        return const ColoredBox(
          key: Key('studio-post-video-failed'),
          color: Colors.black,
          child: Center(
            child: Text(
              'Video preview unavailable',
              style: TextStyle(color: Colors.white70),
            ),
          ),
        );
      }
      if (controller == null || !controller.value.isInitialized) {
        return const ColoredBox(
          key: Key('studio-post-video-loading'),
          color: Colors.black,
          child: Center(
            child: CircularProgressIndicator(
              color: FeedImmersiveTheme.brandPink,
            ),
          ),
        );
      }
      return ColoredBox(
        key: const Key('studio-post-video-ready'),
        color: Colors.black,
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: controller.value.size.width,
            height: controller.value.size.height,
            child: VideoPlayer(controller),
          ),
        ),
      );
    }
    Widget image = Image.file(
      File(widget.file.path),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => const ColoredBox(color: Colors.black),
    );
    if (widget.filter.filter != null) {
      image = ColorFiltered(colorFilter: widget.filter.filter!, child: image);
    }
    return ColoredBox(color: Colors.black, child: image);
  }
}

class _DetailsScrim extends StatelessWidget {
  const _DetailsScrim();

  @override
  Widget build(BuildContext context) => const IgnorePointer(
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x99000000), Colors.transparent, Color(0xB3000000)],
          stops: [0, 0.48, 1],
        ),
      ),
    ),
  );
}
