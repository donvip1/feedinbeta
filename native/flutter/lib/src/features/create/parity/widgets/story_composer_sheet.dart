import 'package:flutter/material.dart';

import '../create_tokens.dart';
import '../story_extras_models.dart';

/// Full-screen bottom sheet for authoring the three "extra" story kinds that the
/// classic photo/video composer can't produce (plan Stories §C):
///   * text-only on a gradient/solid background,
///   * an audio-note story,
///   * a story with the user's OWN music file (<= 4 min).
///
/// Presentational: it owns only local editing state (the text controller, the
/// selected kind/background, the resolved attachment). It NEVER touches Supabase
/// or storage — it emits intent through [StoryComposerCallbacks] and the screen
/// owns `StoryPublisher` + the injected [StoryAudioSource].
///
/// Web mapping: this is the native counterpart of `CreateStoryModal.tsx` — the
/// music `Select` becomes a real file attach, and the missing text/gradient +
/// audio-note options from the plan are added here.
class StoryComposerSheet extends StatefulWidget {
  const StoryComposerSheet({
    super.key,
    required this.callbacks,
    this.audioAvailable = false,
    this.audioUnavailableNote,
    this.initialKind = StoryComposerKind.text,
  });

  final StoryComposerCallbacks callbacks;

  /// True when a [StoryAudioSource] is wired; false disables audio/music kinds
  /// and shows [audioUnavailableNote].
  final bool audioAvailable;

  /// Copy shown on the disabled audio/music kinds (e.g. the flagged dep note).
  final String? audioUnavailableNote;

  final StoryComposerKind initialKind;

  @override
  State<StoryComposerSheet> createState() => _StoryComposerSheetState();
}

/// Intent bundle. The screen wires these to `StoryPublisher`.
@immutable
class StoryComposerCallbacks {
  const StoryComposerCallbacks({
    required this.onPublishText,
    required this.onPublishAudio,
    required this.onPublishMusic,
    required this.onRecordAudio,
    required this.onPickMusic,
    this.onClose,
  });

  /// Publish a text story: (text, background).
  final Future<void> Function(String text, StoryBackground background)
  onPublishText;

  /// Publish an audio-note story: (attachment, background, overlay text).
  final Future<void> Function(
    AudioAttachment attachment,
    StoryBackground background,
    String text,
  )
  onPublishAudio;

  /// Publish a music story: (attachment, background, overlay text).
  final Future<void> Function(
    AudioAttachment attachment,
    StoryBackground background,
    String text,
  )
  onPublishMusic;

  /// Ask the screen to run the recorder seam; returns the finished clip or null.
  final Future<AudioAttachment?> Function() onRecordAudio;

  /// Ask the screen to run the file-picker seam (validated); returns the chosen
  /// track or null.
  final Future<AudioAttachment?> Function() onPickMusic;

  final VoidCallback? onClose;
}

class _StoryComposerSheetState extends State<StoryComposerSheet> {
  late StoryComposerKind _kind = widget.initialKind;
  final _textController = TextEditingController();
  StoryBackground _background = StoryBackgroundPalette.defaults.first;
  AudioAttachment? _attachment;
  bool _busy = false;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  bool get _audioLocked => !widget.audioAvailable;

  bool get _canPublish {
    if (_busy) return false;
    switch (_kind) {
      case StoryComposerKind.text:
        return _textController.text.trim().isNotEmpty;
      case StoryComposerKind.audio:
      case StoryComposerKind.music:
        return _attachment != null;
    }
  }

