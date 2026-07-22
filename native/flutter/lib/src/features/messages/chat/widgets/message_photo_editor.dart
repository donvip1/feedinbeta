import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';

enum MessageCropRatio { free, square, story }

/// The edited asset returned to the message composer for upload/persistence.
class MessagePhotoEditResult {
  const MessagePhotoEditResult({
    required this.file,
    required this.caption,
    required this.ratio,
    required this.rotation,
    required this.grayscale,
    required this.stamp,
  });

  final File file;
  final String caption;
  final MessageCropRatio ratio;
  final int rotation;
  final bool grayscale;
  final String? stamp;
}

/// Full-screen native photo editing route used by the messaging composer.
///
/// Use [MessagePhotoEditor.edit] to push the editor and await a result. The
/// returned file is a cache JPEG; the caller remains responsible for upload.
class MessagePhotoEditor extends StatefulWidget {
  const MessagePhotoEditor({
    super.key,
    required this.imageFile,
    this.initialCaption = '',
  });

  final File imageFile;
  final String initialCaption;

  static Future<MessagePhotoEditResult?> edit(
    BuildContext context, {
    required File imageFile,
    String initialCaption = '',
  }) {
    return Navigator.of(context).push<MessagePhotoEditResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => MessagePhotoEditor(
          imageFile: imageFile,
          initialCaption: initialCaption,
        ),
      ),
    );
  }

  @override
  State<MessagePhotoEditor> createState() => _MessagePhotoEditorState();
}

class _MessagePhotoEditorState extends State<MessagePhotoEditor> {
  ui.Image? _image;
  MessageCropRatio _ratio = MessageCropRatio.free;
  int _rotation = 0;
  bool _grayscale = false;
  String? _stamp;
  late final TextEditingController _captionController = TextEditingController(
    text: widget.initialCaption,
  );
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  Future<void> _loadImage() async {
    final bytes = await widget.imageFile.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    if (mounted) setState(() => _image = frame.image);
  }

  @override
  void dispose() {
    _image?.dispose();
    _captionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: const Color(0xff080b13),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Edit photo', style: TextStyle(fontSize: 18)),
        actions: [
          TextButton(
            onPressed: _image == null || _saving ? null : _save,
            child: _saving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text('Send', style: TextStyle(color: color.primary)),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: _image == null
                  ? const CircularProgressIndicator()
                  : _Preview(
                      image: _image!,
                      rotation: _rotation,
                      grayscale: _grayscale,
                      stamp: _stamp,
                      ratio: _ratio,
                    ),
            ),
          ),
          _Toolbar(
            ratio: _ratio,
            grayscale: _grayscale,
            onRatioChanged: (ratio) => setState(() => _ratio = ratio),
            onRotate: () => setState(() => _rotation = (_rotation + 90) % 360),
            onGrayscale: () => setState(() => _grayscale = !_grayscale),
            onStamp: (stamp) => setState(() => _stamp = stamp),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 18),
            child: TextField(
              controller: _captionController,
              maxLines: 2,
              minLines: 1,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Add a caption…',
                hintStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: Colors.white.withValues(alpha: .08),
                prefixIcon: const Icon(
                  Icons.edit_outlined,
                  color: Colors.white54,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final image = _image;
    if (image == null || _saving) return;
    setState(() => _saving = true);
    try {
      final pngBytes = await _renderEditedImage(image);
      final jpeg = await FlutterImageCompress.compressWithList(
        pngBytes,
        format: CompressFormat.jpeg,
        quality: 90,
      );
      final directory = await getTemporaryDirectory();
      final file = File(
        '${directory.path}/feedin-chat-${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(jpeg, flush: true);
      if (!mounted) return;
      Navigator.of(context).pop(
        MessagePhotoEditResult(
          file: file,
          caption: _captionController.text.trim(),
          ratio: _ratio,
          rotation: _rotation,
          grayscale: _grayscale,
          stamp: _stamp,
        ),
      );
    } catch (error) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not prepare photo: $error')),
        );
      }
    }
  }

