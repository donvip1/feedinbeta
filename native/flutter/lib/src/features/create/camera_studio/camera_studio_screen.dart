import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/connectivity/connectivity_service.dart';
import '../../../core/connectivity/offline_notice.dart';
import '../../../core/sync/upload_queue_service.dart';
import '../../../data/local/post_draft_repository.dart';
import '../../../data/local/upload_queue_repository.dart';
import '../../feed/immersive/feed_immersive_theme.dart';
import '../create_outcome.dart';
import '../parity/create_view_models.dart';
import 'camera_studio_flow.dart';
import 'camera_studio_review.dart';
import 'studio_capture_controls.dart';
import 'studio_filters.dart';
import 'studio_post_details.dart';
import 'studio_post_submission.dart';
import 'studio_tool_rail.dart';
import 'studio_top_bar.dart';

/// Full-screen live camera studio. Owns the camera lifecycle and capture state
/// machine and keeps capture, review, post details, and publication on this
/// single full-screen route.
class CameraStudioScreen extends StatefulWidget {
  const CameraStudioScreen({
    super.key,
    required this.draftRepository,
    required this.uploadQueueRepository,
    required this.uploadQueueService,
    required this.connectivityService,
    required this.onPostUploaded,
    this.initialMode = StudioCaptureMode.photo,
    this.initialSource,
  });

  final PostDraftRepository draftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final UploadQueueService uploadQueueService;
  final ConnectivityService connectivityService;
  final ValueChanged<String?> onPostUploaded;
  final StudioCaptureMode initialMode;
  final CaptureMethod? initialSource;

  @override
  State<CameraStudioScreen> createState() => _CameraStudioScreenState();
}