  Future<void> _runPublish() async {
    if (!_canPublish) return;
    setState(() => _busy = true);
    try {
      switch (_kind) {
        case StoryComposerKind.text:
          await widget.callbacks.onPublishText(
            _textController.text,
            _background,
          );
          break;
        case StoryComposerKind.audio:
          await widget.callbacks.onPublishAudio(
            _attachment!,
            _background,
            _textController.text,
          );
          break;
        case StoryComposerKind.music:
          await widget.callbacks.onPublishMusic(
            _attachment!,
            _background,
            _textController.text,
          );
          break;
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _attachAudio({required bool record}) async {
    setState(() => _busy = true);
    try {
      final result = record
          ? await widget.callbacks.onRecordAudio()
          : await widget.callbacks.onPickMusic();
      if (result != null && mounted) {
        setState(() => _attachment = result);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        initialChildSize: 0.92,
        minChildSize: 0.5,
        maxChildSize: 0.98,
        expand: false,
        builder: (context, scrollController) {
          return Container(
            decoration: const BoxDecoration(
              color: CreateColors.card,
              borderRadius: CreateRadii.sheetTop,
              boxShadow: CreateShadows.sheet,
            ),
            child: Column(
              children: [
                _grabber(),
                _header(),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(
                      CreateSpacing.lg,
                      0,
                      CreateSpacing.lg,
                      CreateSpacing.xl,
                    ),
                    children: [
                      _kindChooser(),
                      const SizedBox(height: CreateSpacing.lg),
                      _preview(),
                      const SizedBox(height: CreateSpacing.lg),
                      if (_kind != StoryComposerKind.audio ||
                          _attachment != null)
                        _textField(),
                      const SizedBox(height: CreateSpacing.lg),
                      _backgroundStrip(),
                      if (_kind != StoryComposerKind.text) ...[
                        const SizedBox(height: CreateSpacing.lg),
                        _audioSection(),
                      ],
                    ],
                  ),
                ),
                _publishBar(),
              ],
            ),
          );
        },
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  Widget _grabber() => Center(
    child: Container(
      width: 40,
      height: 4,
      margin: const EdgeInsets.symmetric(vertical: CreateSpacing.md),
      decoration: BoxDecoration(
        color: CreateColors.whiteSoft,
        borderRadius: BorderRadius.circular(CreateRadii.pill),
      ),
    ),
  );

  Widget _header() => Padding(
    padding: const EdgeInsets.fromLTRB(
      CreateSpacing.lg,
      0,
      CreateSpacing.sm,
      CreateSpacing.sm,
    ),
    child: Row(
      children: [
        const Expanded(
          child: Text('Create story', style: CreateTextStyles.title),
        ),
        IconButton(
          onPressed: _busy ? null : widget.callbacks.onClose,
          tooltip: 'Close',
          icon: const Icon(Icons.close, color: CreateColors.foreground),
        ),
      ],
    ),
  );

  Widget _kindChooser() {
    return Row(
      children: [
        for (final kind in StoryComposerKind.values) ...[
          Expanded(child: _kindChip(kind)),
          if (kind != StoryComposerKind.values.last)
            const SizedBox(width: CreateSpacing.sm),
        ],
      ],
    );
  }

  Widget _kindChip(StoryComposerKind kind) {
    final selected = _kind == kind;
    final locked = kind != StoryComposerKind.text && _audioLocked;
    final icon = switch (kind) {
      StoryComposerKind.text => Icons.text_fields,
      StoryComposerKind.audio => Icons.mic_none_outlined,
      StoryComposerKind.music => Icons.library_music_outlined,
    };
    return Opacity(
      opacity: locked ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        borderRadius: CreateRadii.field,
        child: InkWell(
          borderRadius: CreateRadii.field,
          onTap: locked || _busy
              ? null
              : () => setState(() {
                  _kind = kind;
                  _attachment = null;
                }),
          child: Container(
            padding: const EdgeInsets.symmetric(
              vertical: CreateSpacing.md,
              horizontal: CreateSpacing.sm,
            ),
            decoration: BoxDecoration(
              borderRadius: CreateRadii.field,
              gradient: selected ? CreateGradients.primaryAction : null,
              color: selected ? null : CreateColors.muted,
              border: Border.all(
                color: selected ? Colors.transparent : CreateColors.border,
              ),
            ),
            child: Column(
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: selected
                      ? CreateColors.primaryForeground
                      : CreateColors.mutedForeground,
                ),
                const SizedBox(height: CreateSpacing.xs),
                Text(
                  kind.label,
                  textAlign: TextAlign.center,
                  style: selected
                      ? CreateTextStyles.pillLabelSelected
                      : CreateTextStyles.pillLabel,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// A live 9:16 preview mirroring the rendered card (background + text +
  /// optional badge) so users see what publishes.
  Widget _preview() {
    final badge = switch (_kind) {
      StoryComposerKind.text => null,
      StoryComposerKind.audio => 'AUDIO',
      StoryComposerKind.music => 'MUSIC',
    };
    final text = _textController.text.trim();
    final placeholder = switch (_kind) {
      StoryComposerKind.text => 'Your words here',
      StoryComposerKind.audio => '🎙️  Audio note',
      StoryComposerKind.music => _attachment?.title ?? '🎵  Music',
    };
    return Center(
      child: AspectRatio(
        aspectRatio: CreateSpacing.storyAspect,
        child: Container(
          constraints: const BoxConstraints(maxHeight: 380),
          decoration: BoxDecoration(
            gradient: _background.gradient,
            borderRadius: CreateRadii.card,
          ),
          padding: const EdgeInsets.all(CreateSpacing.lg),
          child: Stack(
            children: [
              if (badge != null)
                Align(
                  alignment: Alignment.topCenter,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: CreateSpacing.md,
                      vertical: CreateSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: CreateColors.whiteFaint,
                      borderRadius: BorderRadius.circular(CreateRadii.pill),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        color: CreateColors.onMedia,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2,
                      ),
                    ),
                  ),
                ),
              Center(
                child: Text(
                  text.isEmpty ? placeholder : text,
                  textAlign: TextAlign.center,
                  maxLines: 8,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: text.isEmpty
                        ? const Color(0x99FFFFFF)
                        : CreateColors.onMedia,
                    fontSize: 26,
                    height: 1.25,
                    fontWeight: FontWeight.w800,
                    shadows: const [
                      Shadow(
                        color: Color(0x66000000),
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _textField() {
    final isCaption = _kind != StoryComposerKind.text;
    const border = OutlineInputBorder(
      borderRadius: CreateRadii.field,
      borderSide: BorderSide(color: CreateColors.border),
    );
    return TextField(
      controller: _textController,
      onChanged: (_) => setState(() {}),
      minLines: 2,
      maxLines: 5,
      maxLength: kMaxStoryTextLength,
      cursorColor: CreateColors.primary,
      style: CreateTextStyles.composerInput,
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: CreateColors.muted,
        hintText: isCaption
            ? 'Add a caption (optional)'
            : 'Type your story...',
        hintStyle: CreateTextStyles.composerHint,
        counterStyle: CreateTextStyles.helper,
        contentPadding: const EdgeInsets.all(CreateSpacing.md),
        border: border,
        enabledBorder: border,
        focusedBorder: const OutlineInputBorder(
          borderRadius: CreateRadii.field,
          borderSide: BorderSide(color: CreateColors.primary),
        ),
      ),
    );
  }

  Widget _backgroundStrip() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('BACKGROUND', style: CreateTextStyles.sectionLabel),
        const SizedBox(height: CreateSpacing.sm),
        SizedBox(
          height: 52,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: StoryBackgroundPalette.defaults.length,
            separatorBuilder: (_, __) =>
                const SizedBox(width: CreateSpacing.sm),
            itemBuilder: (context, index) {
              final bg = StoryBackgroundPalette.defaults[index];
              final selected = bg.id == _background.id;
              return GestureDetector(
                onTap: () => setState(() => _background = bg),
                child: Container(
                  width: 52,
                  decoration: BoxDecoration(
                    gradient: bg.gradient,
                    borderRadius: CreateRadii.tile,
                    border: Border.all(
                      color: selected
                          ? CreateColors.primaryForeground
                          : CreateColors.border,
                      width: selected ? 3 : 1,
                    ),
                  ),
                  child: selected
                      ? const Icon(
                          Icons.check,
                          size: 18,
                          color: CreateColors.onMedia,
                        )
                      : null,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _audioSection() {
    if (_audioLocked) {
      return Container(
        padding: const EdgeInsets.all(CreateSpacing.md),
        decoration: BoxDecoration(
          color: CreateColors.primaryFaint,
          borderRadius: CreateRadii.card,
          border: Border.all(color: CreateColors.primarySoft),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.info_outline,
              size: 20,
              color: CreateColors.amberWarning,
            ),
            const SizedBox(width: CreateSpacing.sm),
            Expanded(
              child: Text(
                widget.audioUnavailableNote ??
                    'Audio capture needs to be enabled on this build.',
                style: CreateTextStyles.helper,
              ),
            ),
          ],
        ),
      );
    }

    final isMusic = _kind == StoryComposerKind.music;
    if (_attachment != null) {
      return _attachmentCard(_attachment!);
    }
    return _AudioActionButton(
      icon: isMusic ? Icons.upload_file_outlined : Icons.mic_none_outlined,
      label: isMusic ? 'Choose a music file' : 'Record an audio note',
      helper: isMusic
          ? 'MP3, M4A, AAC, WAV • up to 4 minutes'
          : 'Tap to record • up to 4 minutes',
      onTap: () => _attachAudio(record: !isMusic),
    );
  }

  Widget _attachmentCard(AudioAttachment a) {
    return Container(
      padding: const EdgeInsets.all(CreateSpacing.md),
      decoration: BoxDecoration(
        color: CreateColors.muted,
        borderRadius: CreateRadii.card,
        border: Border.all(color: CreateColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: CreateGradients.shareAction,
            ),
            child: Icon(
              a.source == AudioSourceKind.recorded
                  ? Icons.graphic_eq
                  : Icons.music_note,
              color: CreateColors.onMedia,
              size: 22,
            ),
          ),
          const SizedBox(width: CreateSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  a.title ??
                      (a.source == AudioSourceKind.recorded
                          ? 'Audio note'
                          : 'Selected track'),
                  style: CreateTextStyles.uploadStatus,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  a.durationLabel != null
                      ? '${a.durationLabel} • ${a.artist ?? 'Ready'}'
                      : (a.durationKnown
                            ? 'Ready'
                            : 'Duration not verified on this build'),
                  style: CreateTextStyles.helper,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: _busy ? null : () => setState(() => _attachment = null),
            tooltip: 'Remove',
            icon: const Icon(
              Icons.close,
              size: 20,
              color: CreateColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _publishBar() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          CreateSpacing.lg,
          CreateSpacing.sm,
          CreateSpacing.lg,
          CreateSpacing.md,
        ),
        child: SizedBox(
          height: CreateSpacing.tapTarget + 4,
          child: Material(
            color: Colors.transparent,
            borderRadius: CreateRadii.chip,
            child: InkWell(
              borderRadius: CreateRadii.chip,
              onTap: _canPublish ? _runPublish : null,
              child: Opacity(
                opacity: _canPublish ? 1 : 0.5,
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    gradient: CreateGradients.primaryAction,
                    borderRadius: CreateRadii.chip,
                    boxShadow: CreateShadows.pink,
                  ),
                  child: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              CreateColors.primaryForeground,
                            ),
                          ),
                        )
                      : const Text(
                          'Share story',
                          style: CreateTextStyles.buttonLabel,
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tappable action tile for recording / picking audio (empty state).
class _AudioActionButton extends StatelessWidget {
  const _AudioActionButton({
    required this.icon,
    required this.label,
    required this.helper,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String helper;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: CreateRadii.field,
      child: InkWell(
        onTap: onTap,
        borderRadius: CreateRadii.field,
        child: Container(
          padding: const EdgeInsets.all(CreateSpacing.lg),
          decoration: BoxDecoration(
            color: CreateColors.muted,
            borderRadius: CreateRadii.field,
            border: Border.all(color: CreateColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: CreateColors.primaryFaint,
                ),
                child: Icon(icon, size: 22, color: CreateColors.primary),
              ),
              const SizedBox(width: CreateSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: CreateTextStyles.uploadStatus),
                    const SizedBox(height: 2),
                    Text(helper, style: CreateTextStyles.helper),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                size: 20,
                color: CreateColors.mutedForeground,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
