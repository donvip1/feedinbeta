import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';

enum MessageCropRatio { free, square, story }

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

enum _PhotoFilter { normal, vivid, warm, cool, mono, sepia }

extension on _PhotoFilter {
  String get label => switch (this) {
    _PhotoFilter.normal => 'Normal',
    _PhotoFilter.vivid => 'Vivid',
    _PhotoFilter.warm => 'Warm',
    _PhotoFilter.cool => 'Cool',
    _PhotoFilter.mono => 'B&W',
    _PhotoFilter.sepia => 'Sepia',
  };
  ui.ColorFilter? get colorFilter => switch (this) {
    _PhotoFilter.normal => null,
    _PhotoFilter.vivid => const ui.ColorFilter.matrix(<double>[
      1.15,
      0,
      0,
      0,
      -12,
      0,
      1.15,
      0,
      0,
      -12,
      0,
      0,
      1.15,
      0,
      -12,
      0,
      0,
      0,
      1,
      0,
    ]),
    _PhotoFilter.warm => const ui.ColorFilter.matrix(<double>[
      1.08,
      0,
      0,
      0,
      8,
      0,
      1,
      0,
      0,
      2,
      0,
      0,
      .9,
      0,
      -4,
      0,
      0,
      0,
      1,
      0,
    ]),
    _PhotoFilter.cool => const ui.ColorFilter.matrix(<double>[
      .92,
      0,
      0,
      0,
      -2,
      0,
      1,
      0,
      0,
      2,
      0,
      0,
      1.12,
      0,
      8,
      0,
      0,
      0,
      1,
      0,
    ]),
    _PhotoFilter.mono => const ui.ColorFilter.matrix(<double>[
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
    _PhotoFilter.sepia => const ui.ColorFilter.matrix(<double>[
      .393,
      .769,
      .189,
      0,
      0,
      .349,
      .686,
      .168,
      0,
      0,
      .272,
      .534,
      .131,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]),
  };
}

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
  }) => Navigator.of(context).push<MessagePhotoEditResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => MessagePhotoEditor(
        imageFile: imageFile,
        initialCaption: initialCaption,
      ),
    ),
  );
  @override
  State<MessagePhotoEditor> createState() => _MessagePhotoEditorState();
}

class _MessagePhotoEditorState extends State<MessagePhotoEditor> {
  ui.Image? _image;
  MessageCropRatio _ratio = MessageCropRatio.free;
  int _rotation = 0;
  _PhotoFilter _filter = _PhotoFilter.normal;
  String? _stamp;
  Offset _stampPosition = const Offset(.5, .5);
  double _stampScale = 1;
  double _stampAngle = 0;
  Rect _crop = const Rect.fromLTWH(0, 0, 1, 1);
  String? _cropHandle;
  Offset? _lastCropPoint;
  double _stampStartScale = 1;
  double _stampStartAngle = 0;
  bool _stampGesture = false;
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

  Size _orientedSize() {
    final i = _image!;
    return _rotation % 180 == 0
        ? Size(i.width.toDouble(), i.height.toDouble())
        : Size(i.height.toDouble(), i.width.toDouble());
  }

