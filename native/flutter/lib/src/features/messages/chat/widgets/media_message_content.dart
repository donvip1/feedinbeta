import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/media/cached_image.dart';
import '../audio_message_support.dart';
import '../chat_theme.dart';
import '../chat_view_models.dart';

/// Inline media body for a chat bubble. Designed to be handed to
/// `ChatMessageBubble.mediaSlot` so it inherits the bubble's chrome (padding,
/// background, rounded corners) rather than painting its own bubble.
///
/// It reads [ChatMessageView.media] and dispatches on [ChatMessageView.mediaKind]:
///
///  * IMAGE -> a rounded (`ChatRadii.md`) thumbnail (max ~260x340) drawn from the
///    local file (preferred) or the remote URL, with a bottom dark gradient
///    overlay carrying a size chip on the left and a maximize button on the
///    right. Tapping anywhere -> [onOpenViewer].
///  * VIDEO -> the same framed thumbnail using `media.thumbnailUrl` as a poster,
///    plus a centered circular play overlay. This widget NEVER initialises a
///    `VideoPlayerController`; the full-screen viewer owns playback. Tap ->
///    [onOpenViewer].
///  * FILE -> a horizontal card: a rounded icon tile, a name + size column, and
///    a trailing download/open button -> [onDownload].
///  * AUDIO -> a minimal generic audio chip (a play affordance + label). The
///    dedicated `VoiceNoteBubble` owns the rich voice UI; this is the fallback
///    for a plain audio attachment.
///
/// For non-own media that is not yet ready, a download state machine is drawn:
/// `idle` -> a "Tap to download" placeholder (-> [onDownload]); `downloading` ->
/// a circular progress ring with a percentage; `error` -> a "Tap to retry" tile
/// (-> [onRetryDownload]); once `downloaded` (or for own media, always) the real
/// media is revealed.
///
/// Purely presentational: no network/file IO, no `VideoPlayerController`, no
/// Supabase/repository access. The parent supplies download state + callbacks.
class MediaMessageContent extends StatelessWidget {
  const MediaMessageContent({
    super.key,
    required this.message,
    this.onOpenViewer,
    this.onOpenViewOnce,
    this.onDownload,
    this.onRetryDownload,
  });

  /// The message whose [ChatMessageView.media] payload is rendered.
  final ChatMessageView message;

  /// Open the full-screen viewer (image/video). The viewer owns playback.
  final VoidCallback? onOpenViewer;

  /// Open a not-yet-seen incoming view-once photo. After it's viewed the sender
  /// is told (via `mark_view_once_seen`) and the tile becomes an "Opened"
  /// tombstone.
  final VoidCallback? onOpenViewOnce;

  /// Begin (or, for files, open) a download. Used by file rows and by the
  /// `idle` placeholder tile.
  final VoidCallback? onDownload;

  /// Retry a previously failed download (the `error` tile).
  final VoidCallback? onRetryDownload;

  // Web parity: thumbnails clamp to 260x340 (image) / 260x360 (video). We use a
  // single max box and let BoxFit.cover crop.
  static const double _thumbMaxWidth = 260;
  static const double _thumbMaxHeight = 340;
  static const double _placeholderMinWidth = 180;
  static const double _placeholderMinHeight = 78;

  MessageMedia? get _media => message.media;

  /// Own media is always treated as ready; everything else follows the media's
  /// own [MessageMedia.isReady] flag (localPath present or state==downloaded).
  bool get _isReady => message.isMine || (_media?.isReady ?? false);

