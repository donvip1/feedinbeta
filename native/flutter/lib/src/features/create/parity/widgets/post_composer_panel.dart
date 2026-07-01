import 'package:flutter/material.dart';

import '../create_tokens.dart';
import '../create_view_models.dart';
import 'composer_media_carousel.dart';
import 'hashtag_input.dart';
import 'post_action_bar.dart';
import 'privacy_selector.dart';

/// Top-level, fully-presentational container for the personal post-creation
/// surface (caption, media, hashtags, privacy, submit).
///
/// It is STATELESS: every piece of state lives in [view] and every user intent
/// is surfaced through [callbacks]. It NEVER touches Supabase, a repository, or
/// `image_picker` directly — the screen layer owns all of that and rebuilds a
/// fresh [PostComposerView] on each change.
///
/// Layout (top -> bottom), as a scrollable [Column] on
/// [CreateColors.background]:
///   1. optional header (back/close + centered 'Create post' title),
///   2. the caption field ([_CaptionInputField], private to this file),
///   3. media: the [ComposerMediaCarousel] when [PostComposerView.hasMedia],
///      otherwise a dashed 'Add photos or videos' tappable tile; an
///      'Add more (n/max)' button is shown under the carousel while below the
///      media limit,
///   4. the [HashtagInput],
///   5. a 'Privacy' section label + the [PrivacySelector],
///   6. the [PostActionBar].
///
/// Spacing uses [CreateSpacing] — `md` between adjacent rows, `lg` between
/// logical sections.
class PostComposerPanel extends StatelessWidget {
  const PostComposerPanel({
    super.key,
    required this.view,
    required this.callbacks,
    this.showHeader = true,
  });

  /// Immutable snapshot the panel renders.
  final PostComposerView view;

  /// Bundle of intents emitted back to the screen.
  final PostComposerCallbacks callbacks;

  /// Whether to render the close/title header row at the top of the panel.
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];

    // (1) Optional header row.
    if (showHeader) {
      children.add(const _ComposerHeader());
      children.add(const SizedBox(height: CreateSpacing.lg));
    }

    // (2) Caption field.
    children.add(
      _CaptionInputField(
        value: view.caption,
        onChanged: callbacks.onCaptionChanged,
      ),
    );
    children.add(const SizedBox(height: CreateSpacing.lg));

    // (3) Media: carousel + 'add more', or an empty 'add media' tile.
    children.add(_buildMediaSection());
    children.add(const SizedBox(height: CreateSpacing.lg));

    // (4) Hashtag input.
    children.add(
      HashtagInput(
        rawValue: view.hashtagsRaw,
        hashtags: view.hashtags,
        maxHashtags: view.maxHashtags,
        onChanged: callbacks.onHashtagsChanged,
        onRemoveTag: callbacks.onRemoveHashtag,
      ),
    );
    children.add(const SizedBox(height: CreateSpacing.lg));

    // (5) Privacy section.
    children.add(const _SectionLabel('Privacy'));
    children.add(const SizedBox(height: CreateSpacing.sm));
    children.add(
      PrivacySelector(
        value: view.privacy,
        onChanged: callbacks.onPrivacyChanged,
      ),
    );
    children.add(const SizedBox(height: CreateSpacing.lg));

    // (6) Action bar (submit / draft).
    children.add(
      PostActionBar(
        canSubmit: view.canSubmit,
        isSubmitting: view.isSubmitting,
        onSubmit: callbacks.onSubmit,
        onSaveDraft: callbacks.onSaveDraft,
      ),
    );

    return ColoredBox(
      color: CreateColors.background,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(CreateSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: children,
        ),
      ),
    );
  }

  /// Either the carousel of selected media (+ an 'Add more' affordance) or the
  /// empty-state tile that opens the picker.
  Widget _buildMediaSection() {
    if (!view.hasMedia) {
      return _AddMediaTile(onTap: callbacks.onAddMedia);
    }

    final section = <Widget>[
      ComposerMediaCarousel(
        items: view.media,
        currentIndex: view.currentPreviewIndex,
        onIndexChanged: callbacks.onPreviewIndexChanged,
        onRemove: callbacks.onRemoveMedia,
      ),
    ];

    if (!view.isAtMediaLimit) {
      section.add(const SizedBox(height: CreateSpacing.sm));
      section.add(
        _AddMoreMediaButton(
          count: view.media.length,
          max: view.maxMedia,
          onTap: callbacks.onAddMedia,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: section,
    );
  }
}

// ===========================================================================
// Header
// ===========================================================================

/// Leading close button + centered 'Create post' title. Private to this file —
/// it only exists to top the composer panel.
class _ComposerHeader extends StatelessWidget {
  const _ComposerHeader();

  @override
  Widget build(BuildContext context) {
    // The close callback is read from the inherited panel via the closest
    // PostComposerPanel — but to keep this widget self-contained we accept it
    // through the panel directly. See note: the panel passes it explicitly.
    final panel = context.findAncestorWidgetOfExactType<PostComposerPanel>();
    final onClose = panel?.callbacks.onClose;

    return SizedBox(
      height: CreateSpacing.headerHeight,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              onPressed: onClose,
              tooltip: 'Close',
              icon: const Icon(Icons.close, color: CreateColors.foreground),
            ),
          ),
          const Text('Create post', style: CreateTextStyles.title),
        ],
      ),
    );
  }
}