class _CameraStudioScreenState extends State<CameraStudioScreen>
    with WidgetsBindingObserver {
  final _picker = ImagePicker();

  List<CameraDescription> _cameras = const [];
  CameraController? _controller;
  String? _error;

  bool _isFront = false;
  bool _flashOn = false;
  late StudioCaptureMode _mode;
  bool _beauty = false;
  int _timer = 0; // 0 / 3 / 10 seconds
  bool _isRecording = false;
  StudioFlowState _flow = const StudioFlowState.capture();
  XFile? _selectedFile;
  String _caption = '';
  PostPrivacy _privacy = PostPrivacy.everyone;
  bool _isSubmitting = false;
  String? _publishError;
  late final StudioPostSubmission _submission = StudioPostSubmission(
    draftRepository: widget.draftRepository,
    uploadQueueRepository: widget.uploadQueueRepository,
    uploadQueueService: widget.uploadQueueService,
  );

  int _countdown = 0;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
    WidgetsBinding.instance.addObserver(this);
    final source = widget.initialSource;
    if (source == CaptureMethod.photoLibrary ||
        source == CaptureMethod.videoLibrary) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openGallery());
    } else {
      _setupCameras();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      controller.dispose();
      _controller = null;
    } else if (state == AppLifecycleState.resumed) {
      _setupCameras();
    }
  }

  Future<void> _setupCameras() async {
    try {
      final cameras = _cameras.isEmpty ? await availableCameras() : _cameras;
      if (cameras.isEmpty) {
        setState(() => _error = 'No camera available on this device.');
        return;
      }
      _cameras = cameras;
      await _startController();
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Camera unavailable. Check permissions and try again.',
        );
      }
    }
  }

  CameraDescription _pickCamera() {
    final wanted = _isFront
        ? CameraLensDirection.front
        : CameraLensDirection.back;
    return _cameras.firstWhere(
      (c) => c.lensDirection == wanted,
      orElse: () => _cameras.first,
    );
  }

  Future<void> _startController() async {
    final controller = CameraController(
      _pickCamera(),
      ResolutionPreset.high,
      enableAudio: true,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    _controller = controller;
    try {
      await controller.initialize();
      await controller.setFlashMode(_flashOn ? FlashMode.torch : FlashMode.off);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not start the camera.');
      return;
    }
    if (mounted) setState(() {});
  }

  Future<void> _toggleFlash() async {
    final controller = _controller;
    if (controller == null) return;
    final next = !_flashOn;
    try {
      await controller.setFlashMode(next ? FlashMode.torch : FlashMode.off);
      if (mounted) setState(() => _flashOn = next);
    } catch (_) {
      /* front cameras often lack a torch; ignore */
    }
  }

  Future<void> _flip() async {
    if (_cameras.length < 2) return;
    setState(() => _isFront = !_isFront);
    await _controller?.dispose();
    _controller = null;
    await _startController();
  }

  void _cycleTimer() {
    setState(
      () => _timer = switch (_timer) {
        0 => 3,
        3 => 10,
        _ => 0,
      },
    );
  }

  void _onShutter() {
    if (_isRecording) {
      _stopVideo();
      return;
    }
    if (_timer > 0) {
      _runCountdown(_beginCapture);
    } else {
      _beginCapture();
    }
  }

  void _runCountdown(VoidCallback then) {
    setState(() => _countdown = _timer);
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      if (_countdown <= 1) {
        t.cancel();
        setState(() => _countdown = 0);
        then();
      } else {
        setState(() => _countdown -= 1);
      }
    });
  }

  Future<void> _beginCapture() async {
    if (_mode.isVideo) {
      await _startVideo();
    } else {
      await _takePhoto();
    }
  }

  Future<void> _takePhoto() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      final file = await controller.takePicture();
      if (mounted) _openReview(file, isVideo: false);
    } catch (_) {
      _showError('Could not capture photo.');
    }
  }

  Future<void> _startVideo() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      await controller.startVideoRecording();
      setState(() => _isRecording = true);
      final max = _mode.maxDuration;
      if (max != null) {
        Future.delayed(max, () {
          if (mounted && _isRecording) _stopVideo();
        });
      }
    } catch (_) {
      _showError('Could not start recording.');
    }
  }

  Future<void> _stopVideo() async {
    final controller = _controller;
    if (controller == null) return;
    try {
      final file = await controller.stopVideoRecording();
      if (mounted) {
        setState(() => _isRecording = false);
        _openReview(file, isVideo: true);
      }
    } catch (_) {
      setState(() => _isRecording = false);
      _showError('Could not save recording.');
    }
  }

  Future<void> _openGallery() async {
    try {
      final file = _mode.isVideo
          ? await _picker.pickVideo(source: ImageSource.gallery)
          : await _picker.pickImage(source: ImageSource.gallery);
      if (!mounted) return;
      if (file != null) {
        _openReview(file, isVideo: _mode.isVideo);
        return;
      }
      // The source-first gallery route intentionally skips camera startup.
      // Cancelling that initial picker should close Create rather than leave a
      // permanent loading surface with no camera controller.
      if (widget.initialSource == CaptureMethod.photoLibrary ||
          widget.initialSource == CaptureMethod.videoLibrary) {
        Navigator.of(context).maybePop();
      }
    } catch (_) {
      _showError('Could not open the gallery.');
    }
  }

  void _openReview(XFile file, {required bool isVideo}) {
    setState(() {
      _selectedFile = file;
      _flow = StudioFlowState.review(mediaPath: file.path, isVideo: isVideo);
      _publishError = null;
    });
  }

  void _showPostDetails(StudioFilter filter) {
    setState(() {
      _flow = _flow.withFilter(filter.id).showDetails();
      _publishError = null;
    });
  }

  void _returnToReview() {
    if (_isSubmitting) return;
    setState(() {
      _flow = _flow.showReview();
      _publishError = null;
    });
  }

  void _retake() {
    setState(() {
      _flow = const StudioFlowState.capture();
      _selectedFile = null;
      _publishError = null;
    });
    if (widget.initialSource == CaptureMethod.photoLibrary ||
        widget.initialSource == CaptureMethod.videoLibrary) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openGallery());
    } else if (_controller == null) {
      unawaited(_setupCameras());
    }
  }

  StudioFilter get _selectedFilter => kStudioFilters.firstWhere(
    (filter) => filter.id == _flow.filterId,
    orElse: () => kStudioFilters.first,
  );

  Future<void> _publishPost() async {
    final file = _selectedFile;
    if (file == null || _isSubmitting) return;
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(
        context,
        message: "You're offline. Reconnect before publishing this post.",
      );
      return;
    }
    setState(() {
      _isSubmitting = true;
      _publishError = null;
    });
    try {
      final result = await _submission.submit(
        StudioPostSubmissionInput(
          caption: _caption,
          mediaPath: file.path,
          isVideo: _flow.isVideo,
          privacy: _privacy.wireValue,
          filterId: _flow.filterId,
        ),
      );
      if (!mounted) return;
      if (result.publishedPostId case final postId?) {
        Navigator.of(context).pop(CreatePublished(postId));
        return;
      }
      setState(() {
        _isSubmitting = false;
        _publishError = result.summary.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _publishError = 'Could not publish this post. Please try again.';
      });
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final file = _selectedFile;
    if (_flow.stage == StudioFlowStage.review && file != null) {
      return CameraStudioReview(
        key: const Key('studio-review-stage'),
        file: file,
        isVideo: _flow.isVideo,
        initialFilter: _selectedFilter,
        onRetake: _retake,
        onNext: _showPostDetails,
      );
    }
    if (_flow.stage == StudioFlowStage.details && file != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: StudioPostDetails(
          file: file,
          isVideo: _flow.isVideo,
          filter: _selectedFilter,
          caption: _caption,
          privacy: _privacy,
          isSubmitting: _isSubmitting,
          errorMessage: _publishError,
          onBack: _returnToReview,
          onCaptionChanged: (value) => _caption = value,
          onPrivacyChanged: (value) => setState(() => _privacy = value),
          onFilterChanged: (filter) =>
              setState(() => _flow = _flow.withFilter(filter.id)),
          onSubmit: _publishPost,
        ),
      );
    }
    return Scaffold(
      backgroundColor: Colors.black,
      body: _error != null
          ? _StudioError(
              message: _error!,
              onClose: () => Navigator.of(context).maybePop(),
            )
          : Stack(
              fit: StackFit.expand,
              children: [
                if (_controller != null && _controller!.value.isInitialized)
                  _LivePreview(
                    controller: _controller!,
                    filter: null,
                    beauty: _beauty,
                  )
                else
                  const Center(
                    child: CircularProgressIndicator(
                      color: FeedImmersiveTheme.brandPink,
                    ),
                  ),

                // Tool rail (right).
                Positioned(
                  right: 12,
                  top: MediaQuery.of(context).padding.top + 84,
                  child: StudioToolRail(
                    beautyOn: _beauty,
                    timerSeconds: _timer,
                    onToggleBeauty: () => setState(() => _beauty = !_beauty),
                    onCycleTimer: _cycleTimer,
                  ),
                ),

                // Top bar.
                Align(
                  alignment: Alignment.topCenter,
                  child: StudioTopBar(
                    onClose: () => Navigator.of(context).maybePop(),
                    onToggleFlash: _toggleFlash,
                    onFlip: _flip,
                    flashOn: _flashOn,
                    canFlash: !_isFront,
                  ),
                ),

                // Bottom capture controls.
                Align(
                  alignment: Alignment.bottomCenter,
                  child: StudioCaptureControls(
                    mode: _mode,
                    isRecording: _isRecording,
                    onModeChanged: (m) => setState(() => _mode = m),
                    onShutter: _onShutter,
                    onGallery: _openGallery,
                  ),
                ),

                // Countdown overlay.
                if (_countdown > 0)
                  IgnorePointer(
                    child: Center(
                      child: Text(
                        '$_countdown',
                        style: const TextStyle(
                          color: FeedImmersiveTheme.onMedia,
                          fontSize: 96,
                          fontWeight: FontWeight.w900,
                          shadows: FeedImmersiveTheme.textShadow,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

/// Full-bleed camera preview with the active filter (and optional beauty layer)
/// applied, scaled to cover the screen.
class _LivePreview extends StatelessWidget {
  const _LivePreview({
    required this.controller,
    required this.filter,
    required this.beauty,
  });

  final CameraController controller;
  final ColorFilter? filter;
  final bool beauty;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final scale = 1 / (controller.value.aspectRatio * size.aspectRatio);
    Widget preview = Transform.scale(
      scale: scale < 1 ? 1 / scale : scale,
      alignment: Alignment.center,
      child: Center(child: CameraPreview(controller)),
    );
    if (filter != null) {
      preview = ColorFiltered(colorFilter: filter!, child: preview);
    }
    if (beauty) {
      preview = ColorFiltered(colorFilter: kBeautyFilter, child: preview);
    }
    return ClipRect(child: preview);
  }
}

class _StudioError extends StatelessWidget {
  const _StudioError({required this.message, required this.onClose});

  final String message;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.videocam_off_rounded,
              color: FeedImmersiveTheme.inkMuted,
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: FeedImmersiveTheme.ink,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(onPressed: onClose, child: const Text('Close')),
          ],
        ),
      ),
    );
  }
}