  @override
  Widget build(BuildContext context) {
    final media = _media;
    if (media == null || media.kind == ChatMediaKind.none) {
      return const SizedBox.shrink();
    }

    // View-once media renders as a self-destructing tile rather than a
    // thumbnail: my own copy shows a "View once" sent state; an already-opened
    // one (mine or theirs) becomes an "Opened" tombstone; an unopened incoming
    // one is a tap-to-reveal tile that burns on view.
    if (message.viewOnce) {
      if (message.viewOnceSeen) {
        return const _ViewOnceTile(
          icon: Icons.visibility_off_rounded,
          label: 'Opened',
        );
      }
      if (message.isMine) {
        return const _ViewOnceTile(
          icon: Icons.hourglass_empty_rounded,
          label: 'Photo · View once',
        );
      }
      return _ViewOnceTile(
        icon: Icons.hourglass_empty_rounded,
        label: 'Tap to view once',
        onTap: onOpenViewOnce,
        emphasized: true,
      );
    }

    // Files always render as a card row (they carry their own download/open
    // affordance inline and don't need the placeholder state machine).
    if (media.kind == ChatMediaKind.file) {
      return _FileCard(media: media, isMine: message.isMine, onTap: onDownload);
    }

    // Audio falls back to a compact chip; the rich voice UI lives elsewhere
    // (VoiceNoteBubble, injected by the screen for audio notes).
    if (media.kind == ChatMediaKind.audio) {
      return _AudioChip(media: media, isMine: message.isMine);
    }

    // Music files fall back to a compact music chip; the rich track UI lives in
    // MusicMessageBubble, injected by the screen. This keeps a music attachment
    // from ever being mis-rendered as an image when no dedicated slot is wired.
    if (media.kind == ChatMediaKind.music) {
      return _MusicChip(media: media, isMine: message.isMine);
    }

    // Incoming photos can be previewed from their signed remote URL before
    // they are explicitly saved. Keep the download affordance visible on the
    // preview, WhatsApp-style. Active/error download states still use the
    // state-machine tiles so progress and retry remain unambiguous.
    // A caption-less photo/video overlays its own timestamp (and, for own
    // messages, delivery ticks) on the image bottom-right — the enclosing
    // bubble drops its separate meta row for these (see [wantsFullBleed]). When
    // a caption is present the bubble owns the meta row and no overlay is drawn.
    final Widget? metaOverlay = message.hasText
        ? null
        : _MediaMetaOverlay(message: message);

    if (!_isReady) {
      final canPreviewRemote =
          media.downloadState == MediaDownloadState.idle &&
          ((media.thumbnailUrl?.isNotEmpty ?? false) ||
              (media.remoteUrl?.isNotEmpty ?? false));
      if (canPreviewRemote && media.kind == ChatMediaKind.image) {
        return _ImageThumbnail(
          media: media,
          onTap: onOpenViewer,
          onDownload: onDownload,
          metaOverlay: metaOverlay,
        );
      }
      if (canPreviewRemote && media.kind == ChatMediaKind.video) {
        return _VideoThumbnail(
          media: media,
          onTap: onOpenViewer,
          onDownload: onDownload,
          metaOverlay: metaOverlay,
        );
      }
      return _DownloadGate(
        media: media,
        isMine: message.isMine,
        onDownload: onDownload,
        onRetryDownload: onRetryDownload,
      );
    }

    if (media.kind == ChatMediaKind.video) {
      return _VideoThumbnail(
        media: media,
        onTap: onOpenViewer,
        metaOverlay: metaOverlay,
      );
    }
    return _ImageThumbnail(
      media: media,
      onTap: onOpenViewer,
      metaOverlay: metaOverlay,
    );
  }

  /// Whether this message's media renders as an edge-to-edge photo/video
  /// thumbnail (as opposed to an inset card/tile). The bubble reads this to drop
  /// its inner padding so the media bleeds to the rounded corners, and to
  /// suppress its meta row for caption-less media. MUST stay in sync with the
  /// thumbnail branches in [build].
  static bool wantsFullBleed(ChatMessageView message) {
    final media = message.media;
    if (media == null) return false;
    if (message.isDeletedForEveryone) return false;
    if (message.viewOnce) return false;
    if (media.kind != ChatMediaKind.image &&
        media.kind != ChatMediaKind.video) {
      return false;
    }
    final isReady = message.isMine || media.isReady;
    final canPreviewRemote =
        media.downloadState == MediaDownloadState.idle &&
        ((media.thumbnailUrl?.isNotEmpty ?? false) ||
            (media.remoteUrl?.isNotEmpty ?? false));
    return isReady || canPreviewRemote;
  }
}

