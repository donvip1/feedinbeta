import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/connectivity/connectivity_service.dart';
import '../../../core/sync/upload_queue_service.dart';
import '../../../data/local/post_draft_repository.dart';
import '../../../data/local/upload_queue_repository.dart';
import '../../feed/immersive/feed_immersive_theme.dart';
import '../create_post_screen.dart';
import '../parity/create_view_models.dart';
import 'camera_studio_review.dart';
import 'studio_capture_controls.dart';
import 'studio_filter_tray.dart';
import 'studio_filters.dart';
import 'studio_tool_rail.dart';
import 'studio_top_bar.dart';

/// Full-screen live camera studio. Owns the camera lifecycle and capture state
/// machine, presents the premium studio chrome, and — on Next — hands the
/// captured file to the existing [CreatePostScreen] publish pipeline.
class CameraStudioScreen extends StatefulWidget {
  const CameraStudioScreen({
    super.key,
    required this.draftRepository,
    required this.uploadQueueRepository,
    required this.uploadQueueService,
    required this.connectivityService,
    required this.onPostUploaded,
    this.initialMode = StudioCaptureMode.photo,
  });

  final PostDraftRepository draftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final UploadQueueService uploadQueueService;
  final ConnectivityService connectivityService;
  final ValueChanged<String?> onPostUploaded;
  final StudioCaptureMode initialMode;

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
  StudioFilter _filter = kStudioFilters.first;
  bool _filtersOpen = false;
  bool _beauty = false;
  int _timer = 0; // 0 / 3 / 10 seconds
  bool _isRecording = false;

  int _countdown = 0;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
    WidgetsBinding.instance.addObserver(this);
    _setupCameras();
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
      if (file != null && mounted) {
        _openReview(file, isVideo: _mode.isVideo);
      }
    } catch (_) {
      _showError('Could not open the gallery.');
    }
  }

  void _openReview(XFile file, {required bool isVideo}) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CameraStudioReview(
          file: file,
          isVideo: isVideo,
          filter: _beauty ? null : _filter.filter,
          onNext: () => _handoffToComposer(file, isVideo: isVideo),
        ),
      ),
    );
  }

  Future<void> _handoffToComposer(XFile file, {required bool isVideo}) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Complete Post')),
          body: CreatePostScreen(
            draftRepository: widget.draftRepository,
            uploadQueueRepository: widget.uploadQueueRepository,
            uploadQueueService: widget.uploadQueueService,
            connectivityService: widget.connectivityService,
            onPostUploaded: widget.onPostUploaded,
            initialMediaPath: file.path,
            initialMediaKind: isVideo
                ? CreateMediaKind.video
                : CreateMediaKind.image,
          ),
        ),
      ),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
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
                    filter: _filter.filter,
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
                    filtersOpen: _filtersOpen,
                    timerSeconds: _timer,
                    onToggleBeauty: () => setState(() => _beauty = !_beauty),
                    onToggleFilters: () =>
                        setState(() => _filtersOpen = !_filtersOpen),
                    onCycleTimer: _cycleTimer,
                  ),
                ),

                // Filter tray (above the capture controls).
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 168,
                  child: StudioFilterTray(
                    visible: _filtersOpen,
                    selectedId: _filter.id,
                    onSelected: (f) => setState(() => _filter = f),
                    onClose: () => setState(() => _filtersOpen = false),
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