  Rect _initialCrop(MessageCropRatio ratio) {
    final s = _orientedSize();
    final target = switch (ratio) {
      MessageCropRatio.free => null,
      MessageCropRatio.square => 1.0,
      MessageCropRatio.story => 16 / 9,
    };
    if (target == null) return const Rect.fromLTWH(0, 0, 1, 1);
    final a = s.width / s.height;
    var w = 1.0, h = 1.0;
    if (a > target) {
      w = target / a;
    } else {
      h = a / target;
    }
    return Rect.fromLTWH((1 - w) / 2, (1 - h) / 2, w, h);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
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
                : Text('Send', style: TextStyle(color: scheme.primary)),
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
                      filter: _filter,
                      crop: _crop,
                      cropEditable: _ratio == MessageCropRatio.free,
                      stamp: _stamp,
                      stampPosition: _stampPosition,
                      stampScale: _stampScale,
                      stampAngle: _stampAngle,
                      onScaleStart: _onScaleStart,
                      onScaleUpdate: _onScaleUpdate,
                      onScaleEnd: (_) {
                        _cropHandle = null;
                        _lastCropPoint = null;
                      },
                    ),
            ),
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: _ratio == MessageCropRatio.free
                ? const Padding(
                    key: ValueKey('free-crop-hint'),
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'Drag an edge or corner to crop',
                      style: TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
          _Toolbar(
            ratio: _ratio,
            filter: _filter,
            onRatioChanged: (ratio) => setState(() {
              _ratio = ratio;
              _crop = _initialCrop(ratio);
            }),
            onRotate: () => setState(() {
              _rotation = (_rotation + 90) % 360;
              _crop = _initialCrop(_ratio);
            }),
            onFilter: (filter) => setState(() => _filter = filter),
            onStamp: (stamp) => setState(() {
              _stamp = stamp;
              _stampPosition = const Offset(.5, .5);
              _stampScale = 1;
              _stampAngle = 0;
            }),
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
                prefixIcon: const Icon(
                  Icons.edit_outlined,
                  color: Colors.white54,
                ),
                filled: true,
                fillColor: Colors.white.withValues(alpha: .08),
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

  void _onScaleStart(ScaleStartDetails details, Rect imageRect) {
    final local = details.localFocalPoint;
    final point = Offset(
      (local.dx - imageRect.left) / imageRect.width,
      (local.dy - imageRect.top) / imageRect.height,
    );
    final stampHit =
        _stamp != null && (point - _stampPosition).distance < .18 * _stampScale;
    _stampGesture = stampHit;
    if (stampHit) {
      _stampStartScale = _stampScale;
      _stampStartAngle = _stampAngle;
    } else if (_ratio == MessageCropRatio.free) {
      _cropHandle = _nearestHandle(point);
      _lastCropPoint = point;
    }
  }

  void _onScaleUpdate(ScaleUpdateDetails details, Rect imageRect) {
    final local = details.localFocalPoint;
    final point = Offset(
      (local.dx - imageRect.left) / imageRect.width,
      (local.dy - imageRect.top) / imageRect.height,
    );
    if (_stampGesture && _stamp != null) {
      setState(() {
        _stampPosition = Offset(
          point.dx.clamp(0.05, .95),
          point.dy.clamp(0.05, .95),
        );
        _stampScale = (_stampStartScale * details.scale).clamp(.35, 3.5);
        _stampAngle = _stampStartAngle + details.rotation;
      });
      return;
    }
    if (_cropHandle == null || _lastCropPoint == null) return;
    final delta = point - _lastCropPoint!;
    var crop = _crop;
    const minSize = .08;
    if (_cropHandle!.contains('l')) {
      crop = Rect.fromLTRB(
        (crop.left + delta.dx).clamp(0, crop.right - minSize),
        crop.top,
        crop.right,
        crop.bottom,
      );
    }
    if (_cropHandle!.contains('r')) {
      crop = Rect.fromLTRB(
        crop.left,
        crop.top,
        (crop.right + delta.dx).clamp(crop.left + minSize, 1),
        crop.bottom,
      );
    }
    if (_cropHandle!.contains('t')) {
      crop = Rect.fromLTRB(
        crop.left,
        (crop.top + delta.dy).clamp(0, crop.bottom - minSize),
        crop.right,
        crop.bottom,
      );
    }
    if (_cropHandle!.contains('b')) {
      crop = Rect.fromLTRB(
        crop.left,
        crop.top,
        crop.right,
        (crop.bottom + delta.dy).clamp(crop.top + minSize, 1),
      );
    }
    setState(() => _crop = crop);
    _lastCropPoint = point;
  }

  String _nearestHandle(Offset p) {
    final d = <String, double>{
      'tl': (p - _crop.topLeft).distance,
      'tr': (p - _crop.topRight).distance,
      'bl': (p - _crop.bottomLeft).distance,
      'br': (p - _crop.bottomRight).distance,
      'l': (p - Offset(_crop.left, _crop.center.dy)).distance,
      'r': (p - Offset(_crop.right, _crop.center.dy)).distance,
      't': (p - Offset(_crop.center.dx, _crop.top)).distance,
      'b': (p - Offset(_crop.center.dx, _crop.bottom)).distance,
    };
    return d.entries.reduce((a, b) => a.value < b.value ? a : b).key;
  }

  Future<void> _save() async {
    final image = _image;
    if (image == null || _saving) return;
    setState(() => _saving = true);
    try {
      final png = await _renderEditedImage(image);
      final jpeg = await FlutterImageCompress.compressWithList(
        png,
        format: CompressFormat.jpeg,
        quality: 90,
      );
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/feedin-chat-${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(jpeg, flush: true);
      if (!mounted) return;
      Navigator.of(context).pop(
        MessagePhotoEditResult(
          file: file,
          caption: _captionController.text.trim(),
          ratio: _ratio,
          rotation: _rotation,
          grayscale: _filter == _PhotoFilter.mono,
          stamp: _stamp,
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not prepare photo: $e')));
      }
    }
  }

  Future<Uint8List> _renderEditedImage(ui.Image source) async {
    final sw = source.width.toDouble(), sh = source.height.toDouble();
    final ow = _rotation % 180 == 0 ? sw : sh,
        oh = _rotation % 180 == 0 ? sh : sw;
    final crop = Rect.fromLTRB(
      _crop.left * ow,
      _crop.top * oh,
      _crop.right * ow,
      _crop.bottom * oh,
    );
    final outW = crop.width.clamp(1, 1600).round(),
        outH = (outW * crop.height / crop.width).round();
    final rec = ui.PictureRecorder();
    final canvas = Canvas(rec);
    final paint = Paint()
      ..filterQuality = FilterQuality.high
      ..colorFilter = _filter.colorFilter;
    Rect src;
    if (_rotation == 0) {
      src = crop;
    } else if (_rotation == 180) {
      src = Rect.fromLTRB(
        sw - crop.right,
        sh - crop.bottom,
        sw - crop.left,
        sh - crop.top,
      );
    } else if (_rotation == 90) {
      src = Rect.fromLTRB(
        crop.top,
        sh - crop.right,
        crop.bottom,
        sh - crop.left,
      );
    } else {
      src = Rect.fromLTRB(
        sw - crop.bottom,
        crop.left,
        sw - crop.top,
        crop.right,
      );
    }
    if (_rotation == 90 || _rotation == 270) {
      canvas.save();
      if (_rotation == 90) {
        canvas.translate(outW.toDouble(), 0);
        canvas.rotate(math.pi / 2);
      } else {
        canvas.translate(0, outH.toDouble());
        canvas.rotate(-math.pi / 2);
      }
      canvas.drawImageRect(
        source,
        src,
        Rect.fromLTWH(0, 0, outH.toDouble(), outW.toDouble()),
        paint,
      );
      canvas.restore();
    } else {
      canvas.drawImageRect(
        source,
        src,
        Rect.fromLTWH(0, 0, outW.toDouble(), outH.toDouble()),
        paint,
      );
    }
    if (_stamp != null) {
      final x = ((_stampPosition.dx - _crop.left) / _crop.width) * outW;
      final y = ((_stampPosition.dy - _crop.top) / _crop.height) * outH;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(_stampAngle);
      final orientedStampSize = math.min(ow, oh) * .18 * _stampScale;
      final exportedStampSize = orientedStampSize * outW / crop.width;
      final tp = TextPainter(
        text: TextSpan(
          text: _stamp,
          style: TextStyle(fontSize: exportedStampSize),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
      canvas.restore();
    }
    final result = await rec.endRecording().toImage(outW, outH);
    final data = await result.toByteData(format: ui.ImageByteFormat.png);
    result.dispose();
    return data!.buffer.asUint8List();
  }
}

class _Preview extends StatelessWidget {
  const _Preview({
    required this.image,
    required this.rotation,
    required this.filter,
    required this.crop,
    required this.cropEditable,
    required this.stamp,
    required this.stampPosition,
    required this.stampScale,
    required this.stampAngle,
    required this.onScaleStart,
    required this.onScaleUpdate,
    required this.onScaleEnd,
  });
  final ui.Image image;
  final int rotation;
  final _PhotoFilter filter;
  final Rect crop;
  final bool cropEditable;
  final String? stamp;
  final Offset stampPosition;
  final double stampScale;
  final double stampAngle;
  final void Function(ScaleStartDetails, Rect) onScaleStart;
  final void Function(ScaleUpdateDetails, Rect) onScaleUpdate;
  final ValueChanged<ScaleEndDetails> onScaleEnd;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, c) {
      final size = Size(
        c.maxWidth.clamp(280, 420),
        c.maxHeight.clamp(260, 520),
      );
      final aspect = rotation % 180 == 0
          ? image.width / image.height
          : image.height / image.width;
      final imageRect = _fitRect(size, aspect);
      return GestureDetector(
        onScaleStart: (d) => onScaleStart(d, imageRect),
        onScaleUpdate: (d) => onScaleUpdate(d, imageRect),
        onScaleEnd: onScaleEnd,
        child: CustomPaint(
          size: size,
          painter: _PreviewPainter(
            image: image,
            rotation: rotation,
            filter: filter,
            crop: crop,
            cropEditable: cropEditable,
            stamp: stamp,
            stampPosition: stampPosition,
            stampScale: stampScale,
            stampAngle: stampAngle,
            imageRect: imageRect,
          ),
        ),
      );
    },
  );
  static Rect _fitRect(Size s, double a) {
    var w = s.width, h = w / a;
    if (h > s.height) {
      h = s.height;
      w = h * a;
    }
    return Rect.fromLTWH((s.width - w) / 2, (s.height - h) / 2, w, h);
  }
}

class _PreviewPainter extends CustomPainter {
  _PreviewPainter({
    required this.image,
    required this.rotation,
    required this.filter,
    required this.crop,
    required this.cropEditable,
    required this.stamp,
    required this.stampPosition,
    required this.stampScale,
    required this.stampAngle,
    required this.imageRect,
  });
  final ui.Image image;
  final int rotation;
  final _PhotoFilter filter;
  final Rect crop;
  final bool cropEditable;
  final String? stamp;
  final Offset stampPosition;
  final double stampScale;
  final double stampAngle;
  final Rect imageRect;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.black);
    final paint = Paint()
      ..filterQuality = FilterQuality.high
      ..colorFilter = filter.colorFilter;
    final dst = imageRect;
    final sourceRect = Rect.fromLTWH(
      0,
      0,
      image.width.toDouble(),
      image.height.toDouble(),
    );
    if (rotation == 0) {
      canvas.drawImageRect(image, sourceRect, dst, paint);
    } else {
      canvas.save();
      if (rotation == 90) {
        canvas.translate(dst.right, dst.top);
        canvas.rotate(math.pi / 2);
        canvas.drawImageRect(
          image,
          sourceRect,
          Rect.fromLTWH(0, 0, dst.height, dst.width),
          paint,
        );
      } else if (rotation == 180) {
        canvas.translate(dst.right, dst.bottom);
        canvas.rotate(math.pi);
        canvas.drawImageRect(
          image,
          sourceRect,
          Rect.fromLTWH(0, 0, dst.width, dst.height),
          paint,
        );
      } else {
        canvas.translate(dst.left, dst.bottom);
        canvas.rotate(-math.pi / 2);
        canvas.drawImageRect(
          image,
          sourceRect,
          Rect.fromLTWH(0, 0, dst.height, dst.width),
          paint,
        );
      }
      canvas.restore();
    }
    final cropRect = Rect.fromLTRB(
      imageRect.left + crop.left * imageRect.width,
      imageRect.top + crop.top * imageRect.height,
      imageRect.left + crop.right * imageRect.width,
      imageRect.top + crop.bottom * imageRect.height,
    );
    final shade = Paint()..color = Colors.black.withValues(alpha: .48);
    canvas.drawRect(
      Rect.fromLTRB(
        imageRect.left,
        imageRect.top,
        imageRect.right,
        cropRect.top,
      ),
      shade,
    );
    canvas.drawRect(
      Rect.fromLTRB(
        imageRect.left,
        cropRect.bottom,
        imageRect.right,
        imageRect.bottom,
      ),
      shade,
    );
    canvas.drawRect(
      Rect.fromLTRB(
        imageRect.left,
        cropRect.top,
        cropRect.left,
        cropRect.bottom,
      ),
      shade,
    );
    canvas.drawRect(
      Rect.fromLTRB(
        cropRect.right,
        cropRect.top,
        imageRect.right,
        cropRect.bottom,
      ),
      shade,
    );
    final border = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = Colors.white;
    canvas.drawRect(cropRect, border);
    final handlePaint = Paint()..color = Colors.white;
    if (cropEditable) {
      final handles = <Offset>[
        cropRect.topLeft,
        cropRect.topCenter,
        cropRect.topRight,
        cropRect.centerRight,
        cropRect.bottomRight,
        cropRect.bottomCenter,
        cropRect.bottomLeft,
        cropRect.centerLeft,
      ];
      for (final handle in handles) {
        canvas.drawCircle(handle, 7, handlePaint);
      }
    }
    if (stamp != null) {
      final point = Offset(
        imageRect.left + stampPosition.dx * imageRect.width,
        imageRect.top + stampPosition.dy * imageRect.height,
      );
      canvas.save();
      canvas.translate(point.dx, point.dy);
      canvas.rotate(stampAngle);
      final text = TextPainter(
        text: TextSpan(
          text: stamp,
          style: TextStyle(
            fontSize:
                math.min(imageRect.width, imageRect.height) * .18 * stampScale,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, Offset(-text.width / 2, -text.height / 2));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _PreviewPainter old) => true;
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.ratio,
    required this.filter,
    required this.onRatioChanged,
    required this.onRotate,
    required this.onFilter,
    required this.onStamp,
  });
  final MessageCropRatio ratio;
  final _PhotoFilter filter;
  final ValueChanged<MessageCropRatio> onRatioChanged;
  final VoidCallback onRotate;
  final ValueChanged<_PhotoFilter> onFilter;
  final ValueChanged<String?> onStamp;
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        children: [
          _ToolChoice(
            label: 'Free crop',
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
          PopupMenuButton<_PhotoFilter>(
            tooltip: 'Filters',
            icon: const Icon(Icons.tune),
            onSelected: onFilter,
            itemBuilder: (_) => _PhotoFilter.values
                .map((f) => PopupMenuItem(value: f, child: Text(f.label)))
                .toList(),
          ),
          PopupMenuButton<String>(
            tooltip: 'Stickers and emoji',
            icon: const Icon(Icons.emoji_emotions_outlined),
            onSelected: (value) => onStamp(value.isEmpty ? null : value),
            itemBuilder: (_) => const [
              PopupMenuItem(value: '🚀', child: Text('🚀 Rocket sticker')),
              PopupMenuItem(value: '🔥', child: Text('🔥 Fire sticker')),
              PopupMenuItem(value: '🎉', child: Text('🎉 Party sticker')),
              PopupMenuItem(value: '😎', child: Text('😎 Cool')),
              PopupMenuItem(value: '❤️', child: Text('❤️ Heart')),
              PopupMenuItem(value: '✨', child: Text('✨ Sparkles')),
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