// ---------------------------------------------------------------------------
// Image thumbnail
// ---------------------------------------------------------------------------

class _ImageThumbnail extends StatelessWidget {
  const _ImageThumbnail({
    required this.media,
    this.onTap,
    this.onDownload,
    this.metaOverlay,
  });

  final MessageMedia media;
  final VoidCallback? onTap;
  final VoidCallback? onDownload;

  /// Timestamp/status pill shown bottom-right for caption-less media.
  final Widget? metaOverlay;

  @override
  Widget build(BuildContext context) {
    return _FramedThumbnail(
      onTap: onTap,
      dimensionProvider: _dimensionProvider(media),
      image: _MediaImage(media: media, preferLocal: true),
      overlay: _buildOverlay(),
    );
  }

  /// Ready media shows only a self-backed time pill (no dark scrim, no
  /// maximize button — a tap opens the viewer). Not-yet-saved incoming media
  /// keeps a download affordance on the right.
  Widget? _buildOverlay() {
    final download = onDownload;
    if (download != null) {
      return _MediaBottomBar(
        left: metaOverlay,
        right: _RoundIconButton(
          onTap: download,
          icon: Icons.download_rounded,
          tooltip: 'Download',
        ),
      );
    }
    if (metaOverlay != null) return _MediaBottomBar(right: metaOverlay);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video thumbnail (poster + play overlay; no inline playback)
// ---------------------------------------------------------------------------

class _VideoThumbnail extends StatelessWidget {
  const _VideoThumbnail({
    required this.media,
    this.onTap,
    this.onDownload,
    this.metaOverlay,
  });

  final MessageMedia media;
  final VoidCallback? onTap;
  final VoidCallback? onDownload;

  /// Timestamp/status pill shown bottom-right for caption-less media.
  final Widget? metaOverlay;

  @override
  Widget build(BuildContext context) {
    // Poster: prefer an explicit thumbnail; fall back to the (possibly local)
    // media frame so we still show *something*. No VideoPlayer is created here.
    final Widget poster = media.thumbnailUrl?.isNotEmpty == true
        ? CachedImage(
            url: media.thumbnailUrl!,
            fit: BoxFit.cover,
            placeholder: const _ShimmerBox(),
            errorWidget: const _ThumbFallback(icon: Icons.movie_outlined),
          )
        : _MediaImage(
            media: media,
            preferLocal: true,
            fallbackIcon: Icons.movie_outlined,
          );

    return _FramedThumbnail(
      onTap: onTap,
      fallbackAspectRatio: 16 / 9,
      dimensionProvider: _dimensionProvider(media, preferThumbnail: true),
      image: poster,
      foreground: const Center(child: _PlayBadge()),
      // A soft flat scrim keeps the play badge legible over any poster.
      scrim: const DecoratedBox(
        decoration: BoxDecoration(color: Color(0x33000000)),
      ),
      overlay: _buildOverlay(),
    );
  }

  Widget? _buildOverlay() {
    // A duration pill (when the model carries one) sits bottom-left; the
    // download button or the time pill sits bottom-right.
    final durationText = formatMediaDuration(media.audioDurationMs);
    final Widget? left = durationText.isEmpty
        ? null
        : _DurationPill(text: durationText);
    final download = onDownload;
    final Widget? right = download != null
        ? _RoundIconButton(
            onTap: download,
            icon: Icons.download_rounded,
            tooltip: 'Download',
          )
        : metaOverlay;
    if (left == null && right == null) return null;
    return _MediaBottomBar(left: left, right: right);
  }
}

/// Centered circular play button shown over a video poster.
class _PlayBadge extends StatelessWidget {
  const _PlayBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      decoration: const BoxDecoration(
        color: Color(0x59000000),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: const Padding(
        padding: EdgeInsets.only(left: 3),
        child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 30),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared framed thumbnail shell (used by image + video)
// ---------------------------------------------------------------------------

ImageProvider<Object>? _dimensionProvider(
  MessageMedia media, {
  bool preferThumbnail = false,
}) {
  final localPath = media.localPath;
  if (localPath != null && localPath.isNotEmpty) {
    final file = File(localPath);
    if (file.existsSync()) return FileImage(file);
  }
  final remoteUrl = preferThumbnail && (media.thumbnailUrl?.isNotEmpty ?? false)
      ? media.thumbnailUrl
      : media.remoteUrl;
  if (remoteUrl != null && remoteUrl.isNotEmpty) {
    return CachedNetworkImageProvider(remoteUrl);
  }
  return null;
}

class _FramedThumbnail extends StatefulWidget {
  const _FramedThumbnail({
    required this.image,
    this.overlay,
    this.foreground,
    this.scrim,
    this.onTap,
    this.dimensionProvider,
    this.fallbackAspectRatio = 4 / 3,
  });

  final Widget image;

  /// Bottom chrome (size chip + maximize), pinned to the lower edge.
  final Widget? overlay;

  /// Centered foreground (e.g. the video play badge).
  final Widget? foreground;

  /// Optional full-bleed scrim painted above the image but below [foreground].
  final Widget? scrim;

  final VoidCallback? onTap;
  final ImageProvider<Object>? dimensionProvider;
  final double fallbackAspectRatio;

  @override
  State<_FramedThumbnail> createState() => _FramedThumbnailState();
}

class _FramedThumbnailState extends State<_FramedThumbnail> {
  ImageStream? _dimensionStream;
  ImageStreamListener? _dimensionListener;
  late double _aspectRatio;

  @override
  void initState() {
    super.initState();
    _aspectRatio = widget.fallbackAspectRatio;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _resolveDimensions();
  }

  @override
  void didUpdateWidget(covariant _FramedThumbnail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.dimensionProvider != widget.dimensionProvider) {
      _aspectRatio = widget.fallbackAspectRatio;
      _resolveDimensions();
    }
  }

  void _resolveDimensions() {
    _removeDimensionListener();
    final provider = widget.dimensionProvider;
    if (provider == null) return;
    final stream = provider.resolve(createLocalImageConfiguration(context));
    final listener = ImageStreamListener((image, synchronousCall) {
      final width = image.image.width;
      final height = image.image.height;
      if (width <= 0 || height <= 0 || !mounted) return;
      final ratio = width / height;
      if (ratio == _aspectRatio) return;
      if (synchronousCall) {
        _aspectRatio = ratio;
      } else {
        setState(() => _aspectRatio = ratio);
      }
    });
    _dimensionStream = stream;
    _dimensionListener = listener;
    stream.addListener(listener);
  }

  void _removeDimensionListener() {
    final stream = _dimensionStream;
    final listener = _dimensionListener;
    if (stream != null && listener != null) stream.removeListener(listener);
    _dimensionStream = null;
    _dimensionListener = null;
  }

  @override
  void dispose() {
    _removeDimensionListener();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The media renders edge-to-edge and square; the enclosing bubble clips it
    // to the grouped bubble radius (see [MediaMessageContent.wantsFullBleed]).
    // The chrome is intentionally minimal — self-backed pills over a clean
    // image rather than a full dark gradient.
    return ConstrainedBox(
      constraints: const BoxConstraints(
        maxWidth: MediaMessageContent._thumbMaxWidth,
        maxHeight: MediaMessageContent._thumbMaxHeight,
        minWidth: 120,
        minHeight: 90,
      ),
      // A bounded aspect-ratio shell is important here. The previous FittedBox
      // received an image with `width: double.infinity`, which left the Stack
      // with unbounded/intrinsic constraints and produced an empty portrait
      // frame after an attachment was sent. A 4:3 shell is a safe fallback
      // until intrinsic media dimensions are available; the provider then
      // updates it to the media's true ratio.
      child: AspectRatio(
        aspectRatio: _aspectRatio.clamp(0.55, 2.2),
        child: Material(
          color: ChatColors.muted,
          child: InkWell(
            onTap: widget.onTap,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Positioned.fill supplies finite constraints to both local
                // Image.file and CachedNetworkImage providers.
                Positioned.fill(child: widget.image),
                if (widget.scrim != null) Positioned.fill(child: widget.scrim!),
                if (widget.foreground != null)
                  Positioned.fill(child: widget.foreground!),
                if (widget.overlay != null)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: widget.overlay!,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Resolves the best available [ImageProvider] for a media payload and renders
/// it; falls back to a neutral icon tile when nothing loads.
class _MediaImage extends StatelessWidget {
  const _MediaImage({
    required this.media,
    this.preferLocal = true,
    this.fallbackIcon = Icons.image_outlined,
  });

  final MessageMedia media;
  final bool preferLocal;
  final IconData fallbackIcon;

  @override
  Widget build(BuildContext context) {
    final localPath = media.localPath;
    final remoteUrl = media.remoteUrl;

    if (preferLocal && localPath != null && localPath.isNotEmpty) {
      return Image.file(
        File(localPath),
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _remoteOrFallback(remoteUrl),
      );
    }
    return _remoteOrFallback(remoteUrl);
  }

  Widget _remoteOrFallback(String? remoteUrl) {
    if (remoteUrl != null && remoteUrl.isNotEmpty) {
      return CachedImage(
        url: remoteUrl,
        fit: BoxFit.cover,
        placeholder: const _ShimmerBox(),
        errorWidget: _ThumbFallback(icon: fallbackIcon),
      );
    }
    return _ThumbFallback(icon: fallbackIcon);
  }
}

/// Neutral placeholder painted when an image fails. Sized to fill the framed
/// thumbnail box. (The mid-load state is now owned by [CachedImage].)
class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback({this.icon = Icons.image_outlined});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ChatColors.muted,
      alignment: Alignment.center,
      child: Icon(icon, color: ChatColors.mutedForeground, size: 28),
    );
  }
}

/// Bottom-edge overlay bar: an optional pill on the left (duration) and an
/// optional widget on the right (download button or the time/status pill).
/// Padded off the image edges; each child carries its own translucent
/// background so no full-bleed dark scrim is needed.
class _MediaBottomBar extends StatelessWidget {
  const _MediaBottomBar({this.left, this.right});

  final Widget? left;
  final Widget? right;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (left != null) left!,
          const Spacer(),
          if (right != null) right!,
        ],
      ),
    );
  }
}

/// Timestamp (+ edited + delivery ticks for own messages) rendered as a
/// self-backed pill over caption-less media, mirroring the bubble meta row the
/// enclosing bubble suppresses for this case.
class _MediaMetaOverlay extends StatelessWidget {
  const _MediaMetaOverlay({required this.message});

  final ChatMessageView message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: const BoxDecoration(
        color: Color(0x59000000),
        borderRadius: ChatRadii.chip,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (message.isEdited) ...[
            const Text(
              'edited',
              style: TextStyle(
                fontSize: 10,
                fontStyle: FontStyle.italic,
                color: Color(0xCCFFFFFF),
              ),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            _formatClock(message.createdAtMillis),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Color(0xE6FFFFFF),
            ),
          ),
          if (message.isMine) ...[
            const SizedBox(width: 4),
            _MediaStatusGlyph(state: message.deliveryState),
          ],
        ],
      ),
    );
  }
}

