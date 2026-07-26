import 'dart:async';

import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/call_session.dart';
import '../../domain/result.dart';
import 'call_transport.dart';
import 'call_wire_codec.dart';

/// [CallTransport] over LiveKit's SFU — the media plane for every [CallMode]
/// (1:1 today; the SAME room join serves group/space/broadcast since the SFU
/// is inherently multi-party; only the room name + token grants differ).
///
/// Token model: the SFU URL + short-lived join token are minted per call by
/// the server-authoritative `livekit-token` edge function (identity forced to
/// the auth user; grants derived from the call row). The app holds NO LiveKit
/// secret. Any token/permission/join failure degrades to
/// [CallTransportState.failed] — the engine keeps the call alive with a retry.
class LiveKitCallTransport implements CallTransport {
  LiveKitCallTransport({SupabaseClient? client}) : _client = client;

  final SupabaseClient? _client;

  final _states = StreamController<CallTransportState>.broadcast();
  final _participants = StreamController<CallParticipantEvent>.broadcast();

  CallTransportState _state = CallTransportState.idle;
  lk.Room? _room;
  lk.EventsListener<lk.RoomEvent>? _listener;
  bool _usingFrontCamera = true;
  bool _disposed = false;

  SupabaseClient? get _resolved {
    if (_client != null) return _client;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<CallTransportState> get states => _states.stream;

  @override
  CallTransportState get state => _state;

  @override
  Stream<CallParticipantEvent> get participantEvents => _participants.stream;

  void _emit(CallTransportState next) {
    if (_disposed || next == _state) return;
    _state = next;
    _states.add(next);
  }

  @override
  Future<Result<void>> connect(
    CallSession session, {
    required bool videoEnabled,
  }) async {
    if (_disposed) return Err(CommError.unknown('transport disposed'));
    _emit(CallTransportState.connecting);
    await _teardownRoom(); // a retry must never stack rooms/listeners

    try {
      final granted = await _ensurePermissions(video: session.mode.isVideo);
      if (!granted) {
        _emit(CallTransportState.failed);
        return Err(CommError.permission('Microphone/camera permission denied'));
      }

      final credentials = await _fetchToken(session);
      if (credentials == null) {
        _emit(CallTransportState.failed);
        return Err(CommError.network('Could not mint a call token'));
      }

      final room = lk.Room(
        roomOptions: const lk.RoomOptions(
          adaptiveStream: true,
          dynacast: true,
        ),
      );
      _room = room;
      final listener = room.createListener();
      _listener = listener;
      _wireListener(listener);

      await room.connect(credentials.$1, credentials.$2);
      await room.localParticipant?.setMicrophoneEnabled(true);
      if (session.mode.isVideo && videoEnabled) {
        await room.localParticipant?.setCameraEnabled(true);
      }
      _emit(CallTransportState.connected);
      return const Ok(null);
    } catch (error) {
      _emit(CallTransportState.failed);
      return Err(CommError.network('Media join failed', cause: error));
    }
  }

  Future<bool> _ensurePermissions({required bool video}) async {
    try {
      final wanted = <Permission>[Permission.microphone];
      if (video) wanted.add(Permission.camera);
      final statuses = await wanted.request();
      return statuses.values.every((s) => s.isGranted);
    } catch (_) {
      return false;
    }
  }

  /// (url, token) from `livekit-token`, or null on any failure.
  Future<(String, String)?> _fetchToken(CallSession session) async {
    final client = _resolved;
    if (client == null) return null;
    try {
      final res = await client.functions.invoke(
        'livekit-token',
        body: {
          'roomName': CallWireCodec.roomName(session.id),
          'participantName': '', // display only; identity is server-forced
          'isHost': true,
        },
      );
      if (res.status != 200 || res.data is! Map) return null;
      final data = res.data as Map;
      final token = data['token']?.toString();
      final url = data['url']?.toString();
      if (token == null || token.isEmpty || url == null || url.isEmpty) {
        return null;
      }
      return (url, token);
    } catch (_) {
      return null;
    }
  }

  void _wireListener(lk.EventsListener<lk.RoomEvent> listener) {
    listener
      ..on<lk.RoomConnectedEvent>((_) => _emit(CallTransportState.connected))
      ..on<lk.RoomReconnectingEvent>(
        (_) => _emit(CallTransportState.reconnecting),
      )
      ..on<lk.RoomReconnectedEvent>((_) => _emit(CallTransportState.connected))
      ..on<lk.RoomDisconnectedEvent>(
        (_) => _emit(CallTransportState.disconnected),
      )
      ..on<lk.ParticipantConnectedEvent>(
        (event) => _pushParticipant(
          CallParticipantEventKind.joined,
          event.participant,
        ),
      )
      ..on<lk.ParticipantDisconnectedEvent>(
        (event) => _pushParticipant(
          CallParticipantEventKind.left,
          event.participant,
        ),
      )
      ..on<lk.TrackMutedEvent>(
        (event) => _pushFromPublication(event.participant),
      )
      ..on<lk.TrackUnmutedEvent>(
        (event) => _pushFromPublication(event.participant),
      )
      ..on<lk.ActiveSpeakersChangedEvent>((event) {
        for (final speaker in event.speakers) {
          _pushParticipant(CallParticipantEventKind.updated, speaker);
        }
      });
  }

  void _pushFromPublication(lk.Participant participant) =>
      _pushParticipant(CallParticipantEventKind.updated, participant);

  void _pushParticipant(
    CallParticipantEventKind kind,
    lk.Participant participant,
  ) {
    if (_disposed || _participants.isClosed) return;
    _participants.add(
      CallParticipantEvent(
        kind,
        CallParticipant(
          userId: participant.identity,
          displayName: participant.name,
          isMuted: !participant.isMicrophoneEnabled(),
          isVideoOn: participant.isCameraEnabled(),
          isSpeaking: participant.isSpeaking,
          isScreenSharing: participant.isScreenShareEnabled(),
        ),
      ),
    );
  }

  // -- Local controls ------------------------------------------------------------

  @override
  Future<void> setMuted(bool muted) async {
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(!muted);
    } catch (_) {/* best-effort */}
  }

