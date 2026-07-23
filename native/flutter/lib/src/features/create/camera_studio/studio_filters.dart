import 'package:flutter/material.dart';

/// A live camera filter preset: a label, a glyph, and an optional [ColorFilter]
/// applied over the preview (null = original, unfiltered).
///
/// These approximate the prototype's CSS filter set with GPU color matrices so
/// they apply cheaply to the live [CameraPreview] and the captured review.
class StudioFilter {
  const StudioFilter({
    required this.id,
    required this.name,
    required this.icon,
    this.filter,
  });

  final String id;
  final String name;
  final IconData icon;
  final ColorFilter? filter;
}

/// Ordered filter presets shown in the tray.
const List<StudioFilter> kStudioFilters = [
  StudioFilter(id: 'original', name: 'Original', icon: Icons.block),
  StudioFilter(
    id: 'noir',
    name: 'Noir',
    icon: Icons.contrast,
    filter: ColorFilter.matrix(<double>[
      0.2126, 0.7152, 0.0722, 0, 0, //
      0.2126, 0.7152, 0.0722, 0, 0, //
      0.2126, 0.7152, 0.0722, 0, 0, //
      0, 0, 0, 1, 0,
    ]),
  ),
  StudioFilter(
    id: 'vintage',
    name: 'Vintage',
    icon: Icons.history_toggle_off,
    filter: ColorFilter.matrix(<double>[
      0.393, 0.769, 0.189, 0, 0, //
      0.349, 0.686, 0.168, 0, 0, //
      0.272, 0.534, 0.131, 0, 0, //
      0, 0, 0, 1, 0,
    ]),
  ),
  StudioFilter(
    id: 'golden',
    name: 'Golden',
    icon: Icons.wb_sunny_rounded,
    filter: ColorFilter.matrix(<double>[
      1.15, 0, 0, 0, 12, //
      0, 1.05, 0, 0, 6, //
      0, 0, 0.82, 0, 0, //
      0, 0, 0, 1, 0,
    ]),
  ),
  StudioFilter(
    id: 'cyber',
    name: 'Cyber',
    icon: Icons.bolt_rounded,
    filter: ColorFilter.matrix(<double>[
      1.3, 0, 0, 0, -20, //
      0, 1.1, 0, 0, 0, //
      0, 0, 1.35, 0, 10, //
      0, 0, 0, 1, 0,
    ]),
  ),
  StudioFilter(
    id: 'cool',
    name: 'Cool',
    icon: Icons.ac_unit_rounded,
    filter: ColorFilter.matrix(<double>[
      0.85, 0, 0, 0, 0, //
      0, 1.0, 0, 0, 0, //
      0, 0, 1.25, 0, 12, //
      0, 0, 0, 1, 0,
    ]),
  ),
  StudioFilter(
    id: 'punch',
    name: 'Punch',
    icon: Icons.auto_awesome_rounded,
    filter: ColorFilter.matrix(<double>[
      1.4, 0, 0, 0, -51, //
      0, 1.4, 0, 0, -51, //
      0, 0, 1.4, 0, -51, //
      0, 0, 0, 1, 0,
    ]),
  ),
  StudioFilter(
    id: 'glitch',
    name: 'Glitch',
    icon: Icons.blur_on_rounded,
    filter: ColorFilter.matrix(<double>[
      -1, 0, 0, 0, 255, //
      0, -1, 0, 0, 255, //
      0, 0, -1, 0, 255, //
      0, 0, 0, 1, 0,
    ]),
  ),
];

/// Subtle brightening/softening applied when Beauty is toggled on, layered over
/// the selected filter via a second [ColorFiltered].
const ColorFilter kBeautyFilter = ColorFilter.matrix(<double>[
  1.06, 0, 0, 0, 8, //
  0, 1.05, 0, 0, 8, //
  0, 0, 1.06, 0, 8, //
  0, 0, 0, 1, 0,
]);