/// Delivery-status tick tinted for legibility over media (white pre-read, sky
/// once read, red on failure) — same mapping as the bubble meta row.
class _MediaStatusGlyph extends StatelessWidget {
  const _MediaStatusGlyph({required this.state});

  final DeliveryState state;

  @override
  Widget build(BuildContext context) {
    const double size = 13;
    switch (state) {
      case DeliveryState.pending:
        return const Icon(Icons.schedule, size: size, color: Color(0xB3FFFFFF));
      case DeliveryState.sent:
        return const Icon(Icons.check, size: size, color: Color(0xE6FFFFFF));
      case DeliveryState.delivered:
        return const Icon(
          Icons.done_all,
          size: size,
          color: Color(0xE6FFFFFF),
        );
      case DeliveryState.read:
        return const Icon(
          Icons.done_all,
          size: size,
          color: ChatColors.readTick,
        );
      case DeliveryState.failed:
        return const Icon(
          Icons.error_outline,
          size: size,
          color: ChatColors.destructive,
        );
    }
  }
}

/// A play-glyph + duration pill shown bottom-left of a video poster (only when
/// the model carries a duration).
class _DurationPill extends StatelessWidget {
  const _DurationPill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: const BoxDecoration(
        color: Color(0x59000000),
        borderRadius: ChatRadii.chip,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.play_arrow_rounded,
            size: 11,
            color: Color(0xE6FFFFFF),
          ),
          const SizedBox(width: 3),
          Text(
            text,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xE6FFFFFF),
            ),
          ),
        ],
      ),
    );
  }
}

