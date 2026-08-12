import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/gif/gif_service.dart';
import 'feed_immersive_theme.dart';

/// Bottom-sheet GIF picker (Tenor-powered): a search box over a grid of
/// trending/searched GIFs. Returns the chosen [GifResult] via [Navigator.pop].
///
/// Only shown when a Tenor key is configured (see `FeedinConfig.hasGifSupport`),
/// so [service] is always usable here.
Future<GifResult?> showGifPicker(
  BuildContext context, {
  required GifService service,
}) {
  return showModalBottomSheet<GifResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: FeedImmersiveTheme.glassSurfaceStrong,
    barrierColor: FeedImmersiveTheme.sheetBarrier,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(FeedImmersiveTheme.sheetRadius),
      ),
    ),
    builder: (_) => _GifPickerSheet(service: service),
  );
}

class _GifPickerSheet extends StatefulWidget {
  const _GifPickerSheet({required this.service});

  final GifService service;

  @override
  State<_GifPickerSheet> createState() => _GifPickerSheetState();
}

class _GifPickerSheetState extends State<_GifPickerSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<GifResult> _results = const [];
  bool _loading = true;
  int _version = 0;

  @override
  void initState() {
    super.initState();
    _load('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load(String query) async {
    final version = ++_version;
    setState(() => _loading = true);
    final results = await widget.service.search(query);
    if (!mounted || version != _version) return;
    setState(() {
      _results = results;
      _loading = false;
    });
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _load(value));
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.6,
        child: Column(
          children: [
            const _Grabber(),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: FeedImmersiveTheme.sheetInputSurface,
                  borderRadius: BorderRadius.circular(
                    FeedImmersiveTheme.radiusPill,
                  ),
                  border: Border.all(color: FeedImmersiveTheme.glassBorder),
                ),
                child: TextField(
                  controller: _controller,
                  autofocus: false,
                  onChanged: _onChanged,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.ink,
                    fontSize: 14,
                  ),
                  cursorColor: FeedImmersiveTheme.brandPink,
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Search GIFs',
                    hintStyle: TextStyle(color: FeedImmersiveTheme.inkSubtle),
                    prefixIcon: Icon(
                      Icons.search_rounded,
                      color: FeedImmersiveTheme.inkMuted,
                    ),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: FeedImmersiveTheme.brandPink,
                      ),
                    )
                  : _results.isEmpty
                  ? const Center(
                      child: Text(
                        'No GIFs found.',
                        style: TextStyle(color: FeedImmersiveTheme.inkMuted),
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                          ),
                      itemCount: _results.length,
                      itemBuilder: (context, index) {
                        final gif = _results[index];
                        return GestureDetector(
                          onTap: () => Navigator.of(context).pop(gif),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(
                              FeedImmersiveTheme.radiusMd,
                            ),
                            child: Image.network(
                              gif.previewUrl,
                              fit: BoxFit.cover,
                              gaplessPlayback: true,
                              errorBuilder: (_, _, _) => const ColoredBox(
                                color: FeedImmersiveTheme.surfaceElevated,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Grabber extends StatelessWidget {
  const _Grabber();

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 10, bottom: 8),
    width: 40,
    height: 4,
    decoration: BoxDecoration(
      color: FeedImmersiveTheme.inkSubtle,
      borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
    ),
  );
}