// ===========================================================================
// Caption field (private — co-located with the panel for parity)
// ===========================================================================

/// Multiline caption field with a leading description glyph (FileText parity)
/// and a 'Write a caption...' hint.
///
/// Stateful only to own its [TextEditingController]; it remains presentational
/// (it reports edits via [onChanged] and does not mutate any external state).
class _CaptionInputField extends StatefulWidget {
  const _CaptionInputField({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  State<_CaptionInputField> createState() => _CaptionInputFieldState();
}

class _CaptionInputFieldState extends State<_CaptionInputField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.value,
  );

  @override
  void didUpdateWidget(covariant _CaptionInputField oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Keep the controller in sync when the screen pushes a new value (e.g. a
    // cleared draft) without clobbering an in-progress edit / caret.
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const border = OutlineInputBorder(
      borderRadius: CreateRadii.field,
      borderSide: BorderSide(color: CreateColors.border),
    );

    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      minLines: 3,
      maxLines: 8,
      keyboardType: TextInputType.multiline,
      textInputAction: TextInputAction.newline,
      cursorColor: CreateColors.primary,
      style: CreateTextStyles.composerInput,
      decoration: const InputDecoration(
        isDense: true,
        filled: true,
        fillColor: Colors.transparent,
        hintText: 'Write a caption...',
        hintStyle: CreateTextStyles.composerHint,
        contentPadding: EdgeInsets.symmetric(
          horizontal: CreateSpacing.md,
          vertical: CreateSpacing.md,
        ),
        // Leading icon top-aligned with the first line of a multiline field.
        prefixIcon: Padding(
          padding: EdgeInsets.only(
            left: CreateSpacing.md,
            right: CreateSpacing.sm,
          ),
          child: Icon(
            Icons.description_outlined,
            size: 20,
            color: CreateColors.mutedForeground,
          ),
        ),
        prefixIconConstraints: BoxConstraints(minWidth: 0, minHeight: 0),
        border: border,
        enabledBorder: border,
        focusedBorder: OutlineInputBorder(
          borderRadius: CreateRadii.field,
          borderSide: BorderSide(color: CreateColors.primary),
        ),
      ),
    );
  }
}

// ===========================================================================
// Empty-state media tile
// ===========================================================================

/// Dashed, tappable empty-state tile shown when no media is selected. Mirrors
/// the web `MediaGalleryPicker` empty state — a primary-tinted circular icon
/// badge over a title + helper line — so the composer's first impression
/// matches the picker's premium treatment. Tapping it asks the screen to open
/// the picker.
class _AddMediaTile extends StatelessWidget {
  const _AddMediaTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: CreateRadii.field,
      child: InkWell(
        onTap: onTap,
        borderRadius: CreateRadii.field,
        child: CustomPaint(
          painter: const _DashedBorderPainter(
            color: CreateColors.border,
            radius: CreateRadii.md,
          ),
          child: Container(
            constraints: const BoxConstraints(minHeight: 148),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(
              horizontal: CreateSpacing.lg,
              vertical: CreateSpacing.xl,
            ),
            child: const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _PrimaryIconBadge(icon: Icons.add_photo_alternate_outlined),
                SizedBox(height: CreateSpacing.md),
                Text('Add photos or videos', style: CreateTextStyles.title),
                SizedBox(height: CreateSpacing.xs),
                Text(
                  'Tap to capture or pick from your library',
                  textAlign: TextAlign.center,
                  style: CreateTextStyles.helper,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A 56px circular primary-tinted badge holding a brand-colored glyph. Mirrors
/// the web picker's empty-state icon chip.
class _PrimaryIconBadge extends StatelessWidget {
  const _PrimaryIconBadge({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: CreateColors.primaryFaint,
      ),
      child: Icon(icon, size: 28, color: CreateColors.primary),
    );
  }
}

/// 'Add more (n/max)' bordered pill beneath the carousel while under the limit.
/// Matches the web `MediaGalleryPicker` outlined "Add More" affordance and the
/// picker sheet's add-more footer for a consistent media-tools language.
class _AddMoreMediaButton extends StatelessWidget {
  const _AddMoreMediaButton({
    required this.count,
    required this.max,
    required this.onTap,
  });

  final int count;
  final int max;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: CreateRadii.field,
      child: InkWell(
        borderRadius: CreateRadii.field,
        onTap: onTap,
        child: Container(
          height: CreateSpacing.tapTarget,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: CreateRadii.field,
            border: Border.all(color: CreateColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.add_photo_alternate_outlined,
                size: 18,
                color: CreateColors.primary,
              ),
              const SizedBox(width: CreateSpacing.sm),
              Text(
                'Add more ($count/$max)',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: CreateColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ===========================================================================
// Small shared bits
// ===========================================================================

/// An uppercase section label (e.g. 'Privacy') in the muted section style.
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(text.toUpperCase(), style: CreateTextStyles.sectionLabel),
    );
  }
}

/// Paints a rounded-rect dashed border for the empty media tile (no SDK widget
/// offers this directly and adding a package is disallowed).
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  static const double strokeWidth = 1.5;
  static const double dashLength = 6;
  static const double gapLength = 4;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rrect);
    final dashed = Path();
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dashLength;
        dashed.addPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          Offset.zero,
        );
        distance = next + gapLength;
      }
    }
    canvas.drawPath(dashed, paint);
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.radius != radius;
  }
}