  Future<Uint8List> _renderEditedImage(ui.Image source) async {
    final quarterTurn = _rotation == 90 || _rotation == 270;
    final width = quarterTurn ? source.height : source.width;
    final height = quarterTurn ? source.width : source.height;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.save();
    if (_rotation == 90) {
      canvas.translate(width.toDouble(), 0);
      canvas.rotate(math.pi / 2);
    } else if (_rotation == 180) {
      canvas.translate(width.toDouble(), height.toDouble());
      canvas.rotate(math.pi);
    } else if (_rotation == 270) {
      canvas.translate(0, height.toDouble());
      canvas.rotate(-math.pi / 2);
    }
    final paint = Paint()
      ..filterQuality = FilterQuality.high
      ..colorFilter = _grayscale
          ? const ui.ColorFilter.matrix(<double>[
              .213,
              .715,
              .072,
              0,
              0,
              .213,
              .715,
              .072,
              0,
              0,
              .213,
              .715,
              .072,
              0,
              0,
              0,
              0,
              0,
              1,
              0,
            ])
          : null;
    canvas.drawImage(source, Offset.zero, paint);
    canvas.restore();
    final oriented = await recorder.endRecording().toImage(width, height);

    final crop = _cropRect(width.toDouble(), height.toDouble());
    final outputWidth = crop.width.clamp(1, 1600).round();
    final outputHeight = (outputWidth * crop.height / crop.width).round();
    final cropRecorder = ui.PictureRecorder();
    final cropCanvas = Canvas(cropRecorder);
    cropCanvas.drawImageRect(
      oriented,
      crop,
      Rect.fromLTWH(0, 0, outputWidth.toDouble(), outputHeight.toDouble()),
      Paint()..filterQuality = FilterQuality.high,
    );
    if (_stamp != null) {
      final textPainter = TextPainter(
        text: TextSpan(text: _stamp, style: const TextStyle(fontSize: 92)),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(cropCanvas, const Offset(26, 26));
    }
    final result = await cropRecorder.endRecording().toImage(
      outputWidth,
      outputHeight,
    );
    final data = await result.toByteData(format: ui.ImageByteFormat.png);
    oriented.dispose();
    result.dispose();
    return data!.buffer.asUint8List();
  }

  Rect _cropRect(double width, double height) {
    final ratio = switch (_ratio) {
      MessageCropRatio.free => null,
      MessageCropRatio.square => 1.0,
      MessageCropRatio.story => 16 / 9,
    };
    if (ratio == null) return Rect.fromLTWH(0, 0, width, height);
    var cropWidth = width;
    var cropHeight = cropWidth / ratio;
    if (cropHeight > height) {
      cropHeight = height;
      cropWidth = cropHeight * ratio;
    }
    return Rect.fromLTWH(
      (width - cropWidth) / 2,
      (height - cropHeight) / 2,
      cropWidth,
      cropHeight,
    );
  }
}

class _Preview extends StatelessWidget {
  const _Preview({
    required this.image,
    required this.rotation,
    required this.grayscale,
    required this.stamp,
    required this.ratio,
  });

  final ui.Image image;
  final int rotation;
  final bool grayscale;
  final String? stamp;
  final MessageCropRatio ratio;

  @override
  Widget build(BuildContext context) {
    Widget child = Stack(
      alignment: Alignment.topLeft,
      children: [
        RawImage(image: image, fit: BoxFit.contain),
        if (stamp != null)
          Padding(
            padding: const EdgeInsets.all(18),
            child: Text(stamp!, style: const TextStyle(fontSize: 72)),
          ),
      ],
    );
    if (grayscale) {
      child = ColorFiltered(
        colorFilter: const ColorFilter.matrix(<double>[
          .213,
          .715,
          .072,
          0,
          0,
          .213,
          .715,
          .072,
          0,
          0,
          .213,
          .715,
          .072,
          0,
          0,
          0,
          0,
          0,
          1,
          0,
        ]),
        child: child,
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 390, maxHeight: 450),
      child: AspectRatio(
        aspectRatio: ratio == MessageCropRatio.square
            ? 1
            : ratio == MessageCropRatio.story
            ? 16 / 9
            : image.width / image.height,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: ColoredBox(
            color: Colors.black,
            child: RotatedBox(quarterTurns: rotation ~/ 90, child: child),
          ),
        ),
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.ratio,
    required this.grayscale,
    required this.onRatioChanged,
    required this.onRotate,
    required this.onGrayscale,
    required this.onStamp,
  });

  final MessageCropRatio ratio;
  final bool grayscale;
  final ValueChanged<MessageCropRatio> onRatioChanged;
  final VoidCallback onRotate;
  final VoidCallback onGrayscale;
  final ValueChanged<String?> onStamp;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        children: [
          _ToolChoice(
            label: 'Free',
            selected: ratio == MessageCropRatio.free,
            onTap: () => onRatioChanged(MessageCropRatio.free),
          ),
          _ToolChoice(
            label: '1:1',
            selected: ratio == MessageCropRatio.square,
            onTap: () => onRatioChanged(MessageCropRatio.square),
          ),
          _ToolChoice(
            label: '16:9',
            selected: ratio == MessageCropRatio.story,
            onTap: () => onRatioChanged(MessageCropRatio.story),
          ),
          const SizedBox(width: 8),
          IconButton.filledTonal(
            onPressed: onRotate,
            icon: const Icon(Icons.rotate_right),
          ),
          IconButton.filledTonal(
            onPressed: onGrayscale,
            isSelected: grayscale,
            icon: const Icon(Icons.filter_b_and_w_outlined),
          ),
          PopupMenuButton<String>(
            tooltip: 'Stamp emoji',
            icon: const Icon(Icons.emoji_emotions_outlined),
            onSelected: (value) => onStamp(value.isEmpty ? null : value),
            itemBuilder: (_) => const [
              PopupMenuItem(value: '⭐', child: Text('⭐ Star')),
              PopupMenuItem(value: '🔥', child: Text('🔥 Fire')),
              PopupMenuItem(value: '😎', child: Text('😎 Cool')),
              PopupMenuItem(value: '', child: Text('Remove stamp')),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToolChoice extends StatelessWidget {
  const _ToolChoice({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 6),
    child: ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    ),
  );
}