/// Inline HH:mm formatter (avoids a date package dependency).
String _formatClock(int millis) {
  final dt = DateTime.fromMillisecondsSinceEpoch(millis).toLocal();
  final hh = dt.hour.toString().padLeft(2, '0');
  final mm = dt.minute.toString().padLeft(2, '0');
  return '$hh:$mm';
}

/// A lightweight, dependency-free shimmer shown while a remote thumbnail loads:
/// a highlight band sweeping across the muted bubble fill.
class _ShimmerBox extends StatefulWidget {
  const _ShimmerBox();

  @override
  State<_ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<_ShimmerBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final shift = (_controller.value * 2) - 1; // -1 .. 1
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(shift - 1, -0.2),
              end: Alignment(shift + 1, 0.2),
              colors: const [
                Color(0xFF1E293B),
                Color(0xFF2A3A4F),
                Color(0xFF1E293B),
              ],
              stops: const [0.35, 0.5, 0.65],
            ),
          ),
        );
      },
    );
  }
}

/// Small translucent circular maximize button used in the bottom chrome.
class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    this.onTap,
    this.icon = Icons.fullscreen_rounded,
    this.tooltip = 'Open',
  });

  final VoidCallback? onTap;
  final IconData icon;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0x66000000),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 24,
          height: 24,
          child: Tooltip(
            message: tooltip,
            child: Icon(icon, size: 14, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// View-once tile (self-destructing photo)
// ---------------------------------------------------------------------------

class _ViewOnceTile extends StatelessWidget {
  const _ViewOnceTile({
    required this.icon,
    required this.label,
    this.onTap,
    this.emphasized = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  /// An unopened incoming tile is emphasized (primary tint) to invite the tap.
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final fg = emphasized ? ChatColors.primary : ChatColors.mutedForeground;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: emphasized ? ChatColors.primaryFaint : ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 180, maxWidth: 260),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: emphasized
                          ? const Color(0x22000000)
                          : ChatColors.primaryFaint,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, size: 18, color: fg),
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: emphasized
                            ? ChatColors.primary
                            : ChatColors.foreground,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// File card
// ---------------------------------------------------------------------------

class _FileCard extends StatelessWidget {
  const _FileCard({required this.media, required this.isMine, this.onTap});

  final MessageMedia media;
  final bool isMine;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final name = media.fileName ?? 'File';
    final sizeText = formatFileSize(media.fileSizeBytes);
    // On an outgoing (own) bubble the surface is the pink gradient, so tint the
    // inline card with translucent white; otherwise use the faint-primary wash.
    final tileColor = isMine
        ? const Color(0x33FFFFFF)
        : ChatColors.primaryFaint;
    final iconColor = isMine ? Colors.white : ChatColors.primary;
    final nameColor = isMine ? Colors.white : ChatColors.foreground;
    final subColor = isMine
        ? const Color(0xCCFFFFFF)
        : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 200, maxWidth: 280),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: tileColor,
                      borderRadius: const BorderRadius.all(
                        Radius.circular(ChatRadii.sm),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      Icons.insert_drive_file_outlined,
                      size: 18,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: nameColor,
                          ),
                        ),
                        if (sizeText.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            sizeText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11, color: subColor),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Icons.download_rounded, size: 18, color: subColor),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Audio chip (minimal fallback; rich voice UI lives in VoiceNoteBubble)
// ---------------------------------------------------------------------------

class _AudioChip extends StatelessWidget {
  const _AudioChip({required this.media, required this.isMine});

  final MessageMedia media;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final durationText = formatMediaDuration(media.audioDurationMs);
    final tint = isMine ? Colors.white : ChatColors.primary;
    final sub = isMine ? const Color(0xCCFFFFFF) : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Container(
        constraints: const BoxConstraints(minWidth: 160),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
          borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: isMine
                    ? const Color(0x33FFFFFF)
                    : ChatColors.primaryFaint,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(Icons.play_arrow_rounded, size: 18, color: tint),
            ),
            const SizedBox(width: 8),
            Icon(Icons.graphic_eq_rounded, size: 16, color: sub),
            const SizedBox(width: 6),
            Text(
              durationText.isNotEmpty ? durationText : 'Audio',
              style: TextStyle(fontSize: 12, color: sub),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Music chip (minimal fallback; rich track UI lives in MusicMessageBubble)
// ---------------------------------------------------------------------------

class _MusicChip extends StatelessWidget {
  const _MusicChip({required this.media, required this.isMine});

  final MessageMedia media;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final title = (media.musicTitle?.trim().isNotEmpty ?? false)
        ? media.musicTitle!.trim()
        : (media.fileName ?? 'Audio track');
    final durationText = formatMediaDuration(media.audioDurationMs);
    final tint = isMine ? Colors.white : ChatColors.primary;
    final sub = isMine ? const Color(0xCCFFFFFF) : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Container(
        constraints: const BoxConstraints(minWidth: 180, maxWidth: 260),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
          borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: isMine
                    ? const Color(0x33FFFFFF)
                    : ChatColors.primaryFaint,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(Icons.music_note_rounded, size: 18, color: tint),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isMine ? Colors.white : ChatColors.foreground,
                    ),
                  ),
                  if (durationText.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      durationText,
                      style: TextStyle(fontSize: 11, color: sub),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Download state machine (image / video, non-own, not yet ready)
// ---------------------------------------------------------------------------

class _DownloadGate extends StatelessWidget {
  const _DownloadGate({
    required this.media,
    required this.isMine,
    this.onDownload,
    this.onRetryDownload,
  });

  final MessageMedia media;
  final bool isMine;
  final VoidCallback? onDownload;
  final VoidCallback? onRetryDownload;

  @override
  Widget build(BuildContext context) {
    switch (media.downloadState) {
      case MediaDownloadState.downloading:
        return _GateShell(
          child: _DownloadingTile(progress: media.downloadProgress),
        );
      case MediaDownloadState.error:
        return _GateShell(onTap: onRetryDownload, child: const _ErrorTile());
      case MediaDownloadState.idle:
      case MediaDownloadState.downloaded:
        // `downloaded` should have been intercepted by the ready path; treat any
        // residual case here as an idle placeholder so we never dead-end.
        return _GateShell(
          onTap: onDownload,
          child: _IdleTile(media: media),
        );
    }
  }
}

/// Common bordered tile shell that hosts a download-state body.
class _GateShell extends StatelessWidget {
  const _GateShell({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minWidth: MediaMessageContent._placeholderMinWidth,
              minHeight: MediaMessageContent._placeholderMinHeight,
              maxWidth: MediaMessageContent._thumbMaxWidth,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
              child: Center(child: child),
            ),
          ),
        ),
      ),
    );
  }
}