  @override
  Future<void> setVideoEnabled(bool enabled) async {
    try {
      await _room?.localParticipant?.setCameraEnabled(enabled);
    } catch (_) {}
  }

  @override
  Future<void> setSpeakerOn(bool speakerOn) async {
    try {
      await lk.Hardware.instance.setSpeakerphoneOn(speakerOn);
    } catch (_) {/* routing is platform-dependent */}
  }

  @override
  Future<void> flipCamera() async {
    try {
      final track = _room?.localParticipant
          ?.getTrackPublicationBySource(lk.TrackSource.camera)
          ?.track;
      if (track is! lk.LocalVideoTrack) return;
      await track.setCameraPosition(
        _usingFrontCamera ? lk.CameraPosition.back : lk.CameraPosition.front,
      );
      _usingFrontCamera = !_usingFrontCamera;
    } catch (_) {/* single-camera devices */}
  }

  @override
  Future<void> setScreenShareEnabled(bool enabled) async {
    try {
      await _room?.localParticipant?.setScreenShareEnabled(enabled);
    } catch (_) {}
  }

  // -- Teardown --------------------------------------------------------------------

  @override
  Future<void> disconnect() async {
    await _teardownRoom();
    _emit(CallTransportState.disconnected);
  }

  Future<void> _teardownRoom() async {
    final listener = _listener;
    _listener = null;
    if (listener != null) {
      try {
        await listener.dispose();
      } catch (_) {}
    }
    final room = _room;
    _room = null;
    if (room != null) {
      try {
        await room.disconnect();
      } catch (_) {}
      try {
        await room.dispose();
      } catch (_) {}
    }
  }

  Future<void> dispose() async {
    _disposed = true;
    await _teardownRoom();
    await _states.close();
    await _participants.close();
  }
}