class _IdleTile extends StatelessWidget {
  const _IdleTile({required this.media});

  final MessageMedia media;

  @override
  Widget build(BuildContext context) {
    final sizeText = formatFileSize(media.fileSizeBytes);
    final label = _kindLabel(media.kind);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            color: ChatColors.primaryFaint,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(
            _kindIcon(media.kind),
            size: 22,
            color: ChatColors.primary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          sizeText.isNotEmpty ? '$label • $sizeText' : label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: ChatColors.foreground,
          ),
        ),
        const SizedBox(height: 3),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(
              Icons.download_rounded,
              size: 11,
              color: ChatColors.mutedForeground,
            ),
            SizedBox(width: 4),
            Text('Tap to download', style: ChatTextStyles.timestamp),
          ],
        ),
      ],
    );
  }
}

class _DownloadingTile extends StatelessWidget {
  const _DownloadingTile({required this.progress});

  /// 0..1 download progress.
  final double progress;

  @override
  Widget build(BuildContext context) {
    final clamped = progress.clamp(0.0, 1.0);
    final percent = (clamped * 100).round();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 48,
          height: 48,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(
                  value: clamped == 0 ? null : clamped,
                  strokeWidth: 2.5,
                  backgroundColor: ChatColors.primaryFaint,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    ChatColors.primary,
                  ),
                ),
              ),
              Text(
                '$percent%',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: ChatColors.primary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        const Text('Downloading…', style: ChatTextStyles.timestamp),
      ],
    );
  }
}

class _ErrorTile extends StatelessWidget {
  const _ErrorTile();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: const [
        DecoratedBox(
          decoration: BoxDecoration(
            color: Color(0x1AEF4343),
            shape: BoxShape.circle,
          ),
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(
              Icons.refresh_rounded,
              size: 22,
              color: ChatColors.destructive,
            ),
          ),
        ),
        SizedBox(height: 10),
        Text(
          'Download failed',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: ChatColors.destructive,
          ),
        ),
        SizedBox(height: 3),
        Text('Tap to retry', style: ChatTextStyles.timestamp),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Kind helpers
// ---------------------------------------------------------------------------

IconData _kindIcon(ChatMediaKind kind) {
  switch (kind) {
    case ChatMediaKind.image:
      return Icons.image_outlined;
    case ChatMediaKind.video:
      return Icons.movie_outlined;
    case ChatMediaKind.audio:
      return Icons.mic_none_rounded;
    case ChatMediaKind.music:
      return Icons.music_note_rounded;
    case ChatMediaKind.file:
      return Icons.insert_drive_file_outlined;
    case ChatMediaKind.callLog:
      return Icons.call_outlined;
    case ChatMediaKind.none:
      return Icons.attachment_rounded;
  }
}

String _kindLabel(ChatMediaKind kind) {
  switch (kind) {
    case ChatMediaKind.image:
      return 'Photo';
    case ChatMediaKind.video:
      return 'Video';
    case ChatMediaKind.audio:
      return 'Voice message';
    case ChatMediaKind.music:
      return 'Music';
    case ChatMediaKind.file:
      return 'File';
    case ChatMediaKind.callLog:
      return 'Call';
    case ChatMediaKind.none:
      return 'Attachment';
  }
}
